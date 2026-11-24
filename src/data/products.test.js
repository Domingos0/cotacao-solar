import { describe, it, expect } from 'vitest'
import { effectiveEstoque } from './products'

// Protege a correção do item 4 (previsão de entrega vencida continuando a
// bloquear/aparecer pro cliente como se fosse válida) de regredir.
describe('effectiveEstoque', () => {
  it('produto disponível continua disponível', () => {
    expect(effectiveEstoque({ estoque: 'Disponível' })).toBe('Disponível')
  })

  it('sem campo estoque, assume Disponível', () => {
    expect(effectiveEstoque({})).toBe('Disponível')
  })

  it('esgotado continua esgotado (não depende de data)', () => {
    expect(effectiveEstoque({ estoque: 'Esgotado' })).toBe('Esgotado')
  })

  it('previsão com data futura continua como Previsão', () => {
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    expect(effectiveEstoque({ estoque: 'Previsão', estoque_previsao: amanha })).toBe('Previsão')
  })

  it('previsão com data passada vira Disponível de novo', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(effectiveEstoque({ estoque: 'Previsão', estoque_previsao: ontem })).toBe('Disponível')
  })

  it('previsão sem data nenhuma (nunca preenchida) mantém Previsão', () => {
    expect(effectiveEstoque({ estoque: 'Previsão', estoque_previsao: null })).toBe('Previsão')
  })
})
