import { Leaf, TrendingUp } from 'lucide-react'
import { calcEconomia, TARIFA_PADRAO } from '../lib/economia'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Item 38 — economia e payback na proposta. Mesmo componente serve pro
// Monte seu Kit (editável, salva a tarifa escolhida em data.tarifaEnergia)
// e pro detalhe/impressão de cotação salva (readOnly: só mostra a conta
// com a tarifa que foi salva, ou a padrão se a cotação for antiga e não
// tiver uma salva ainda).
export default function EconomiaPayback({ kwp, hsp, totalFinal, tarifa, onChange, readOnly, printMode }) {
  const tarifaAtual = tarifa ?? TARIFA_PADRAO
  const economia = calcEconomia(kwp, hsp, tarifaAtual, totalFinal)

  if (!kwp) return null

  return (
    <div className={printMode ? '' : 'bg-white rounded-xl border border-gray-200 p-4'}>
      <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Leaf size={16} className="text-green-600" /> Economia e payback
      </p>

      {!readOnly && (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tarifa de energia (R$/kWh)</label>
          <input
            type="number" step="0.01" min="0" value={tarifaAtual}
            onChange={e => onChange({ tarifaEnergia: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Economia mensal</p>
          <p className="font-bold text-green-700">{fmt(economia.economiaMensal)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Economia anual</p>
          <p className="font-bold text-green-700">{fmt(economia.economiaAnual)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp size={10} /> Payback
          </p>
          <p className="font-bold text-weg-blue">{economia.paybackAnos != null ? `${economia.paybackAnos.toFixed(1)} anos` : '—'}</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        Estimativa com base na tarifa de {fmt(tarifaAtual)}/kWh e geração de {economia.geracaoMensalKwh.toLocaleString('pt-BR')} kWh/mês — valores reais variam conforme consumo, concessionária e irradiação local.
      </p>
    </div>
  )
}
