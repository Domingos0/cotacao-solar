// Item 35: unificar cotações por cliente — várias cotações separadas viram
// uma única proposta consolidada: total geral em R$ (com desconto opcional
// do pacote) e em kWp, lista de materiais somada por SAP (o mesmo item em
// kits diferentes vira uma linha só com a quantidade somada), e validade
// igual à da cotação que vence primeiro (nunca estende prazo).
import { round2 } from './money'

export function sumMaterialsBySap(itemLists) {
  const map = new Map()
  itemLists.forEach(items => {
    ;(items || []).forEach(item => {
      const key = item.codigo_sap || `${item.label}|${item.produto}`
      const existing = map.get(key)
      if (existing) {
        existing.qty = round2((existing.qty || 0) + (item.qty || 0))
        existing.total = round2((existing.total || 0) + (item.total || 0))
      } else {
        map.set(key, { ...item })
      }
    })
  })
  return [...map.values()]
}

export function buildUnifiedProposal(quotes, descontoPct = 0) {
  const pct = Number(descontoPct) || 0
  const totalBruto = round2((quotes || []).reduce((s, q) => s + (q.total_final || 0), 0))
  const totalComDesconto = round2(totalBruto * (1 - pct / 100))
  const totalKwp = round2((quotes || []).reduce((s, q) => s + (Number(q.kwp) || 0), 0))
  const materiais = sumMaterialsBySap((quotes || []).map(q => q.quote_items || q.items || []))
  const validades = (quotes || []).map(q => q.valid_until).filter(Boolean).sort()
  const validadeMinima = validades[0] || null
  return { totalBruto, totalComDesconto, totalKwp, materiais, validadeMinima, descontoPct: pct }
}

// Admin: só unifica cotações do MESMO CNPJ (proposta única = um faturamento
// só). Cotação sem CNPJ (ex: interna pra cliente sem cadastro) não entra,
// porque não dá pra garantir que é o mesmo cliente.
export function checkUnifyCnpj(quotes) {
  // Cotação interna pra cliente sem cadastro fica no perfil do admin — o
  // CNPJ ali seria o da Ernaniff, não o do cliente: conta como sem CNPJ.
  const digits = q => q?.data?.clienteCadastrado === false ? '' : String(q?.profiles?.cnpj || '').replace(/\D/g, '')
  const semCnpj = (quotes || []).filter(q => !digits(q))
  if (semCnpj.length) {
    return { ok: false, motivo: 'sem_cnpj', refs: semCnpj.map(q => q.data?.numero_orcamento || String(q.id).slice(0, 8).toUpperCase()) }
  }
  const cnpjs = new Set((quotes || []).map(digits))
  if (cnpjs.size > 1) return { ok: false, motivo: 'cnpj_diferente', refs: [] }
  return { ok: true, motivo: null, refs: [] }
}
