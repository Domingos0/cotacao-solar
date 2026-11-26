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
