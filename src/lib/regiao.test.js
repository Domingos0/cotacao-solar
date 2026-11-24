import { describe, it, expect } from 'vitest'
import { regiaoFromUF, detectUF, isNordestePanel } from './regiao'

describe('regiaoFromUF', () => {
  it('classifica Maranhão como Nordeste (não Norte, apesar da proximidade geográfica comum de confundir)', () => {
    expect(regiaoFromUF('MA')).toBe('nordeste')
  })
  it('UF inválida retorna null', () => {
    expect(regiaoFromUF('XX')).toBe(null)
    expect(regiaoFromUF(null)).toBe(null)
  })
})

describe('detectUF', () => {
  it('extrai a UF do final da string', () => {
    expect(detectUF('São Paulo - SP')).toBe('SP')
    expect(detectUF('Manaus / AM')).toBe('AM')
  })
  it('sem UF reconhecível retorna null', () => {
    expect(detectUF('Cidade Qualquer')).toBe(null)
  })
})

describe('isNordestePanel', () => {
  it('reconhece painel CD Nordeste pelo nome', () => {
    expect(isNordestePanel({ nome: '625 Wp - JA BIFACIAL [CD Nordeste]' })).toBe(true)
  })
  it('painel comum não é CD Nordeste', () => {
    expect(isNordestePanel({ nome: '615 Wp - WEG BIFACIAL' })).toBe(false)
  })
})
