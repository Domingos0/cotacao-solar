import { describe, it, expect } from 'vitest'
import {
  extractPrevisaoDate, classifyStockLine, parseStockPdfLines,
  diasAtePrevisao, previsaoAlerta, produtosParaRevisar, textoAlertaPrevisao,
} from './stockForecast'

const HOJE = new Date(2026, 10, 27) // 27/11/2026

describe('leitura do PDF de disponibilidade', () => {
  it('extrai a data DD/MM/YYYY como ISO', () => {
    expect(extractPrevisaoDate('Indisponível 15/12/2026')).toBe('2026-12-15')
    expect(extractPrevisaoDate('sem data')).toBe(null)
  })
  it('classifica a linha e guarda a data da previsão', () => {
    expect(classifyStockLine('18592885 Painel Indisponível 15/12/2026')).toEqual({ status: 'Previsão', previsao: '2026-12-15' })
    expect(classifyStockLine('18575249 SIW400H Disponível (CD PE)')).toEqual({ status: 'Disponível', previsao: null })
    expect(classifyStockLine('123 Indisponível ***')).toEqual({ status: 'Esgotado', previsao: null })
    expect(classifyStockLine('123 Indisponível *')).toEqual({ status: 'Previsão', previsao: null })
  })
  it('só considera SAPs conhecidos e olha a linha de baixo quando precisa', () => {
    const r = parseStockPdfLines(['18592885 Painel 615W', 'Indisponível 10/01/2027', '99999999 Outro Disponível'], ['18592885'])
    expect(r).toEqual({ '18592885': { status: 'Previsão', previsao: '2027-01-10' } })
  })
})

describe('avisos de previsão', () => {
  it('conta os dias até a previsão', () => {
    expect(diasAtePrevisao('2026-11-30', HOJE)).toBe(3)
    expect(diasAtePrevisao('2026-11-20', HOJE)).toBe(-7)
  })
  it('vencida, hoje, próxima ou sem aviso', () => {
    expect(previsaoAlerta('2026-11-26', HOJE)).toBe('vencida')
    expect(previsaoAlerta('2026-11-27', HOJE)).toBe('hoje')
    expect(previsaoAlerta('2026-12-04', HOJE)).toBe('proxima')
    expect(previsaoAlerta('2026-12-05', HOJE)).toBe(null)
    expect(previsaoAlerta('', HOJE)).toBe(null)
  })
  it('lista só produtos em Previsão que precisam de revisão, vencidos primeiro', () => {
    const lista = produtosParaRevisar([
      { id: 1, estoque: 'Previsão', estoque_previsao: '2026-12-01' },
      { id: 2, estoque: 'Previsão', estoque_previsao: '2026-11-20' },
      { id: 3, estoque: 'Previsão', estoque_previsao: '2027-02-01' },
      { id: 4, estoque: 'Disponível', estoque_previsao: '2026-11-20' },
    ], HOJE)
    expect(lista.map(r => r.product.id)).toEqual([2, 1])
  })
  it('texto do aviso', () => {
    expect(textoAlertaPrevisao(-1)).toContain('venceu há 1 dia')
    expect(textoAlertaPrevisao(0)).toContain('hoje')
    expect(textoAlertaPrevisao(3)).toContain('3 dias')
  })
})
