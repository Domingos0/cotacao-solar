import { describe, it, expect } from 'vitest'
import { parseLocalDate, fmtLocalDate } from './dates'

describe('parseLocalDate', () => {
  it('data só-dia vira meia-noite local (não volta um dia no fuso do Brasil)', () => {
    const d = parseLocalDate('2026-11-29')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 29, 0])
    expect(fmtLocalDate('2026-11-29')).toBe('29/11/2026')
  })
  it('vazio vira null; Date passa direto', () => {
    expect(parseLocalDate(null)).toBe(null)
    const x = new Date()
    expect(parseLocalDate(x)).toBe(x)
  })
})
