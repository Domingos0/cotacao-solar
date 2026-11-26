// Item 36: Kits da Promoção — kits pré-montados com desconto sobre o preço
// homologado, por tempo limitado, com frete por região e folders de
// marketing (FOB do kit + regional) pro admin conferir contra o que foi
// divulgado.
import { supabase } from './supabase'
import { round2 } from './money'

export const PROMO_REGIOES_KEYS = ['norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul']

// Avisos de status (item 36): "ativa" é o estado neutro — só aparece um
// aviso quando há algo que o cliente precisa saber (prazo acabando, já
// estendido, ou já encerrado). "Prorrogada" é independente dos outros e
// pode aparecer junto (detectado sozinho comparando data_fim com
// data_fim_original, sem precisar de uma flag manual que o admin esqueceria
// de marcar ao estender o prazo).
export function getPromoStatus(kit, hoje = new Date()) {
  const fim = new Date(`${kit.data_fim}T23:59:59`)
  const hojeZero = new Date(hoje); hojeZero.setHours(0, 0, 0, 0)
  const fimZero = new Date(`${kit.data_fim}T00:00:00`)
  const diffDias = Math.round((fimZero - hojeZero) / 86400000)
  const prorrogada = kit.data_fim_original && kit.data_fim > kit.data_fim_original

  let principal
  if (hoje > fim) principal = 'encerrada'
  else if (diffDias === 0) principal = 'ultimo_dia'
  else if (diffDias > 0 && diffDias <= 7) principal = 'ultimos_7_dias'
  else principal = 'ativa'

  return { principal, prorrogada }
}

export const PROMO_STATUS_LABELS = {
  ativa: 'Ativa',
  ultimos_7_dias: 'Últimos 7 dias',
  ultimo_dia: 'Último dia',
  encerrada: 'Encerrada',
}

// Preço mostrado ao cliente = preço homologado com o desconto da promoção,
// mais o frete da promoção da região dele (não o frete normal do catálogo —
// a promoção tem o próprio valor de frete por região, definido pelo admin).
export function calcPromoPreco(kit, regiao, regioesFrete) {
  const comDesconto = round2((kit.preco_homologado || 0) * (1 - (kit.desconto_pct || 0) / 100))
  const frete = regiao ? (regioesFrete?.[regiao]?.frete_valor || 0) : 0
  return round2(comDesconto + frete)
}

export async function listPromoKits() {
  const { data, error } = await supabase.from('promo_kits').select('*').order('data_fim', { ascending: true })
  return { data: data || [], error }
}

export async function upsertPromoKit(kit) {
  const payload = { ...kit, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('promo_kits').upsert(payload).select().single()
  return { data, error }
}

export async function deletePromoKit(id) {
  const { error } = await supabase.from('promo_kits').delete().eq('id', id)
  return { error }
}

export async function listPromoRegioes() {
  const { data, error } = await supabase.from('promo_regioes').select('*')
  if (error) return { data: {}, error }
  const byRegiao = {}
  ;(data || []).forEach(r => { byRegiao[r.regiao] = r })
  return { data: byRegiao, error: null }
}

export async function upsertPromoRegiao(regiao, frete_valor, folder_url) {
  const payload = { regiao, frete_valor, folder_url, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('promo_regioes').upsert(payload)
  return { error }
}

// Sobe o PDF pro bucket público 'promo-folders' (folder FOB do kit ou
// folder regional) e devolve a URL pública.
export async function uploadPromoFolder(file, pathHint) {
  const safeName = pathHint.replace(/[^\w.-]+/g, '_')
  const path = `${safeName}-${Date.now()}.pdf`
  const { error } = await supabase.storage.from('promo-folders').upload(path, file, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('promo-folders').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
