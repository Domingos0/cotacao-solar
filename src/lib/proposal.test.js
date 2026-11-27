import { describe, it, expect } from 'vitest'
import { adjustItems, buildProposal, statsFromKitData, proposalFromQuote, proposalFileName } from './proposal'

describe('adjustItems', () => {
  it('aplica o fator do total final em cada linha e a soma bate com o total', () => {
    const items = [
      { label: 'Módulo', qty: 9, preco_unit: 1000, total: 9000 },
      { label: 'Inversor', qty: 1, preco_unit: 1000, total: 1000 },
    ]
    const r = adjustItems(items, 5000.01)
    expect(r[0].preco_unit).toBe(500)
    const soma = r.reduce((s, it) => s + it.total, 0)
    expect(Math.round(soma * 100) / 100).toBe(5000.01)
  })

  it('item sem preço (sob consulta) fica sem valor', () => {
    const r = adjustItems([{ label: 'Avulso', qty: 1, preco_unit: 0, total: 0 }, { label: 'Módulo', qty: 1, preco_unit: 100, total: 100 }], 80)
    expect(r[0].total).toBe(null)
    expect(r[1].total).toBe(80)
  })
})

describe('statsFromKitData', () => {
  it('monta potência, módulos, inversor híbrido e bateria', () => {
    const { kwp, stats } = statsFromKitData({
      panel: { potencia: 615 }, panelQty: 9,
      inverter: { nome: 'SIW200H M050 W00', potencia: 5 }, inverterQty: 1,
      wantsBattery: true, batEco: 'CB', batType: 'CB050', batQty: 1,
    })
    expect(kwp).toBe(5.54)
    expect(stats.map(s => s.label)).toEqual(['Potência', 'Módulos', 'Inversor', 'Bateria'])
    expect(stats[2].valor).toBe('5 kW híbrido')
    expect(stats[3].valor).toBe('5 kWh')
  })

  it('sem bateria, não mostra o quadro de bateria', () => {
    const { stats } = statsFromKitData({ panel: { potencia: 600 }, panelQty: 10, inverter: { nome: 'SIW200G M050', potencia: 5 } })
    expect(stats.find(s => s.label === 'Bateria')).toBeUndefined()
    expect(stats[2].valor).toBe('5 kW')
  })
})

describe('buildProposal', () => {
  it('validade padrão é 7 dias após a emissão quando não há valid_until', () => {
    const p = buildProposal({ emitidaEm: '2026-11-06T12:00:00', totalFinal: 100 })
    expect(p.validaAte.getDate()).toBe(13)
  })

  it('marca a parcela escolhida no cartão', () => {
    const p = buildProposal({ totalFinal: 19625.17, formaPagamento: 'cartao', parcelas: 6 })
    expect(p.opcaoCartao.parcelas).toBe(6)
    expect(p.opcaoCartao.valorParcela).toBeCloseTo(3470.06, 2)
    expect(p.cartao).toHaveLength(12)
  })

  it('à vista, nenhuma parcela fica marcada', () => {
    const p = buildProposal({ totalFinal: 1000 })
    expect(p.opcaoCartao).toBe(null)
    expect(p.formaPagamento).toBe('avista')
  })
})

describe('proposalFromQuote', () => {
  it('usa os itens e o total da revisão quando uma revisão é passada', () => {
    const quote = { total_final: 999, quote_items: [{ label: 'X', qty: 1, preco_unit: 999, total: 999 }], data: { numero_orcamento: 'EFF-1', revisao: 2 } }
    const revision = { revisao: 0, data: '2026-11-01', total_final: 500, frete: 'FOB', items: [{ label: 'Y', qty: 1, preco_unit: 500, total: 500 }] }
    const p = proposalFromQuote(quote, { revision })
    expect(p.revisao).toBe(0)
    expect(p.totalFinal).toBe(500)
    expect(p.itens[0].label).toBe('Y')
  })
})

describe('proposalFileName', () => {
  it('inclui número e revisão', () => {
    expect(proposalFileName({ numero: 'EFF-2026-202', revisao: 1 })).toBe('Proposta EFF-2026-202-R1.pdf')
  })
})

describe('proposalFromQuote — cliente final', () => {
  it('não repete o nome quando o cliente final é o próprio dono da cotação', () => {
    const quote = { total_final: 10, quote_items: [], profiles: { nome: 'Ana' }, data: { clienteNome: 'Ana' } }
    expect(proposalFromQuote(quote).referenciaCliente).toBe('')
    const q2 = { ...quote, data: { clienteNome: 'João' } }
    expect(proposalFromQuote(q2).referenciaCliente).toBe('João')
  })
})
