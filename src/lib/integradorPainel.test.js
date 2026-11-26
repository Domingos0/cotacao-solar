import { describe, it, expect } from 'vitest'
import { calcPainelIntegrador } from './integradorPainel'

const refMes = new Date('2026-11-15T12:00:00')

describe('calcPainelIntegrador', () => {
  it('soma kWp cotado (todas não-rascunho do mês) e kWp fechado (só status ganho)', () => {
    const quotes = [
      { created_at: '2026-11-05', status: 'em_analise', kwp: 5, total_final: 10000 },
      { created_at: '2026-11-10', status: 'fechado', kwp: 8, total_final: 20000 },
      { created_at: '2026-11-20', status: 'rascunho', kwp: 3, total_final: 5000 },
    ]
    const r = calcPainelIntegrador(quotes, refMes)
    expect(r.kwpCotado).toBe(13) // em_analise + fechado, não rascunho
    expect(r.kwpFechado).toBe(8)
    expect(r.qtdCotadas).toBe(2)
    expect(r.qtdFechadas).toBe(1)
  })

  it('ignora cotações de outros meses', () => {
    const quotes = [
      { created_at: '2026-10-05', status: 'fechado', kwp: 100, total_final: 100000 },
      { created_at: '2026-11-05', status: 'fechado', kwp: 5, total_final: 10000 },
    ]
    const r = calcPainelIntegrador(quotes, refMes)
    expect(r.kwpFechado).toBe(5)
  })

  it('não conta "perdida" como fechado', () => {
    const quotes = [{ created_at: '2026-11-05', status: 'perdida', kwp: 10, total_final: 20000 }]
    const r = calcPainelIntegrador(quotes, refMes)
    expect(r.kwpFechado).toBe(0)
    expect(r.kwpCotado).toBe(10) // perdida ainda conta como "cotado" (não é rascunho)
  })

  it('calcula a economia gerada só das cotações fechadas', () => {
    const quotes = [
      { created_at: '2026-11-05', status: 'fechado', kwp: 5, total_final: 10000, data: { panel: { potencia: 600 }, panelQty: 9, hsp: 4.5, tarifaEnergia: 0.95 } },
    ]
    const r = calcPainelIntegrador(quotes, refMes)
    expect(r.economiaGerada).toBeGreaterThan(0)
  })

  it('sem cotações no mês, tudo zerado', () => {
    const r = calcPainelIntegrador([], refMes)
    expect(r).toEqual({ kwpCotado: 0, kwpFechado: 0, totalCotado: 0, totalFechado: 0, economiaGerada: 0, qtdCotadas: 0, qtdFechadas: 0 })
  })
})
