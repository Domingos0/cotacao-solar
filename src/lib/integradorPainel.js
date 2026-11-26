// Item 42: Painel do integrador — kWp cotado, kWp fechado e economia gerada
// no mês, a partir das próprias cotações do usuário logado (não precisa de
// consulta nova; usa os mesmos dados já carregados em Minhas Cotações).
import { calcEconomia, TARIFA_PADRAO } from './economia'

const SUN_HOURS_PADRAO = 4.5 // mesmo padrão usado no Monte seu Kit (dimensionamento)

// Mesmos status de "fechado" (negócio ganho) já usados no Dashboard do
// Admin — deliberadamente SEM 'perdida', que também é um status "fechado"
// no sentido de "não está mais ativo", mas não conta como kWp fechado.
export const WON_STATUSES = ['fechado', 'faturado', 'em_transporte', 'implantado']

function isSameMonth(dateStr, ref) {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export function calcPainelIntegrador(quotes, mesReferencia = new Date()) {
  const doMes = (quotes || []).filter(q => q.created_at && isSameMonth(q.created_at, mesReferencia))
  const cotadas = doMes.filter(q => q.status !== 'rascunho')
  const fechadas = doMes.filter(q => WON_STATUSES.includes(q.status))

  const kwpCotado = cotadas.reduce((s, q) => s + (Number(q.kwp) || 0), 0)
  const kwpFechado = fechadas.reduce((s, q) => s + (Number(q.kwp) || 0), 0)
  const totalCotado = cotadas.reduce((s, q) => s + (q.total_final || 0), 0)
  const totalFechado = fechadas.reduce((s, q) => s + (q.total_final || 0), 0)

  // Economia gerada: soma a economia MENSAL estimada de cada kit fechado no
  // mês (quanto os clientes desses kits economizam por mês na conta de luz),
  // usando a tarifa salva em cada cotação (item 38) ou a padrão se não tiver.
  const economiaGerada = fechadas.reduce((s, q) => {
    const kitData = q.data || {}
    const kwp = kitData.panel ? ((kitData.panelQty || 1) * (kitData.panel.potencia || 0)) / 1000 : (Number(q.kwp) || 0)
    const hsp = kitData.hsp || SUN_HOURS_PADRAO
    const tarifa = kitData.tarifaEnergia ?? TARIFA_PADRAO
    return s + calcEconomia(kwp, hsp, tarifa, q.total_final).economiaMensal
  }, 0)

  return {
    kwpCotado: Number(kwpCotado.toFixed(2)),
    kwpFechado: Number(kwpFechado.toFixed(2)),
    totalCotado, totalFechado,
    economiaGerada: Number(economiaGerada.toFixed(2)),
    qtdCotadas: cotadas.length,
    qtdFechadas: fechadas.length,
  }
}
