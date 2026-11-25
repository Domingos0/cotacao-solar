import { describe, it, expect } from 'vitest'
import { round2, distributeTotal } from './money'

describe('round2', () => {
  it('arredonda .005 pra cima (sem erro de ponto flutuante)', () => {
    expect(round2(1.005)).toBe(1.01)
  })
})

// Protege a correção do item 23: a soma das linhas de uma tabela de itens
// precisa bater exatamente com o total final exibido, mesmo quando cada
// linha é preço de tabela × um fator único de desconto/frete.
describe('distributeTotal', () => {
  it('soma das linhas bate exatamente com o grandTotal', () => {
    const ratio = 0.814231 // fator típico de desconto+frete
    const raw = [100, 200, 300, 50.5, 999.99].map(v => v * ratio)
    const grandTotal = round2(raw.reduce((s, v) => s + v, 0))
    const result = distributeTotal(raw, grandTotal)
    const soma = result.reduce((s, v) => s + v, 0)
    expect(round2(soma)).toBe(grandTotal)
  })

  it('preserva null pra itens sem preço, sem afetar os outros', () => {
    const grandTotal = 150
    const result = distributeTotal([100, null, 50], grandTotal)
    expect(result[1]).toBe(null)
    expect(result[0] + result[2]).toBe(150)
  })

  it('joga o resíduo na última linha com valor (mesmo se vier null depois dela)', () => {
    const grandTotal = 99.97
    const result = distributeTotal([33.33, 33.33, 33.34, null], grandTotal)
    expect(result[3]).toBe(null)
    expect(round2(result[0] + result[1] + result[2])).toBe(grandTotal)
  })
})
