import { describe, it, expect } from 'vitest'
import { sumMaterialsBySap, buildUnifiedProposal, checkUnifyCnpj, groupQuotesByClient } from './unifyQuotes'

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

describe('checkUnifyCnpj', () => {
  const q = (id, cnpj) => ({ id, profiles: { cnpj }, data: { numero_orcamento: `EFF-${id}` } })
  it('mesmo CNPJ (com ou sem pontuação) pode unificar', () => {
    expect(checkUnifyCnpj([q('1', '12.345.678/0001-90'), q('2', '12345678000190')]).ok).toBe(true)
  })
  it('CNPJs diferentes não unificam', () => {
    expect(checkUnifyCnpj([q('1', '12.345.678/0001-90'), q('2', '98.765.432/0001-10')])).toMatchObject({ ok: false, motivo: 'cnpj_diferente' })
  })
  it('cotação interna pra cliente sem cadastro conta como sem CNPJ (o perfil é do admin)', () => {
    const interna = { id: '3', profiles: { cnpj: '12.345.678/0001-90' }, data: { numero_orcamento: 'EFF-3', clienteCadastrado: false } }
    expect(checkUnifyCnpj([q('1', '12.345.678/0001-90'), interna])).toMatchObject({ ok: false, motivo: 'sem_cnpj', refs: ['EFF-3'] })
  })
  it('cotação sem CNPJ não unifica e diz qual é', () => {
    expect(checkUnifyCnpj([q('1', '12.345.678/0001-90'), q('2', '')])).toEqual({ ok: false, motivo: 'sem_cnpj', refs: ['EFF-2'] })
  })
})

describe('groupQuotesByClient', () => {
  const q = (id, cnpj, created_at, extra = {}) => ({ id, user_id: `u${id}`, total_final: 100, kwp: 5, created_at, profiles: { nome: `Cliente ${cnpj}`, cnpj }, data: {}, ...extra })
  it('agrupa pelo CNPJ (mesmo CNPJ em usuários diferentes cai junto) e soma total/kWp', () => {
    const g = groupQuotesByClient([
      q('1', '12.345.678/0001-90', '2026-11-01'),
      q('2', '12345678000190', '2026-11-20'),
      q('3', '98.765.432/0001-10', '2026-11-10'),
    ])
    expect(g).toHaveLength(2)
    expect(g[0].quotes.map(x => x.id)).toEqual(['2', '1'])
    expect(g[0].total).toBe(200)
    expect(g[0].kwp).toBe(10)
  })
  it('cotação interna pra cliente sem cadastro agrupa pelo nome digitado', () => {
    const interna = (id) => q(id, '11.111.111/0001-11', '2026-11-05', { data: { clienteCadastrado: false, clienteNome: 'Maria' } })
    const g = groupQuotesByClient([interna('a'), interna('b')])
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ nome: 'Maria', semCadastro: true, cnpj: '' })
  })
})
