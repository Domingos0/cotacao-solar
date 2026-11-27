// Previsão de estoque (produto com estoque = 'Previsão' + estoque_previsao
// 'YYYY-MM-DD'). Duas coisas:
//  1) leitura da tabela de disponibilidade WEG em PDF — status + DATA de
//     previsão de cada SAP (antes a data era detectada e descartada);
//  2) avisos pro admin: previsão já vencida (confirmar se o material chegou
//     ou corrigir a data) e previsão chegando (revisar nos próximos dias).
import { parseLocalDate } from './dates'

export const DIAS_AVISO_PREVISAO = 7

// 'DD/MM/YYYY' (primeira que aparecer no texto) → 'YYYY-MM-DD' | null
export function extractPrevisaoDate(text) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text || '')
  if (!m) return null
  const [, d, mo, y] = m
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null
  return `${y}-${mo}-${d}`
}

// Linha da tabela WEG:
//   Disponível (ou Disponível (CD PE))  → Disponível
//   Indisponível + data DD/MM/YYYY      → Previsão (com a data)
//   Indisponível + * (prazo fabricação) → Previsão (sem data)
//   Indisponível + *** / sem previsão   → Esgotado
export function classifyStockLine(rawLine) {
  // Sem acentos: o PDF traz "Disponível"/"Indisponível" (com í) — a regex
  // antiga procurava "disponiv" e nunca casava com o texto real.
  const line = String(rawLine || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/disponiv/i.test(line) && !/indisponiv/i.test(line)) return { status: 'Disponível', previsao: null }
  if (/indisponiv/i.test(line)) {
    const previsao = extractPrevisaoDate(line)
    if (previsao) return { status: 'Previsão', previsao }
    if (/\*{3}/.test(line)) return { status: 'Esgotado', previsao: null }
    if (/\*/.test(line)) return { status: 'Previsão', previsao: null }
    return { status: 'Esgotado', previsao: null }
  }
  return null
}

// Linhas do PDF → { sap: { status, previsao } } só pros SAPs conhecidos
export function parseStockPdfLines(lines, knownSAPs) {
  const sapSet = new Set(knownSAPs)
  const results = {}
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(\d{8})\b/)
    if (!m) return
    const sap = m[1]
    if (!sapSet.has(sap) || results[sap]) return
    // Status inconclusivo na linha? A previsão às vezes vem na linha de baixo.
    let r = classifyStockLine(line)
    if (!r) r = classifyStockLine([line, lines[i + 1]].filter(Boolean).join(' '))
    if (r) results[sap] = r
  })
  return results
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Dias até a previsão (negativo = já passou). null se não há data.
export function diasAtePrevisao(previsao, hoje = new Date()) {
  const d = parseLocalDate(previsao)
  if (!d || isNaN(d)) return null
  return Math.round((startOfDay(d) - startOfDay(hoje)) / 86400000)
}

// 'vencida' (data já passou) | 'hoje' | 'proxima' (até N dias) | null
export function previsaoAlerta(previsao, hoje = new Date(), diasAviso = DIAS_AVISO_PREVISAO) {
  const dias = diasAtePrevisao(previsao, hoje)
  if (dias === null) return null
  if (dias < 0) return 'vencida'
  if (dias === 0) return 'hoje'
  if (dias <= diasAviso) return 'proxima'
  return null
}

// Produtos em Previsão que o admin precisa revisar, vencidos primeiro.
export function produtosParaRevisar(products, hoje = new Date(), diasAviso = DIAS_AVISO_PREVISAO) {
  return (products || [])
    .filter(p => p.estoque === 'Previsão' && p.estoque_previsao)
    .map(p => ({ product: p, dias: diasAtePrevisao(p.estoque_previsao, hoje), alerta: previsaoAlerta(p.estoque_previsao, hoje, diasAviso) }))
    .filter(r => r.alerta)
    .sort((a, b) => a.dias - b.dias)
}

export function textoAlertaPrevisao(dias) {
  if (dias === null || dias === undefined) return ''
  if (dias < 0) return `previsão venceu há ${-dias} dia${dias === -1 ? '' : 's'} — o material chegou?`
  if (dias === 0) return 'previsão é hoje — confirme a chegada'
  return `chega em ${dias} dia${dias === 1 ? '' : 's'} — revise`
}
