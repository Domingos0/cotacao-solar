import { describe, it, expect } from 'vitest'
import { parseDatasheetName, parseProductModel, planDatasheetImport } from './datasheetImport'
import { getInverterSpecs } from '../data/inverterSpecs'

// Nomes reais do Datasheets_WEG_Inversores_Baterias.zip
const ARQUIVOS = [
  '200H_-_3_a_6K.pdf', '200H_-_7_a_10K.pdf', 'DATASHEET200G_M030_M060_W1_w.pdf',
  'DATASHEET_ACESSORIOS_JUNCTION_BOX_PT_web.pdf', 'DATASHEET_QUADRO_TRANSFERENCIA_SMARTGUARD_63A_T0_PT_web.pdf',
  'DATASHEET_QUADRO_TRANSFERENCIA_SMARTGUARD_PT_web.pdf', 'DATASHEET_SBW300_W00_PT_web.pdf',
  'DATASHEET_SBW_CB050_CB100_W00_PT_web.pdf', 'DATASHEET_SIW200G_M070_M075_M105_W1_PT_web.pdf',
  'DATASHEET_SIW200H_S075_S114_W20_PT_web.pdf', 'DATASHEET_SIW300H_M030_M050_M060_W00_web.pdf',
  'DATASHEET_SIW300_M080_M100_W00_PT_web.pdf', 'DATASHEET_SIW400G_T050_T075_W00_W01_web_R2.pdf',
  'DATASHEET_SIW400G__K025_K037_W00_web.pdf', 'DATASHEET_SIW400G__T010-T025__W0_PT_web.pdf',
  'DATASHEET_SIW400H__K007_T030_W20_PT_web.pdf', 'DATASHEET_SIW420G_K025_W00_PT_R4_web.pdf',
  'DATASHEET_SIW420G_K075_W00_PT_web_R02.pdf', 'DATASHEET_SIW500G_K075_W00_PT_web.pdf',
  'DATASHEET_SIW500G_T075_T100_W0_web.pdf', 'DATASHEET_SIW500H_T012_T025_W00_PT_R02.pdf',
  'DATASHEET_SIW_610-_T075_W0_web.pdf', 'DATASHEET_SIW_610__T018_W0_FINAME_BR.pdf',
  'Folha_de_Dados_-_Backup_Box.pdf', 'Folha_de_Dados_-_SIW500H_ST012.pdf',
  'Folha_de_Dados_-_SIW500H_ST015.pdf', 'Folha_de_Dados_-_SIW500H_ST020.pdf',
].map(name => ({ name }))

// Modelos de inversor do catálogo (src/data/products.js), com a potência que
// a regra de linha do SIW400G usa
const MODELOS = [
  'SIW100G M010 W00', 'SIW200G M050 W1', 'SIW200G M060 W1', 'SIW200G M075 W1', 'SIW200G M080 W1',
  'SIW200G M090 W1', 'SIW200G M105 W1', 'SIW200H M050 W00', 'SIW200H M075 W10', 'SIW200H M105 W10',
  'SIW300 M060 W00', 'SIW300 M080 W00', 'SIW300 M100 W00', 'SIW300H M030 W00', 'SIW300H M050 W00',
  'SIW300H M075 W00', 'SIW400G K015 W00', 'SIW400G K025 W00', 'SIW400G K037 W00', 'SIW400G T012 W1',
  'SIW400G T020 W1', 'SIW400G T025 W1', 'SIW400G T050 W00', 'SIW400G T075 W01', 'SIW400G T100 W0',
  'SIW400H T015 W10', 'SIW400H T030 W10', 'SIW420G K025 W00', 'SIW420G K075 W00', 'SIW500G T075 W00',
  'SIW500G T100 W0', 'SIW500H ST012 M2', 'SIW500H ST015 M2', 'SIW500H T020 W00', 'SIW500H ST030 M3', 'SIW610 T018 W0',
  'SIW610 T075 W0', 'CFW500 15',
]
const PRODUTOS = MODELOS.map((nome, i) => ({ id: `p${i}`, nome, potencia: parseProductModel(nome).kw || 0 }))
const linhaDe = p => getInverterSpecs(p)?.linha || null

