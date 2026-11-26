import { describe, it, expect } from 'vitest'
import { pathForPage, pageFromPath } from './routing'

describe('pathForPage', () => {
  it('mapeia cada página pro seu próprio endereço', () => {
    expect(pathForPage('catalog')).toBe('/catalogo')
    expect(pathForPage('kit')).toBe('/montar-kit')
    expect(pathForPage('admin')).toBe('/admin')
  })

  it('com id de cotação, aponta pro endereço daquela cotação específica', () => {
    expect(pathForPage('cotacoes', 'abc-123')).toBe('/minhas-cotacoes/abc-123')
  })

  it('sem id, aponta só pra lista', () => {
    expect(pathForPage('cotacoes')).toBe('/minhas-cotacoes')
  })

  it('página desconhecida cai no catálogo', () => {
    expect(pathForPage('pagina-que-nao-existe')).toBe('/catalogo')
  })
})

describe('pageFromPath', () => {
  it('reconhece cada endereço de tela', () => {
    expect(pageFromPath('/montar-kit')).toEqual({ page: 'kit', quoteId: null })
    expect(pageFromPath('/admin')).toEqual({ page: 'admin', quoteId: null })
  })

  it('reconhece o endereço de uma cotação específica', () => {
    expect(pageFromPath('/minhas-cotacoes/abc-123')).toEqual({ page: 'cotacoes', quoteId: 'abc-123' })
  })

  it('ignora barra final', () => {
    expect(pageFromPath('/montar-kit/')).toEqual({ page: 'kit', quoteId: null })
  })

  it('raiz ou endereço desconhecido cai no catálogo', () => {
    expect(pageFromPath('/')).toEqual({ page: 'catalog', quoteId: null })
    expect(pageFromPath('/isso-nao-existe')).toEqual({ page: 'catalog', quoteId: null })
  })

  it('é o inverso de pathForPage pra cada página', () => {
    Object.keys({ catalog: 1, kit: 1, promocoes: 1, cotacoes: 1, dimensionamento: 1, admin: 1 }).forEach(page => {
      expect(pageFromPath(pathForPage(page)).page).toBe(page)
    })
  })
})
