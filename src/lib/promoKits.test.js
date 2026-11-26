import { describe, it, expect } from 'vitest'
import { getPromoStatus, calcPromoPreco } from './promoKits'

describe('getPromoStatus', () => {
  const hoje = new Date('2026-11-26T12:00:00')

  it('ativa quando falta mais de 7 dias pro fim', () => {
    const kit = { data_fim: '2026-12-10', data_fim_original: '2026-12-10' }
    expect(getPromoStatus(kit, hoje)).toEqual({ principal: 'ativa', prorrogada: false })
  })

  it('ultimos_7_dias quando faltam 7 dias ou menos', () => {
    const kit = { data_fim: '2026-12-03', data_fim_original: '2026-12-03' }
    expect(getPromoStatus(kit, hoje).principal).toBe('ultimos_7_dias')
  })

  it('ultimo_dia no dia do vencimento', () => {
    const kit = { data_fim: '2026-11-26', data_fim_original: '2026-11-26' }
    expect(getPromoStatus(kit, hoje).principal).toBe('ultimo_dia')
  })

  it('encerrada depois do fim', () => {
    const kit = { data_fim: '2026-11-20', data_fim_original: '2026-11-20' }
    expect(getPromoStatus(kit, hoje).principal).toBe('encerrada')
  })

  it('prorrogada quando data_fim foi estendida além da original', () => {
    const kit = { data_fim: '2026-12-10', data_fim_original: '2026-12-01' }
    expect(getPromoStatus(kit, hoje).prorrogada).toBe(true)
  })

  it('não prorrogada quando data_fim nunca mudou', () => {
    const kit = { data_fim: '2026-12-10', data_fim_original: '2026-12-10' }
    expect(getPromoStatus(kit, hoje).prorrogada).toBe(false)
  })
})

describe('calcPromoPreco', () => {
  const kit = { preco_homologado: 10000, desconto_pct: 5 }
  const regioes = { sul: { frete_valor: 300 }, nordeste: { frete_valor: 800 } }

  it('aplica o desconto e soma o frete da região do cliente', () => {
    expect(calcPromoPreco(kit, 'sul', regioes)).toBe(9800)
  })

  it('regiões diferentes dão preços diferentes (frete distinto)', () => {
    expect(calcPromoPreco(kit, 'nordeste', regioes)).toBe(10300)
  })

  it('sem região informada, não soma frete', () => {
    expect(calcPromoPreco(kit, null, regioes)).toBe(9500)
  })
})
