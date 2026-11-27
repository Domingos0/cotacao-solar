// Arredondamento de centavos à prova de erro de ponto flutuante
// (Math.round(1.005*100)/100 dá 1.00, errado; isso dá 1.01, certo).
export function round2(v) {
  return Number(Math.round(Number(String(+v) + 'e2')) + 'e-2')
}

// Distribui um total já fechado (grandTotal) pelas linhas de uma tabela,
// quando cada linha também precisa mostrar "seu" valor — ex: preço de
// tabela × fator único de desconto/frete por item. Arredondar cada linha
// separadamente e depois somar quase sempre fica 1-2 centavos diferente
// do grandTotal (soma de arredondamentos != arredondamento da soma), então
// aqui o resíduo é jogado na ÚLTIMA linha com valor, garantindo que a soma
// das linhas bate exatamente com grandTotal.
// rawAmounts: valores brutos (sem arredondar) por linha; null = sem preço.
export function distributeTotal(rawAmounts, grandTotal) {
  const lastIdx = rawAmounts.reduce((acc, v, i) => (v != null ? i : acc), -1)
  let acumulado = 0
  return rawAmounts.map((raw, idx) => {
    if (raw == null) return null
    const v = idx === lastIdx ? round2(grandTotal - acumulado) : round2(raw)
    acumulado = round2(acumulado + v)
    return v
  })
}

// Mesma fórmula do compute_total_final do banco (fatores de precificação ×
// desconto × frete, um arredondamento só no fim). Usado pelo editor de
// revisão pra que o total gravado no histórico bata com o que o servidor
// calcula — o desconto é sempre o DA COTAÇÃO (pode ser um desconto
// específico do admin), nunca o desconto global da tabela.
export const FATOR_BASE = 0.63 * 0.92 * 0.95 * 0.93

export function computeTotalFinal(subtotal, descontoPct = 0, fretePct = 1) {
  return round2((subtotal || 0) * FATOR_BASE * (1 - (Number(descontoPct) || 0) / 100) * (Number(fretePct) || 1))
}
