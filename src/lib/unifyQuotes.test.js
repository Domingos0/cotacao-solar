import { describe, it, expect } from 'vitest'
import { sumMaterialsBySap, buildUnifiedProposal } from './unifyQuotes'

describe('sumMaterialsBySap', () => {
  it('soma a quantidade e o total do mesmo SAP em kits diferentes', () => {
    const r = sumMaterialsBySap([
      [{ codigo_sap: '123', label: 'Módulo', produto: 'X', qty: 10, total: 1000 }],
      [{ codigo_sap: '123', label: 'Módulo', produto: 'X', qty: 5, total: 500 }],
    ])
    expect(r).toEqual([{ codigo_sap: '123', label: 'Módulo', produto: 'X', qty: 15, total: 1500 }])
  })

  it('mantém SAPs diferentes como linhas separadas', () => {
    const r = sumMaterialsBySap([
      [{ codigo_sap: '123', qty: 1, total: 10 }, { codigo_sap: '456', qty: 2, total: 20 }],
    ])
    expect(r).toHaveLength(2)
  })

  it('item sem codigo_sap usa label+produto como chave', () => {
    const r = sumMaterialsBySap([
      [{ codigo_sap: null, label: 'Avulso', produto: 'Serviço', qty: 1, total: 100 }],
      [{ codigo_sap: null, label: 'Avulso', produto: 'Serviço', qty: 1, total: 100 }],
    ])
    expect(r).toEqual([{ codigo_sap: null, label: 'Avulso', produto: 'Serviço', qty: 2, total: 200 }])
  })
})

describe('buildUnifiedProposal', () => {
  const quotes = [
    { total_final: 1000, kwp: 5, valid_until: '2026-12-10', quote_items: [{ codigo_sap: '1', qty: 1, total: 1000 }] },
    { total_final: 2000, kwp: 8, valid_until: '2026-12-05', quote_items: [{ codigo_sap: '1', qty: 1, total: 2000 }] },
  ]

  it('soma total e kWp de todas as cotações selecionadas', () => {
    const p = buildUnifiedProposal(quotes)
    expect(p.totalBruto).toBe(3000)
    expect(p.totalKwp).toBe(13)
  })

  it('aplica o desconto do pacote sobre o total bruto', () => {
    const p = buildUnifiedProposal(quotes, 10)
    expect(p.totalComDesconto).toBe(2700)
  })

  it('sem desconto, total com desconto é igual ao bruto', () => {
    const p = buildUnifiedProposal(quotes, 0)
    expect(p.totalComDesconto).toBe(p.totalBruto)
  })

  it('validade é a da cotação que vence primeiro', () => {
    const p = buildUnifiedProposal(quotes)
    expect(p.validadeMinima).toBe('2026-12-05')
  })

  it('consolida os materiais por SAP entre as cotações', () => {
    const p = buildUnifiedProposal(quotes)
    expect(p.materiais).toEqual([{ codigo_sap: '1', qty: 2, total: 3000 }])
  })

  it('sem cotações, retorna zeros e validade nula', () => {
    const p = buildUnifiedProposal([])
    expect(p).toEqual({ totalBruto: 0, totalComDesconto: 0, totalKwp: 0, materiais: [], validadeMinima: null, descontoPct: 0 })
  })
})
