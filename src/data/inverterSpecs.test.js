import { describe, it, expect } from 'vitest'
import { extractModelPowerKw, buildPowerSubtitle, getInverterSpecs } from './inverterSpecs'

describe('extractModelPowerKw', () => {
  it('extrai a potência do código do modelo (M080 → 8 kW)', () => {
    expect(extractModelPowerKw('SIW300H M080 W00')).toBe(8)
  })
  it('M050 → 5 kW', () => {
    expect(extractModelPowerKw('SIW300H M050 W00')).toBe(5)
  })
  it('M100 → 10 kW', () => {
    expect(extractModelPowerKw('SIW300H M100 W00')).toBe(10)
  })
  it('sem código M no nome, retorna null', () => {
    expect(extractModelPowerKw('SIW300H W00')).toBe(null)
  })
  it('nome vazio/undefined não quebra', () => {
    expect(extractModelPowerKw('')).toBe(null)
    expect(extractModelPowerKw(undefined)).toBe(null)
  })
})

describe('buildPowerSubtitle', () => {
  it('troca a faixa da linha pela potência específica do modelo', () => {
    const { main, line } = buildPowerSubtitle('Inversor Monofásico 3–10 kW', 8)
    expect(main).toBe('Inversor Monofásico 8 kW')
    expect(line).toBe('linha de 3 a 10 kW')
  })
  it('sem potência de modelo detectada, mantém o texto da linha sem alterar', () => {
    const { main, line } = buildPowerSubtitle('Inversor Monofásico 3–10 kW', null)
    expect(main).toBe('Inversor Monofásico 3–10 kW')
    expect(line).toBe(null)
  })
  it('texto sem faixa numérica de potência, devolve sem alterar', () => {
    const { main, line } = buildPowerSubtitle('Microinversor 1000 W', 1)
    expect(main).toBe('Microinversor 1000 W')
    expect(line).toBe(null)
  })
})

// Protege a correção do item 45: cada spec tem uma "linha" (ex: "SIW300H"),
// usada pra buscar o datasheet correto em inverter_datasheets.
describe('getInverterSpecs — campo linha', () => {
  it('SIW300H M080 W00 pertence à linha SIW300H', () => {
    expect(getInverterSpecs({ nome: 'SIW300H M080 W00' }).linha).toBe('SIW300H')
  })
  it('SIW200H (híbrido) pertence à linha SIW200H', () => {
    expect(getInverterSpecs({ nome: 'SIW200H' }).linha).toBe('SIW200H')
  })
  it('CFW500 pertence à linha CFW500', () => {
    expect(getInverterSpecs({ nome: 'CFW500 Solar Drive' }).linha).toBe('CFW500')
  })
})
