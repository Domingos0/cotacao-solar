// Item 33: formas de pagamento na proposta — tabela de custos de cartão
// (CC01–CC23, só os códigos realmente usados) fornecida pelo usuário.
// Cálculo: acréscimo, total × (1 + custo) — ex: 6x = total × 1,0609.
export const CARTAO_PARCELAS = [
  { codigo: 'CC01', parcelas: 1,  pct: 0.0291 },
  { codigo: 'CC02', parcelas: 2,  pct: 0.0399 },
  { codigo: 'CC03', parcelas: 3,  pct: 0.0451 },
  { codigo: 'CC04', parcelas: 4,  pct: 0.0503 },
  { codigo: 'CC05', parcelas: 5,  pct: 0.0556 },
  { codigo: 'CC06', parcelas: 6,  pct: 0.0609 },
  { codigo: 'CC18', parcelas: 7,  pct: 0.0881 },
  { codigo: 'CC19', parcelas: 8,  pct: 0.0971 },
  { codigo: 'CC20', parcelas: 9,  pct: 0.1043 },
  { codigo: 'CC21', parcelas: 10, pct: 0.1132 },
  { codigo: 'CC22', parcelas: 11, pct: 0.1213 },
  { codigo: 'CC23', parcelas: 12, pct: 0.1295 },
]

// Total com o acréscimo do cartão aplicado (ou o próprio total, à vista).
export function totalComCartao(total, parcelas) {
  const op = CARTAO_PARCELAS.find(o => o.parcelas === parcelas)
  if (!op) return total
  return Math.round(total * (1 + op.pct) * 100) / 100
}

export function valorParcela(total, parcelas) {
  if (!parcelas || parcelas <= 1) return totalComCartao(total, parcelas)
  return Math.round((totalComCartao(total, parcelas) / parcelas) * 100) / 100
}
