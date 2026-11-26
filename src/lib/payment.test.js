import { describe, it, expect } from 'vitest'
import { CARTAO_PARCELAS, totalComCartao, valorParcela } from './payment'

describe('CARTAO_PARCELAS', () => {
  it('tem os 12 códigos informados, 1x a 12x', () => {
    expect(CARTAO_PARCELAS).toHaveLength(12)
    expect(CARTAO_PARCELAS.map(o => o.parcelas)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12])
  })
})

describe('totalComCartao', () => {
  it('6x aplica 1,0609 (6,09%) — exemplo dado pelo usuário', () => {
    expect(totalComCartao(10000, 6)).toBe(10609)
  })
  it('1x (CC01) aplica 2,91%, mesmo sendo só 1 parcela', () => {
    expect(totalComCartao(1000, 1)).toBe(1029.1)
  })
  it('12x aplica 12,95%', () => {
    expect(totalComCartao(10000, 12)).toBe(11295)
  })
  it('parcelas inválidas devolvem o total sem alteração (à vista)', () => {
    expect(totalComCartao(5000, null)).toBe(5000)
    expect(totalComCartao(5000, 13)).toBe(5000)
  })
})

describe('valorParcela', () => {
  it('divide o total com acréscimo pelo número de parcelas', () => {
    expect(valorParcela(10000, 6)).toBe(Math.round((10609 / 6) * 100) / 100)
  })
})
