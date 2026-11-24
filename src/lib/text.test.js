import { describe, it, expect } from 'vitest'
import { normalizeSearch } from './text'

// Protege a correção do item 11 (busca ignorando acentos) de regredir.
describe('normalizeSearch', () => {
  it('remove acentos e baixa caixa', () => {
    expect(normalizeSearch('São Paulo')).toBe('sao paulo')
    expect(normalizeSearch('Região Nordeste')).toBe('regiao nordeste')
  })

  it('texto sem acento já buscável encontra o acentuado', () => {
    expect(normalizeSearch('São Paulo').includes(normalizeSearch('sao paulo'))).toBe(true)
  })

  it('lida com undefined/null sem quebrar', () => {
    expect(normalizeSearch(undefined)).toBe('')
    expect(normalizeSearch(null)).toBe('')
  })
})
