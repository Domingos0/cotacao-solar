// Item 34: comparar duas revisões de cotação (ex: Rev. 0 × Rev. 1) e
// destacar o que mudou — cada entrada de kitData.revisoes[] já guarda o
// estado completo daquela revisão (itens, total, frete), então comparar
// duas é só um diff por código SAP.
function itemKey(it) {
  return it.codigo_sap || it.produto || it.label
}

// status: 'added' (só em B) | 'removed' (só em A) | 'changed' (qty/preço
// diferentes) | 'same' (idêntico)
export function diffRevisions(revA, revB) {
  const itemsA = revA?.items || []
  const itemsB = revB?.items || []
  const mapA = new Map(itemsA.map(it => [itemKey(it), it]))
  const mapB = new Map(itemsB.map(it => [itemKey(it), it]))
  const keys = new Set([...mapA.keys(), ...mapB.keys()])

  const items = [...keys].map(key => {
    const a = mapA.get(key)
    const b = mapB.get(key)
    if (a && !b) return { key, status: 'removed', a, b: null }
    if (!a && b) return { key, status: 'added', a: null, b }
    const changed = a.qty !== b.qty || a.preco_unit !== b.preco_unit || a.total !== b.total
    return { key, status: changed ? 'changed' : 'same', a, b }
  })

  const totalA = revA?.total_final || 0
  const totalB = revB?.total_final || 0

  return {
    items,
    totalA,
    totalB,
    totalDelta: Math.round((totalB - totalA) * 100) / 100,
    freteA: revA?.frete || '—',
    freteB: revB?.frete || '—',
    freteChanged: (revA?.frete || '—') !== (revB?.frete || '—'),
  }
}
