// Datas "só dia" do banco (colunas date, ex: valid_until = '2026-11-29') —
// new Date('2026-11-29') é meia-noite UTC, que no Brasil (UTC-3) vira 21h do
// dia ANTERIOR e mostra 28/11. Aqui a string só-data vira meia-noite local.
export function parseLocalDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

export function fmtLocalDate(value) {
  const d = parseLocalDate(value)
  return d ? d.toLocaleDateString('pt-BR') : ''
}
