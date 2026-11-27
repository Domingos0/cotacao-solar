import { describe, it, expect } from 'vitest'
import { getKitTourId, KIT_STEP_TOURS, markTourSeen, disableTours, areToursDisabled, shouldAutoShowTour } from './tour'

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

// localStorage simples pro ambiente de teste (node não tem)
if (!globalThis.localStorage) {
  const mem = {}
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v) }, removeItem: k => { delete mem[k] } }
}

describe('não mostrar mais / mostrar só uma vez', () => {
  it('desligar tutoriais bloqueia qualquer tour automático', () => {
    expect(shouldAutoShowTour('u-off', null, 'catalog')).toBe(true)
    disableTours('u-off')
    expect(shouldAutoShowTour('u-off', null, 'catalog')).toBe(false)
    expect(shouldAutoShowTour('u-off', null, 'kit-step-1')).toBe(false)
  })
  it('vale também pela conta (user_metadata), em outro aparelho', () => {
    expect(areToursDisabled('u-novo', { user_metadata: { tutorial_off: true } })).toBe(true)
    expect(shouldAutoShowTour('u-novo', { user_metadata: {} }, 'catalog')).toBe(true)
  })
  it('tour já visto não aparece de novo sozinho', () => {
    markTourSeen('u-visto', 'catalog')
    expect(shouldAutoShowTour('u-visto', null, 'catalog')).toBe(false)
  })
})
