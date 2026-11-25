import { describe, it, expect } from 'vitest'
import { normalizeSearch, normalizeSearchCompact } from './text'

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

  it('"hibrido" sem acento acha "Híbrido"', () => {
    expect(normalizeSearch('Inversor Híbrido').includes(normalizeSearch('hibrido'))).toBe(true)
  })

  it('espaços duplicados na busca não quebram o includes', () => {
    expect(normalizeSearch('Inversor Híbrido').includes(normalizeSearch('inversor  hibrido'))).toBe(false)
  })
})

// Protege a correção do item 18 (busca do catálogo tolerando espaço dentro
// de código de modelo, ex: "siw 300h" → "SIW300H").
describe('normalizeSearchCompact', () => {
  it('remove espaços além de acento e caixa', () => {
    expect(normalizeSearchCompact('SIW300H')).toBe('siw300h')
    expect(normalizeSearchCompact('siw 300h')).toBe('siw300h')
    expect(normalizeSearchCompact('siw   300h')).toBe('siw300h')
  })

  it('"siw 300h" compacto acha "SIW300H" compacto', () => {
    expect(normalizeSearchCompact('SIW300H M080 W00').includes(normalizeSearchCompact('siw 300h'))).toBe(true)
  })

  it('lida com undefined/null sem quebrar', () => {
    expect(normalizeSearchCompact(undefined)).toBe('')
    expect(normalizeSearchCompact(null)).toBe('')
  })
})
