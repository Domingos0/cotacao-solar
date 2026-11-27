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

describe('informativo de estoque WEG — linhas reais dos PDFs', () => {
  // INFORMATIVO DE ESTOQUE (26.11.2026).pdf — formato novo ("Pronta Entrega"),
  // com status às vezes numa linha própria logo abaixo do produto
  const NOVO = [
    'Informe produtos Solar - Disponibilidade',
    'Material Produto Status Previsão',
    '18850285 MODULO SOLAR BI 610W 35mm BYD 🟢',
    'Pronta Entrega',
    '18592885 MODULO SOLAR BI 615W 30mm WEG 🟢 Pronta Entrega',
    '19192678 MODULO SOLAR MONO 620W 30mm LONGI 🟢 Pronta Entrega *',
    '18592887 MODULO SOLAR BI 620W 30mm WEG 🔴 Indisponível * 📅 01/12/2026',
    '17654306 INVERSOR SOLAR SIW400G K015 W00 🟢 Pronta Entrega',
    '17654550 INVERSOR SOLAR SIW400G K020 W00',
    '🟢 Pronta Entrega',
    '17117631 INVERSOR SOLAR SIW200G M060 W1 🔴 Indisponível 📅 18/01/2027',
    '*Estoque CD PE (Pernambuco).',
  ]
  // INFORMATIVO DE ESTOQUE (20.03.2026).pdf — formato antigo ("Disponível")
  const ANTIGO = [
    '18592809 MODULO SOLAR BI 580W 30mm WEG Disponível',
    '18923555 MODULO SOLAR BI 595W 30mm JA Indisponível ***',
    '19192683 MODULO SOLAR MONO 635W 30mm LONGI Indisponível 27/05/2026',
  ]
  const todos = lines => [...new Set(lines.map(l => (l.match(/^\s*(\d{8})/) || [])[1]).filter(Boolean))]

  it('formato novo: Pronta Entrega = Disponível, Indisponível + data = Previsão', () => {
    const r = parseStockPdfLines(NOVO, todos(NOVO))
    expect(r['18592885'].status).toBe('Disponível')
    expect(r['19192678'].status).toBe('Disponível') // * = CD PE, continua disponível
    expect(r['18592887']).toEqual({ status: 'Previsão', previsao: '2026-12-01' })
    expect(r['17117631']).toEqual({ status: 'Previsão', previsao: '2027-01-18' })
  })

  it('status numa linha própria logo abaixo é do produto de cima', () => {
    const r = parseStockPdfLines(NOVO, todos(NOVO))
    expect(r['18850285'].status).toBe('Disponível')
    expect(r['17654550'].status).toBe('Disponível')
    expect(Object.keys(r)).toHaveLength(7)
  })

  it('nunca pega o status do produto de baixo', () => {
    const r = parseStockPdfLines(['11111111 PRODUTO SEM STATUS', '22222222 OUTRO 🔴 Indisponível 📅 01/12/2026'], ['11111111', '22222222'])
    expect(r['11111111']).toBeUndefined()
    expect(r['22222222'].previsao).toBe('2026-12-01')
  })

  it('formato antigo continua funcionando', () => {
    const r = parseStockPdfLines(ANTIGO, todos(ANTIGO))
    expect(r['18592809'].status).toBe('Disponível')
    expect(r['18923555'].status).toBe('Esgotado')
    expect(r['19192683']).toEqual({ status: 'Previsão', previsao: '2026-05-27' })
  })
})
