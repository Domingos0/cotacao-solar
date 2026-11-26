import { describe, it, expect } from 'vitest'
import { calcEconomia } from './economia'

describe('calcEconomia', () => {
  it('calcula geração mensal, economia mensal/anual e payback', () => {
    const r = calcEconomia(5, 4.5, 0.95, 19625.17)
    expect(r.geracaoMensalKwh).toBe(675) // 5 * 4.5 * 30
    expect(r.economiaMensal).toBe(641.25) // 675 * 0.95
    expect(r.economiaAnual).toBe(7695) // 641.25 * 12
    expect(r.paybackAnos).toBeCloseTo(2.55, 1)
  })

  it('sem total do kit, payback é null', () => {
    const r = calcEconomia(5, 4.5, 0.95, 0)
    expect(r.paybackAnos).toBe(null)
  })

  it('sem potência, tudo fica zerado e payback é null', () => {
    const r = calcEconomia(0, 4.5, 0.95, 10000)
    expect(r.geracaoMensalKwh).toBe(0)
    expect(r.economiaMensal).toBe(0)
    expect(r.paybackAnos).toBe(null)
  })
})
