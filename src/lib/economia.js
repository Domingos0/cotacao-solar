// Item 38: economia e payback na proposta — estimativa rápida (geração
// mensal × tarifa) pra mostrar ao cliente direto no Monte seu Kit/impressão.
// Não é a simulação completa do PVGIS com perda por sombreamento (essa já
// existe em SolarSimulationPage, uso interno do admin) — aqui é só uma
// conta simples e transparente, com a tarifa ajustável na tela.
import { round2 } from './money'

export const TARIFA_PADRAO = 0.95 // R$/kWh, média Brasil — ajustável na tela

export function calcEconomia(kwp, hsp, tarifa, totalFinal) {
  const geracaoMensalKwh = round2((kwp || 0) * (hsp || 0) * 30)
  const economiaMensal = round2(geracaoMensalKwh * (tarifa || 0))
  const economiaAnual = round2(economiaMensal * 12)
  const paybackAnos = economiaAnual > 0 && totalFinal > 0 ? round2(totalFinal / economiaAnual) : null
  return { geracaoMensalKwh, economiaMensal, economiaAnual, paybackAnos }
}
