import { describe, it, expect } from 'vitest'
import { getKitTourId, KIT_STEP_TOURS } from './tour'

describe('getKitTourId', () => {
  it('mapeia os steps não-híbridos (sem bombeamento)', () => {
    expect(getKitTourId(1, {}, false)).toBe('kit_tipo')
    expect(getKitTourId(2, { kitType: 'ongrid_mono' }, false)).toBe('kit_dimensionamento')
    expect(getKitTourId(3, {}, false)).toBe('kit_modulos')
    expect(getKitTourId(4, {}, false)).toBe('kit_inversor')
    expect(getKitTourId(5, {}, false)).toBe('kit_acessorios')
    expect(getKitTourId(6, {}, false)).toBe('kit_resumo')
  })

  it('mapeia o step 2 de bombeamento pro tour específico da bomba', () => {
    expect(getKitTourId(2, { kitType: 'bombeamento' }, false)).toBe('kit_dimensionamento_bomb')
  })

  it('mapeia os steps híbridos (com etapa extra de Baterias)', () => {
    expect(getKitTourId(5, {}, true)).toBe('kit_baterias')
    expect(getKitTourId(6, {}, true)).toBe('kit_acessorios')
    expect(getKitTourId(7, {}, true)).toBe('kit_resumo')
  })

  it('step fora do range conhecido retorna null', () => {
    expect(getKitTourId(99, {}, false)).toBe(null)
  })

  it('todo id retornado tem um tour correspondente em KIT_STEP_TOURS', () => {
    const ids = [
      getKitTourId(1, {}, false), getKitTourId(2, { kitType: 'ongrid_mono' }, false),
      getKitTourId(2, { kitType: 'bombeamento' }, false), getKitTourId(3, {}, false),
      getKitTourId(4, {}, false), getKitTourId(5, {}, true), getKitTourId(6, {}, false),
      getKitTourId(6, {}, true), getKitTourId(7, {}, true),
    ]
    ids.forEach(id => expect(KIT_STEP_TOURS[id]).toBeTruthy())
  })
})
