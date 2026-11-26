import { describe, it, expect } from 'vitest'
import { extractQuoteSummary } from './compareQuotes'

describe('extractQuoteSummary', () => {
  it('extrai módulo e inversor a partir dos itens pelo rótulo', () => {
    const quote = {
      id: 'abc12345',
      kwp: 5.4,
      total_final: 10000,
      frete_nome: 'CIF Sul',
      valid_until: '2026-12-10',
      status: 'em_analise',
      data: { clienteNome: 'Ana Paula', numero_orcamento: 'EFF-001', formaPagamento: 'avista' },
      quote_items: [
        { label: 'Módulo Fotovoltaico', produto: '615 Wp WEG Bifacial', qty: 9 },
        { label: 'Inversor Solar', produto: 'SIW200H M050 W00', qty: 1 },
      ],
    }
    const s = extractQuoteSummary(quote)
    expect(s.modulo).toBe('9× 615 Wp WEG Bifacial')
    expect(s.inversor).toBe('1× SIW200H M050 W00')
    expect(s.numero).toBe('EFF-001')
    expect(s.cliente).toBe('Ana Paula')
  })

  it('sem numero_orcamento, usa os 8 primeiros caracteres do id em maiúsculo', () => {
    const quote = { id: 'abc12345-xyz', data: {}, quote_items: [] }
    expect(extractQuoteSummary(quote).numero).toBe('ABC12345')
  })

  it('calcula o valor da parcela quando a forma de pagamento é cartão', () => {
    const quote = {
      total_final: 10000,
      data: { formaPagamento: 'cartao', parcelasCartao: 6 },
      quote_items: [],
    }
    const s = extractQuoteSummary(quote)
    expect(s.valorParcela).toBeGreaterThan(10000 / 6) // tem acréscimo do cartão
  })

  it('à vista, valorParcela é null', () => {
    const quote = { total_final: 10000, data: { formaPagamento: 'avista' }, quote_items: [] }
    expect(extractQuoteSummary(quote).valorParcela).toBe(null)
  })
})
