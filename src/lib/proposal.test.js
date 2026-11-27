import { describe, it, expect } from 'vitest'
import { adjustItems, buildProposal, statsFromKitData, proposalFromQuote, proposalFileName, proposalFromUnified } from './proposal'

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

describe('proposalFromUnified', () => {
  const kitEstrutura = { wantsEstrutura: true, estruturaKit: { codigo: '17930198', nome: 'Fibrometálico' }, estruturaQty: 2 }
  const quotes = [
    { id: 'a', kwp: 5.54, total_final: 20000, data: { numero_orcamento: 'EFF-1', clienteNome: 'Maria', panel: { potencia: 615 }, panelQty: 9, ...kitEstrutura } },
    { id: 'b', kwp: 7.2, total_final: 30000, data: { numero_orcamento: 'EFF-2', revisao: 1, panel: { potencia: 720 }, panelQty: 10, ...kitEstrutura } },
  ]
  const unified = { totalKwp: 12.74, totalBruto: 50000, totalComDesconto: 50000, descontoPct: 0, materiais: [], validadeMinima: null }

  it('usa o perfil de quem está logado quando a cotação não traz o dono', () => {
    const p = proposalFromUnified(quotes, unified, { ownerProfile: { nome: 'Ana', cnpj: '12.345.678/0001-90' } })
    expect(p.cliente).toMatchObject({ nome: 'Ana', cnpj: '12.345.678/0001-90' })
    expect(p.referenciaCliente).toBe('Maria')
  })

  it('lista os kits unificados com número, resumo e valor', () => {
    const p = proposalFromUnified(quotes, unified, {})
    expect(p.kitsUnificados.map(k => k.numero)).toEqual(['EFF-1', 'EFF-2'])
    expect(p.kitsUnificados[0].resumo).toContain('9 × 615 Wp')
    expect(p.kitsUnificados[1]).toMatchObject({ revisao: 1, total: 30000 })
  })

  it('soma a composição de estrutura dos kits', () => {
    const p = proposalFromUnified(quotes, unified, {})
    const umKit = proposalFromQuote({ data: quotes[0].data, total_final: 1, quote_items: [] })
    const c0 = umKit.estrutura.componentes[0]
    expect(p.estrutura.componentes.find(c => c.sap === c0.sap).qty).toBe(c0.qty * 2)
  })
})

describe('economia na proposta', () => {
  it('usa a tarifa e as horas de sol do kit', () => {
    const p = buildProposal({ kitData: { panel: { potencia: 600 }, panelQty: 10, hsp: 5, tarifaEnergia: 1 }, totalFinal: 18000 })
    expect(p.economia).toMatchObject({ hsp: 5, tarifa: 1, geracaoMensalKwh: 900, economiaMensal: 900 })
    expect(p.economia.paybackAnos).toBeCloseTo(1.67, 2)
  })
  it('sem kWp não mostra economia', () => {
    expect(buildProposal({ totalFinal: 100 }).economia).toBe(null)
  })
})

describe('equipamentos da proposta', () => {
  it('lista os inversores do kit sem repetir', () => {
    const p = buildProposal({ kitData: { inverters: [{ inverter: { nome: 'SIW200G M050 W1', codigo: '1' } }, { inverter: { nome: 'SIW200G M050 W1', codigo: '1' } }, { inverter: { nome: 'SIW300H M030', codigo: '2' } }] }, totalFinal: 1 })
    expect(p.equipamentos.map(e => e.codigo)).toEqual(['1', '2'])
  })
})

describe('proposalFromQuote — unificada salva', () => {
  it('usa a apresentação gravada (kits incluídos, desconto do pacote, estrutura)', () => {
    const quote = {
      id: 'u', kwp: 17.36, total_final: 36104.55, valid_until: '2026-12-01', frete_nome: 'CIF', quote_items: [{ label: 'Módulo', produto: 'X', codigo_sap: '1', qty: 28, preco_unit: 650, total: 18200 }],
      profiles: { nome: 'Manoel', cnpj: '32.668.251/0001-35' },
      data: {
        numero_orcamento: 'EFF-2026-260', unificada: true, revisao: 0,
        descontoPacote: { pct: 5, bruto: 38004.79 },
        origem: [{ numero: 'EFF-2026-249', kwp: 9.3, total: 24784.48 }, { numero: 'EFF-2026-242', kwp: 8.06, total: 13220.31 }],
        apresentacao: { titulo: '2 kits · 17,36 kWp', kitsUnificados: [{ numero: 'EFF-2026-249', resumo: 'a', total: 24784.48 }, { numero: 'EFF-2026-242', resumo: 'b', total: 13220.31 }], estrutura: { nome: 'Fibro', componentes: [{ sap: '9', descricao: 'Perfil', qty: 4 }] } },
      },
    }
    const p = proposalFromQuote(quote)
    expect(p.numero).toBe('EFF-2026-260')
    expect(p.kitsUnificados).toHaveLength(2)
    expect(p.descontoPacote).toEqual({ pct: 5, bruto: 38004.79 })
    expect(p.estrutura.componentes[0].qty).toBe(4)
    expect(p.totalFinal).toBe(36104.55)
  })
  it('sem apresentação gravada, monta os kits a partir da origem', () => {
    const p = proposalFromQuote({ kwp: 2, total_final: 10, quote_items: [], data: { unificada: true, origem: [{ numero: 'A', kwp: 1, total: 5 }, { numero: 'B', kwp: 1, total: 5 }] } })
    expect(p.kitsUnificados.map(k => k.numero)).toEqual(['A', 'B'])
  })
})
