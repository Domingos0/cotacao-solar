import { useState } from 'react'
import { CreditCard, Wallet, Table2 } from 'lucide-react'
import { CARTAO_PARCELAS, totalComCartao, valorParcela } from '../lib/payment'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Item 33 — formas de pagamento na proposta. Mesmo componente serve pro
// Monte seu Kit (editável, salva a escolha em data.formaPagamento/
// data.parcelasCartao) e pro detalhe/impressão de cotação salva
// (readOnly: só mostra o que foi escolhido, com a tabela completa opcional).
export default function PaymentOptions({ total, formaPagamento, parcelas, onChange, readOnly, printMode }) {
  const [showTable, setShowTable] = useState(false)
  const forma = formaPagamento || 'avista'
  const parc = parcelas || 1
  const op = CARTAO_PARCELAS.find(o => o.parcelas === parc)

  if (readOnly) {
    return (
      <div className={printMode ? '' : 'bg-white rounded-xl border border-gray-200 p-4'}>
        <p className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          {forma === 'avista' ? <Wallet size={16} className="text-weg-blue" /> : <CreditCard size={16} className="text-weg-blue" />}
          Forma de pagamento
        </p>
        {forma === 'avista' ? (
          <p className="text-sm text-gray-700">À vista — <strong className="text-weg-blue">{fmt(total)}</strong></p>
        ) : (
          <p className="text-sm text-gray-700">
            Cartão em <strong>{parc}x</strong> de <strong className="text-weg-blue">{fmt(valorParcela(total, parc))}</strong>
            {' '}({op?.codigo}, total {fmt(totalComCartao(total, parc))})
          </p>
        )}
        {!printMode && (
          <button
            onClick={() => setShowTable(v => !v)}
            className="text-xs text-gray-400 hover:text-weg-blue mt-2 flex items-center gap-1 print:hidden"
          >
            <Table2 size={12} /> {showTable ? 'Ocultar' : 'Ver'} tabela completa de parcelas
          </button>
        )}
        {(printMode || showTable) && <ParcelasTable total={total} />}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-weg-blue" /> Forma de pagamento
      </p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onChange({ formaPagamento: 'avista', parcelasCartao: null })}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg border-2 transition-colors ${
            forma === 'avista' ? 'border-weg-blue bg-blue-50 text-weg-blue' : 'border-gray-200 text-gray-500'
          }`}
        >
          À vista
        </button>
        <button
          onClick={() => onChange({ formaPagamento: 'cartao', parcelasCartao: parc })}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg border-2 transition-colors ${
            forma === 'cartao' ? 'border-weg-blue bg-blue-50 text-weg-blue' : 'border-gray-200 text-gray-500'
          }`}
        >
          Cartão (parcelado)
        </button>
      </div>

      {forma === 'avista' ? (
        <p className="text-sm text-gray-700">Total à vista: <strong className="text-weg-blue">{fmt(total)}</strong></p>
      ) : (
        <>
          <select
            value={parc}
            onChange={e => onChange({ formaPagamento: 'cartao', parcelasCartao: Number(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold mb-2 focus:outline-none focus:ring-2 focus:ring-weg-blue"
          >
            {CARTAO_PARCELAS.map(o => (
              <option key={o.codigo} value={o.parcelas}>
                {o.parcelas}x de {fmt(valorParcela(total, o.parcelas))} — total {fmt(totalComCartao(total, o.parcelas))} ({(o.pct * 100).toFixed(2)}%)
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-700">
            <strong>{parc}x</strong> de <strong className="text-weg-blue">{fmt(valorParcela(total, parc))}</strong> — total {fmt(totalComCartao(total, parc))}
          </p>
        </>
      )}

      <button
        onClick={() => setShowTable(v => !v)}
        className="text-xs text-gray-400 hover:text-weg-blue mt-3 flex items-center gap-1"
      >
        <Table2 size={12} /> {showTable ? 'Ocultar' : 'Ver'} tabela completa de parcelas
      </button>
      {showTable && <ParcelasTable total={total} />}
    </div>
  )
}

function ParcelasTable({ total }) {
  return (
    <table className="w-full text-xs mt-3 border-t border-gray-100 pt-2">
      <thead>
        <tr className="text-gray-400 text-left">
          <th className="py-1 font-semibold">Parcelas</th>
          <th className="py-1 font-semibold text-right">Valor da parcela</th>
          <th className="py-1 font-semibold text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {CARTAO_PARCELAS.map(o => (
          <tr key={o.codigo} className="border-t border-gray-50">
            <td className="py-1 text-gray-600">{o.parcelas}x</td>
            <td className="py-1 text-right text-gray-700">{fmt(valorParcela(total, o.parcelas))}</td>
            <td className="py-1 text-right text-gray-700">{fmt(totalComCartao(total, o.parcelas))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
