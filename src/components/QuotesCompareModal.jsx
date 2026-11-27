import { X } from 'lucide-react'
import { extractQuoteSummary } from '../lib/compareQuotes'
import ProductThumb from './ProductThumb'
import { fmtLocalDate } from '../lib/dates'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

const ROWS = [
  { key: 'numero',   label: 'Referência' },
  { key: 'cliente',  label: 'Cliente' },
  { key: 'kwp',      label: 'Potência', render: v => v ? `${v} kWp` : '—' },
  { key: 'modulo',   label: 'Módulo', thumb: 'moduloItem' },
  { key: 'inversor', label: 'Inversor', thumb: 'inversorItem' },
  { key: 'frete',    label: 'Frete' },
  { key: 'validade', label: 'Validade', render: fmtDate },
]

// Item 37: compara 2 ou 3 cotações (kits diferentes) lado a lado — não
// confundir com o item 34 (RevisionCompareModal), que compara duas revisões
// da MESMA cotação com destaque de itens novos/removidos/alterados.
export default function QuotesCompareModal({ quotes, onClose }) {
  const summaries = quotes.map(extractQuoteSummary)
  const totais = summaries.map(s => s.totalFinal)
  const menorTotal = Math.min(...totais)

  return (
    <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">Comparar {summaries.length} cotações</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[500px]">
            <tbody>
              {ROWS.map(row => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="py-2.5 pr-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap align-top w-32">{row.label}</td>
                  {summaries.map(s => (
                    <td key={s.id} className="py-2.5 px-3 text-gray-800">
                      {row.thumb && s[row.thumb] ? (
                        <span className="flex items-center gap-2.5">
                          <ProductThumb label={s[row.thumb].label} produto={s[row.thumb].produto} size={44} />
                          <span>{s[row.key]}</span>
                        </span>
                      ) : (row.render ? row.render(s[row.key]) : (s[row.key] || '—'))}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2.5 pr-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap align-top w-32">Forma de pagamento</td>
                {summaries.map(s => (
                  <td key={s.id} className="py-2.5 px-3 text-gray-800">
                    {s.formaPagamento === 'cartao' && s.parcelas
                      ? `${s.parcelas}x de ${fmt(s.valorParcela)}`
                      : 'À vista'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 text-xs font-bold text-gray-700 uppercase whitespace-nowrap align-top w-32">Total</td>
                {summaries.map(s => (
                  <td key={s.id} className="py-3 px-3">
                    <span className={`text-lg font-extrabold ${s.totalFinal === menorTotal && new Set(totais).size > 1 ? 'text-green-600' : 'text-weg-blue'}`}>
                      {fmt(s.totalFinal)}
                    </span>
                    {s.totalFinal === menorTotal && new Set(totais).size > 1 && (
                      <span className="block text-[10px] font-bold text-green-600 uppercase">Menor valor</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
