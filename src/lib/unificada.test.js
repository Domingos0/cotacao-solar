import { describe, it, expect } from 'vitest'
import { isUnificada, unificadaAtiva, numerosOrigem, textoFechamento, textoCancelada } from './unificada'

const U = { id: 'u', status: 'enviada', data: { unificada: true, numero_orcamento: 'EFF-2026-260', origem: [{ id: 'a', numero: 'EFF-2026-249' }, { id: 'b', numero: 'EFF-2026-242' }] } }
const A = { id: 'a', status: 'enviada', data: { numero_orcamento: 'EFF-2026-249', unificadaEm: { id: 'u', numero: 'EFF-2026-260' } } }

describe('proposta unificada salva', () => {
  it('identifica a unificada e as cotações de origem', () => {
    expect(isUnificada(U)).toBe(true)
    expect(isUnificada(A)).toBe(false)
    expect(numerosOrigem(U)).toEqual(['EFF-2026-249', 'EFF-2026-242'])
  })
  it('"faz parte da" só enquanto a unificada vale', () => {
    expect(unificadaAtiva(A, [U, A])).toEqual({ id: 'u', numero: 'EFF-2026-260' })
    expect(unificadaAtiva(A, [{ ...U, status: 'perdida' }, A])).toBe(null)
    expect(unificadaAtiva({ id: 'x', data: {} }, [U])).toBe(null)
  })
  it('textos de fechamento', () => {
    expect(textoFechamento({ data: { fechamento: { tipo: 'unificada', numero: 'EFF-2026-260', junto: ['EFF-2026-242'] } } }))
      .toBe('Fechada na proposta unificada EFF-2026-260 (junto com EFF-2026-242)')
    expect(textoFechamento({ data: { fechamento: { tipo: 'unitario' } } })).toBe('Fechada sozinha')
    expect(textoFechamento({ ...U, data: { ...U.data, fechamento: { tipo: 'unificada_principal' } } }))
      .toBe('Proposta unificada fechada — EFF-2026-249, EFF-2026-242 fecharam juntas')
    expect(textoFechamento({ data: {} })).toBe(null)
  })
  it('texto de unificada cancelada', () => {
    expect(textoCancelada({ data: { cancelada: { motivo: 'EFF-2026-249 foi fechada sozinha' } } })).toContain('EFF-2026-249 foi fechada sozinha')
    expect(textoCancelada({ data: {} })).toBe(null)
  })
})
