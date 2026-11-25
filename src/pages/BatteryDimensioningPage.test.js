import { describe, it, expect } from 'vitest'
import { KITS_PADRAO, EQUIP_PRESETS, newItem, itemEnergiaDiaria } from './BatteryDimensioningPage'

// Protege a correção do item 8b: as cargas críticas de um preset não podem
// somar mais energia por dia do que o consumo diário médio do próprio
// preset (kwh/mês ÷ 30) — isso seria fisicamente impossível (cargas
// "críticas" são um SUBCONJUNTO do consumo total). Antes, geladeira/freezer
// modelados como potência×24h (compressor sempre ligado) estourava esse
// limite no preset "Casa média".
describe('KITS_PADRAO — energia crítica dentro do consumo diário', () => {
  for (const kit of KITS_PADRAO) {
    it(`${kit.nome}: energia crítica diária <= consumo diário médio`, () => {
      const items = kit.itens.map(it => {
        const base = EQUIP_PRESETS.find(p => p.nome === it.nome)
        return newItem({ ...base, qty: it.qty })
      })
      const energiaCriticaDiaria = items.reduce((s, it) => s + itemEnergiaDiaria(it), 0)
      const energiaDiariaMedia = kit.kwh / 30
      expect(energiaCriticaDiaria).toBeLessThanOrEqual(energiaDiariaMedia)
    })
  }
})

describe('itemEnergiaDiaria', () => {
  it('geladeira usa o consumo médio real (kwhDia), não potência×24h', () => {
    const geladeira = newItem(EQUIP_PRESETS.find(p => p.nome === 'Geladeira'))
    expect(itemEnergiaDiaria(geladeira)).toBe(1.3)
  })

  it('item sem kwhDia usa potência × horas ativas, como antes', () => {
    const tv = newItem(EQUIP_PRESETS.find(p => p.nome === 'TV')) // 100W, 4h
    expect(itemEnergiaDiaria(tv)).toBeCloseTo(0.4, 5)
  })

  it('multiplica pela quantidade', () => {
    const geladeira = newItem({ ...EQUIP_PRESETS.find(p => p.nome === 'Geladeira'), qty: 2 })
    expect(itemEnergiaDiaria(geladeira)).toBeCloseTo(2.6, 5)
  })
})
