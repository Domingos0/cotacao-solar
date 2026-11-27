// Cotação feita numa lista de preços anterior: (1) selo "Lista nova" e
// (2) prévia do que muda ao atualizar pra lista atual, ANTES de confirmar.
// A prévia segue a mesma regra do requote_quote no banco: preço novo casando
// código SAP + nome do produto; item que não está na lista nova mantém o
// preço; total pela mesma fórmula (computeTotalFinal = compute_total_final).
import { supabase } from './supabase'
import { round2, computeTotalFinal } from './money'

const FECHADAS = ['fechado', 'faturado', 'em_transporte', 'implantado', 'perdida']

const chave = (codigo, nome) => `${codigo || ''}|${nome || ''}`

// ── Puro (testável) ─────────────────────────────────────────────────────────

// A cotação está numa lista anterior à publicada agora?
export function listaDesatualizada(quote, info) {
  if (!quote || !info?.currentId || FECHADAS.includes(quote.status)) return false
  const daCotacao = info.porQuote?.[quote.id]
  return !!daCotacao?.versionId && daCotacao.versionId !== info.currentId
}

// items: quote_items; precos: { 'codigo|nome': preco } da lista atual
export function previewRequote(items, precos, { desconto_pct = 0, frete_pct = 1, total_final = 0 } = {}) {
  const itens = (items || []).map(i => {
    const novo = precos[chave(i.codigo_sap, i.produto)]
    const precoNovo = novo != null ? Number(novo) : Number(i.preco_unit || 0)
    const precoAtual = Number(i.preco_unit || 0)
    return {
      label: i.label, produto: i.produto, codigo_sap: i.codigo_sap, qty: i.qty,
      precoAtual, precoNovo,
      naLista: novo != null,
      mudou: round2(precoNovo) !== round2(precoAtual),
    }
  })
  const subtotalNovo = round2(itens.reduce((s, i) => s + (i.qty || 0) * i.precoNovo, 0))
  const totalNovo = computeTotalFinal(subtotalNovo, desconto_pct, frete_pct)
  return {
    itens,
    mudaram: itens.filter(i => i.mudou),
    foraDaLista: itens.filter(i => !i.naLista),
    subtotalNovo,
    totalAtual: round2(total_final || 0),
    totalNovo,
    diferenca: round2(totalNovo - (total_final || 0)),
  }
}

// ── Supabase ────────────────────────────────────────────────────────────────

// { currentId, currentLabel, porQuote: { [quoteId]: { versionId, label } } }
export async function loadListaInfo(quotes) {
  const abertas = (quotes || []).filter(q => q.current_version_id && !FECHADAS.includes(q.status))
  const { data: currentId } = await supabase.rpc('current_catalog_version')
  if (!currentId) return { currentId: null, currentLabel: '', porQuote: {} }

  const versaoIds = [...new Set(abertas.map(q => q.current_version_id))]
  const catalogoPorVersao = {}
  for (let i = 0; i < versaoIds.length; i += 200) {
    const { data } = await supabase.from('quote_versions').select('id, catalog_version_id').in('id', versaoIds.slice(i, i + 200))
    ;(data || []).forEach(v => { catalogoPorVersao[v.id] = v.catalog_version_id })
  }
  const catalogoIds = [...new Set([currentId, ...Object.values(catalogoPorVersao).filter(Boolean)])]
  const { data: versoes } = await supabase.from('price_catalog_versions').select('id, label').in('id', catalogoIds)
  const label = Object.fromEntries((versoes || []).map(v => [v.id, v.label || '']))

  const porQuote = {}
  abertas.forEach(q => {
    const versionId = catalogoPorVersao[q.current_version_id]
    if (versionId) porQuote[q.id] = { versionId, label: label[versionId] || 'lista anterior' }
  })
  return { currentId, currentLabel: label[currentId] || 'lista atual', porQuote }
}

// Preços da lista atual pros itens da cotação → { 'codigo|nome': preco }
export async function loadPrecosLista(versionId, items) {
  const codigos = [...new Set((items || []).map(i => i.codigo_sap).filter(c => c && c !== '—'))]
  if (!versionId || !codigos.length) return {}
  const { data, error } = await supabase
    .from('price_catalog_products')
    .select('codigo, preco, data')
    .eq('version_id', versionId)
    .in('codigo', codigos)
  if (error) throw error
  return Object.fromEntries((data || []).map(p => [chave(p.codigo, p.data?.nome), p.preco]))
}
