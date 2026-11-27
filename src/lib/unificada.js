// Proposta unificada salva (save_unified_quote) — textos e regras de tela,
// iguais em todo lugar (Admin e Minhas Cotações).
//   data.unificada = true            → é a proposta unificada
//   data.origem    = [{id, numero}]  → cotações que ela reúne
//   data.unificadaEm = {id, numero}  → esta cotação faz parte de uma unificada
//   data.fechamento = {tipo, numero, junto}  (gravado pelo gatilho do banco)
//   data.cancelada  = {motivo}       → unificada cancelada (uma fechou sozinha)

export const isUnificada = q => q?.data?.unificada === true

// Unificada da qual esta cotação faz parte, se ainda estiver valendo.
// quotes: lista carregada na tela (pra saber se a unificada foi cancelada).
export function unificadaAtiva(q, quotes = []) {
  const ref = q?.data?.unificadaEm
  if (!ref?.id) return null
  const u = quotes.find(x => x.id === ref.id)
  if (u && u.status === 'perdida') return null
  return { id: ref.id, numero: ref.numero || u?.data?.numero_orcamento || '' }
}

export function numerosOrigem(q) {
  return (q?.data?.origem || []).map(o => o.numero).filter(Boolean)
}

export function textoFechamento(q) {
  const f = q?.data?.fechamento
  if (!f) return null
  if (f.tipo === 'unificada') {
    const junto = (f.junto || []).filter(Boolean)
    return `Fechada na proposta unificada ${f.numero || ''}${junto.length ? ` (junto com ${junto.join(', ')})` : ''}`.trim()
  }
  if (f.tipo === 'unificada_principal') {
    const nums = numerosOrigem(q)
    return `Proposta unificada fechada${nums.length ? ` — ${nums.join(', ')} fecharam juntas` : ''}`
  }
  if (f.tipo === 'unitario') return 'Fechada sozinha'
  return null
}

export function textoCancelada(q) {
  const c = q?.data?.cancelada
  return c ? `Proposta unificada cancelada: ${c.motivo || 'uma das cotações foi fechada sozinha'}` : null
}
