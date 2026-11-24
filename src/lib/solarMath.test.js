import { describe, it, expect } from 'vitest'
import { sunPosition, estimateHorizonShadingLoss } from './solarMath'

// Pontos de referência conhecidos (astronomia pura) — os mesmos usados pra
// validar manualmente o algoritmo quando foi escrito (ver histórico desta
// sessão). Protege contra uma futura edição quebrar a convenção de azimute
// (já aconteceu uma vez: saía espelhado, Norte em vez de Sul no hemisfério
// norte, por faltar o deslocamento de 180° da fórmula NOAA).
describe('sunPosition', () => {
  it('Greenwich no solstício de verão, próximo do meio-dia solar: sol ao Sul, elevação ~61.9°', () => {
    const d = new Date(Date.UTC(2025, 5, 21, 12, 0))
    const { elevation, azimuth } = sunPosition(d, 51.5, 0)
    expect(elevation).toBeCloseTo(61.94, 1)
    expect(azimuth).toBeGreaterThan(170)
    expect(azimuth).toBeLessThan(190)
  })

  it('São Paulo no solstício de inverno, meio-dia local: sol ao Norte (hemisfério sul), elevação ~42.97°', () => {
    const d = new Date(Date.UTC(2025, 5, 21, 15, 0)) // 12h local (UTC-3)
    const { elevation, azimuth } = sunPosition(d, -23.55, -46.63)
    expect(elevation).toBeCloseTo(42.97, 1)
    expect(azimuth).toBeLessThan(15) // próximo de 0° (Norte)
  })

  it('manhã em São Paulo: sol a leste/nordeste, elevação baixa e positiva', () => {
    const d = new Date(Date.UTC(2025, 5, 21, 12, 0)) // 9h local
    const { elevation, azimuth } = sunPosition(d, -23.55, -46.63)
    expect(elevation).toBeGreaterThan(0)
    expect(elevation).toBeLessThan(45)
    expect(azimuth).toBeGreaterThan(30)
    expect(azimuth).toBeLessThan(90)
  })
})

describe('estimateHorizonShadingLoss', () => {
  it('sem perfil de horizonte, não há perda', () => {
    expect(estimateHorizonShadingLoss([], -23.55, -46.63)).toBe(0)
  })

  it('obstáculo cobrindo o céu inteiro (90° em todo azimute) bloqueia tudo', () => {
    const perfil = [{ azimuth: 0, elevation: 90 }, { azimuth: 360, elevation: 90 }]
    const perda = estimateHorizonShadingLoss(perfil, -23.55, -46.63)
    expect(perda).toBeCloseTo(100, 0)
  })

  it('obstáculo no horizonte (0° em todo azimute) não bloqueia nada', () => {
    const perfil = [{ azimuth: 0, elevation: 0 }, { azimuth: 360, elevation: 0 }]
    const perda = estimateHorizonShadingLoss(perfil, -23.55, -46.63)
    expect(perda).toBeCloseTo(0, 0)
  })
})
