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

// Linha do "Informe produtos Solar - Disponibilidade" (WEG):
//   Pronta Entrega (formato novo) ou Disponível (antigo) → Disponível
//     (* = estoque no CD PE — continua disponível)
//   Indisponível + data DD/MM/YYYY      → Previsão (com a data)
//   Indisponível + * / ** (prazo em avaliação) → Previsão (sem data)
//   Indisponível + *** / sem previsão   → Esgotado
export function classifyStockLine(rawLine) {
  // Sem acentos: o PDF traz "Disponível"/"Indisponível" (com í) — a regex
  // antiga procurava "disponiv" e nunca casava com o texto real.
  const line = String(rawLine || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/indisponiv/i.test(line)) {
    const previsao = extractPrevisaoDate(line)
    if (previsao) return { status: 'Previsão', previsao }
    if (/\*{3}/.test(line)) return { status: 'Esgotado', previsao: null }
    if (/\*/.test(line)) return { status: 'Previsão', previsao: null }
    return { status: 'Esgotado', previsao: null }
  }
  if (/pronta\s*entrega/i.test(line) || /disponiv/i.test(line)) return { status: 'Disponível', previsao: null }
  return null
}

const SAP_INICIO = /^\s*(\d{8})\b/

// Linhas do PDF → { sap: { status, previsao } } só pros SAPs conhecidos.
// No PDF o status/data às vezes fica um pouco desalinhado e sai numa linha
// própria logo abaixo do produto ("Pronta Entrega", "🟢 Pronta Entrega",
// "📅 01/12/2026"). Junta esses pedaços soltos — só os que NÃO começam com
// outro código, pra nunca pegar o status do produto de baixo.
export function parseStockPdfLines(lines, knownSAPs) {
  const sapSet = new Set(knownSAPs)
  const results = {}
  lines.forEach((line, i) => {
    const m = line.match(SAP_INICIO)
    if (!m) return
    const sap = m[1]
    if (!sapSet.has(sap) || results[sap]) return
    const pedacos = [line]
    for (let j = i + 1; j < lines.length && j <= i + 2 && !SAP_INICIO.test(lines[j]); j++) pedacos.push(lines[j])
    const r = classifyStockLine(pedacos.join(' '))
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
