import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: {} }))
const { listaDesatualizada, previewRequote } = await import('./listaPrecos')
const { computeTotalFinal } = await import('./money')

describe('listaDesatualizada', () => {
  const info = { currentId: 'nov', porQuote: { a: { versionId: 'out' }, b: { versionId: 'nov' } } }
  it('cotação aberta numa lista anterior → true', () => {
    expect(listaDesatualizada({ id: 'a', status: 'enviada' }, info)).toBe(true)
  })
  it('já na lista atual, fechada, ou sem info → false', () => {
    expect(listaDesatualizada({ id: 'b', status: 'enviada' }, info)).toBe(false)
    expect(listaDesatualizada({ id: 'a', status: 'fechado' }, info)).toBe(false)
    expect(listaDesatualizada({ id: 'z', status: 'enviada' }, info)).toBe(false)
    expect(listaDesatualizada({ id: 'a', status: 'enviada' }, null)).toBe(false)
  })
})

describe('previewRequote (mesma regra do requote_quote)', () => {
  const items = [
    { label: 'Módulo', produto: '615 Wp - WEG', codigo_sap: '18592885', qty: 10, preco_unit: 1000 },
    { label: 'Inversor', produto: 'SIW200H M075 W10', codigo_sap: '18179589', qty: 1, preco_unit: 8000 },
    { label: 'Avulso', produto: 'Item manual', codigo_sap: '—', qty: 2, preco_unit: 50 },
  ]
  const precos = { '18592885|615 Wp - WEG': 900, '18179589|SIW200H M075 W10': 8000 }

  it('aplica o preço novo só onde código + nome batem; o resto mantém', () => {
    const p = previewRequote(items, precos, { desconto_pct: 20, frete_pct: 1.05, total_final: 9000 })
    expect(p.mudaram.map(i => i.codigo_sap)).toEqual(['18592885'])
    expect(p.foraDaLista.map(i => i.produto)).toEqual(['Item manual'])
    expect(p.subtotalNovo).toBe(10 * 900 + 8000 + 100)
    expect(p.totalNovo).toBe(computeTotalFinal(17100, 20, 1.05))
    expect(p.diferenca).toBe(Math.round((p.totalNovo - 9000) * 100) / 100)
  })

  it('nome diferente no catálogo novo não aplica preço (igual ao banco)', () => {
    const p = previewRequote([items[0]], { '18592885|615 Wp - WEG BIFACIAL': 700 }, { total_final: 1 })
    expect(p.mudaram).toHaveLength(0)
    expect(p.itens[0].naLista).toBe(false)
  })
})
