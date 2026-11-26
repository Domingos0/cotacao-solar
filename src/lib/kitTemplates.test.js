import { describe, it, expect } from 'vitest'
import { sanitizeKitDataForTemplate } from './kitTemplates'

describe('sanitizeKitDataForTemplate', () => {
  it('remove os dados pessoais do cliente original', () => {
    const kitData = {
      clienteNome: 'Ana Paula', clienteUF: 'SP', clienteCidade: 'São Paulo',
      numero_orcamento: 'EFF-001', revisao: 2, revisoes: [{ revisao: 0 }],
      panel: { nome: 'Módulo X' }, panelQty: 9, kitType: 'ongrid_mono',
    }
    const clean = sanitizeKitDataForTemplate(kitData)
    expect(clean.clienteNome).toBeUndefined()
    expect(clean.numero_orcamento).toBeUndefined()
    expect(clean.revisoes).toBeUndefined()
  })

  it('mantém os dados estruturais do kit (módulo, inversor, acessórios)', () => {
    const kitData = {
      clienteNome: 'Ana Paula',
      panel: { nome: 'Módulo X' }, panelQty: 9,
      inverter: { nome: 'Inversor Y' }, kitType: 'ongrid_mono',
      wantsEstrutura: true, estruturaRoofType: 'Cerâmico',
    }
    const clean = sanitizeKitDataForTemplate(kitData)
    expect(clean.panel).toEqual({ nome: 'Módulo X' })
    expect(clean.panelQty).toBe(9)
    expect(clean.inverter).toEqual({ nome: 'Inversor Y' })
    expect(clean.kitType).toBe('ongrid_mono')
    expect(clean.wantsEstrutura).toBe(true)
    expect(clean.estruturaRoofType).toBe('Cerâmico')
  })

  it('não modifica o objeto original (retorna uma cópia)', () => {
    const kitData = { clienteNome: 'Ana Paula', panel: { nome: 'X' } }
    sanitizeKitDataForTemplate(kitData)
    expect(kitData.clienteNome).toBe('Ana Paula')
  })

  it('funciona com kitData vazio/indefinido', () => {
    expect(sanitizeKitDataForTemplate(undefined)).toEqual({})
    expect(sanitizeKitDataForTemplate({})).toEqual({})
  })
})
