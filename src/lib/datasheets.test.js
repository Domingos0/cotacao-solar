import { describe, it, expect } from 'vitest'
import { getDatasheetLinha, resolveDatasheetUrl, datasheetsForEquipamentos } from './datasheets'

describe('getDatasheetLinha', () => {
  it('identifica a linha pelo nome do produto', () => {
    expect(getDatasheetLinha({ nome: 'SIW300H M080 W00' })).toBe('SIW300H')
  })
  it('produto sem linha reconhecida retorna null', () => {
    expect(getDatasheetLinha({ nome: 'Cabo CC Vermelho 6mm²' })).toBe(null)
  })
})

describe('resolveDatasheetUrl', () => {
  const datasheetsByLinha = { SIW300H: 'https://exemplo.com/siw300h.pdf' }

  it('usa o link da linha quando o produto não tem override', () => {
    const url = resolveDatasheetUrl({ nome: 'SIW300H M080 W00' }, datasheetsByLinha)
    expect(url).toBe('https://exemplo.com/siw300h.pdf')
  })

  it('prioriza o link específico do produto (override) sobre o da linha', () => {
    const url = resolveDatasheetUrl({ nome: 'SIW300H M080 W00', datasheetUrl: 'https://exemplo.com/especifico.pdf' }, datasheetsByLinha)
    expect(url).toBe('https://exemplo.com/especifico.pdf')
  })

  it('sem linha reconhecida e sem override, retorna null', () => {
    expect(resolveDatasheetUrl({ nome: 'Cabo CC Vermelho 6mm²' }, datasheetsByLinha)).toBe(null)
  })

  it('linha reconhecida mas sem entrada na tabela, retorna null', () => {
    expect(resolveDatasheetUrl({ nome: 'SIW610' }, datasheetsByLinha)).toBe(null)
  })
})

describe('datasheetsForEquipamentos', () => {
  const byLinha = { SIW200G: 'https://x/linha-200g.pdf' }
  it('usa o PDF próprio do modelo no catálogo atual antes do PDF da linha', () => {
    const products = [{ nome: 'SIW200G M050 W1', codigo: '1', datasheetUrl: 'https://x/m050.pdf' }]
    expect(datasheetsForEquipamentos([{ nome: 'SIW200G M050 W1', codigo: '1' }], products, byLinha)[0].url).toBe('https://x/m050.pdf')
  })
  it('sem PDF próprio, usa o da linha; sem nenhum, não lista', () => {
    const r = datasheetsForEquipamentos([{ nome: 'SIW200G M075 W1', codigo: '9' }, { nome: 'Coisa X', codigo: '8' }], [], byLinha)
    expect(r).toEqual([{ nome: 'SIW200G M075 W1', url: 'https://x/linha-200g.pdf', repetido: false }])
  })
})
