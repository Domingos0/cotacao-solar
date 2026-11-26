import { describe, it, expect } from 'vitest'
import { diffRevisions } from './revisionDiff'

describe('diffRevisions', () => {
  const revA = {
    revisao: 0,
    total_final: 10000,
    frete: 'FOB',
    items: [
      { codigo_sap: '111', label: 'Módulo', qty: 10, preco_unit: 500, total: 5000 },
      { codigo_sap: '222', label: 'Inversor', qty: 1, preco_unit: 5000, total: 5000 },
    ],
  }
  const revB = {
    revisao: 1,
    total_final: 11000,
    frete: 'Sul',
    items: [
      { codigo_sap: '111', label: 'Módulo', qty: 12, preco_unit: 500, total: 6000 },
      { codigo_sap: '222', label: 'Inversor', qty: 1, preco_unit: 5000, total: 5000 },
      { codigo_sap: '333', label: 'Bateria', qty: 1, preco_unit: 3000, total: 3000 },
    ],
  }

  it('marca item com quantidade/preço diferente como changed', () => {
    const { items } = diffRevisions(revA, revB)
    const modulo = items.find(i => i.key === '111')
    expect(modulo.status).toBe('changed')
  })

  it('marca item igual nas duas revisões como same', () => {
    const { items } = diffRevisions(revA, revB)
    const inversor = items.find(i => i.key === '222')
    expect(inversor.status).toBe('same')
  })

  it('marca item novo (só na revisão B) como added', () => {
    const { items } = diffRevisions(revA, revB)
    const bateria = items.find(i => i.key === '333')
    expect(bateria.status).toBe('added')
  })

  it('marca item removido (só na revisão A) como removed', () => {
    const { items } = diffRevisions(revB, revA)
    const bateria = items.find(i => i.key === '333')
    expect(bateria.status).toBe('removed')
  })

  it('calcula a diferença de total e detecta troca de frete', () => {
    const d = diffRevisions(revA, revB)
    expect(d.totalDelta).toBe(1000)
    expect(d.freteChanged).toBe(true)
  })
})