describe('parseDatasheetName', () => {
  it('reconhece série e faixa nos formatos do zip', () => {
    expect(parseDatasheetName('200H_-_3_a_6K.pdf')).toMatchObject({ serie: 'SIW200H', kw: { min: 3, max: 6 } })
    expect(parseDatasheetName('DATASHEET200G_M030_M060_W1_w.pdf')).toMatchObject({ serie: 'SIW200G', range: { p: 'M', min: 30, max: 60 } })
    expect(parseDatasheetName('DATASHEET_SIW400G__T010-T025__W0_PT_web.pdf')).toMatchObject({ serie: 'SIW400G', range: { p: 'T', min: 10, max: 25 } })
    expect(parseDatasheetName('DATASHEET_SIW_610__T018_W0_FINAME_BR.pdf')).toMatchObject({ serie: 'SIW610' })
    expect(parseDatasheetName('DATASHEET_SIW300_M080_M100_W00_PT_web.pdf').serie).toBe('SIW300')
    expect(parseDatasheetName('DATASHEET_SBW300_W00_PT_web.pdf').serie).toBe(null)
    expect(parseDatasheetName('Folha_de_Dados_-_Backup_Box.pdf').serie).toBe(null)
  })
})

describe('planDatasheetImport com o zip real', () => {
  const plano = planDatasheetImport(ARQUIVOS, PRODUTOS, linhaDe)
  const linha = l => plano.linhas.find(x => x.linha === l)?.file.name
  const modelo = nome => plano.modelos.find(m => m.product.nome === nome)?.file.name

  it('escolhe o PDF padrão de cada linha', () => {
    expect(linha('SIW200H')).toBe('200H_-_7_a_10K.pdf')
    expect(linha('SIW300H')).toBe('DATASHEET_SIW300H_M030_M050_M060_W00_web.pdf')
    expect(linha('SIW400G')).toBe('DATASHEET_SIW400G__T010-T025__W0_PT_web.pdf')
    expect(linha('SIW400H')).toBe('DATASHEET_SIW400H__K007_T030_W20_PT_web.pdf')
    expect(linha('SIW500H')).toBe('DATASHEET_SIW500H_T012_T025_W00_PT_R02.pdf')
    expect(linha('SIW610')).toBe('DATASHEET_SIW_610-_T075_W0_web.pdf')
    expect(linha('SIW100G')).toBeUndefined()
    expect(linha('CFW500')).toBeUndefined()
  })

  it('modelos que precisam de PDF próprio', () => {
    expect(modelo('SIW200H M050 W00')).toBe('200H_-_3_a_6K.pdf')
    expect(modelo('SIW300 M080 W00')).toBe('DATASHEET_SIW300_M080_M100_W00_PT_web.pdf')
    expect(modelo('SIW400G K025 W00')).toBe('DATASHEET_SIW400G__K025_K037_W00_web.pdf')
    expect(modelo('SIW400G T075 W01')).toBe('DATASHEET_SIW400G_T050_T075_W00_W01_web_R2.pdf')
    expect(modelo('SIW420G K075 W00')).toBe('DATASHEET_SIW420G_K075_W00_PT_web_R02.pdf')
    expect(modelo('SIW500G T100 W0')).toBe('DATASHEET_SIW500G_T075_T100_W0_web.pdf')
    expect(modelo('SIW500H ST012 M2')).toBe('Folha_de_Dados_-_SIW500H_ST012.pdf')
    expect(modelo('SIW610 T018 W0')).toBe('DATASHEET_SIW_610__T018_W0_FINAME_BR.pdf')
    // já coberto pelo PDF padrão da linha → sem override
    expect(modelo('SIW400G T020 W1')).toBeUndefined()
    expect(modelo('SIW610 T075 W0')).toBeUndefined()
    // folha do ST020 não serve pro T020 (modelos diferentes) → fica com o PDF da linha
    expect(modelo('SIW500H T020 W00')).toBeUndefined()
  })

  it('funciona com File de verdade (nome num getter, não propriedade própria)', () => {
    class FakeFile { constructor(n) { this._n = n } get name() { return this._n } }
    const p = planDatasheetImport(ARQUIVOS.map(f => new FakeFile(f.name)), PRODUTOS, linhaDe)
    expect(p.linhas.find(x => x.linha === 'SIW610').file.name).toBe('DATASHEET_SIW_610-_T075_W0_web.pdf')
    expect(p.modelos.length).toBe(plano.modelos.length)
  })

  it('baterias/acessórios ficam de fora com o motivo', () => {
    const ign = plano.ignorados.map(i => i.file.name)
    expect(ign).toContain('DATASHEET_SBW300_W00_PT_web.pdf')
    expect(ign).toContain('Folha_de_Dados_-_Backup_Box.pdf')
    expect(plano.ignorados.find(i => i.file.name === 'Folha_de_Dados_-_Backup_Box.pdf').motivo).toBe('não é datasheet de inversor')
  })
})
