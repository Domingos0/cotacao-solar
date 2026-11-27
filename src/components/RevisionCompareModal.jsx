import { X, ArrowRight } from 'lucide-react'
import { diffRevisions } from '../lib/revisionDiff'
import ProductThumb from './ProductThumb'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATUS_STYLE = {
  added:   { label: 'Novo',     row: 'bg-green-50' },
  removed: { label: 'Removido', row: 'bg-red-50' },
  changed: { label: 'Alterado', row: 'bg-amber-50' },
  same:    { label: '',         row: '' },
}

// Item 34: compara duas revisões (ex: Rev. 0 × Rev. 1) lado a lado,
// destacando itens novos/removidos/alterados e a diferença de total/frete.
export default function RevisionCompareModal({ revA, revB, onClose }) {
  const diff = diffRevisions(revA, revB)
  const itensRelevantes = diff.items.filter(i => i.status !== 'same')

  return (
    <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            Rev. {revA?.revisao ?? '—'} <ArrowRight size={16} className="text-gray-400" /> Rev. {revB?.revisao ?? '—'}
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Motivo da revisão */}
          {revB?.motivo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Motivo da revisão</p>
              <p className="text-sm text-blue-900">{revB.motivo}</p>
            </div>
          )}

          {/* Resumo: datas, total, frete */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Rev. {revA?.revisao ?? '—'} — {fmtDate(revA?.data)}</p>
              <p className="font-bold text-gray-700">{fmt(diff.totalA)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{diff.freteA}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Rev. {revB?.revisao ?? '—'} — {fmtDate(revB?.data)}</p>
              <p className={`font-bold ${diff.totalDelta > 0 ? 'text-red-600' : diff.totalDelta < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                {fmt(diff.totalB)}
              </p>
              <p className={`text-xs mt-0.5 ${diff.freteChanged ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>{diff.freteB}</p>
            </div>
          </div>

          {diff.totalDelta !== 0 && (
            <p className={`text-sm font-semibold text-center ${diff.totalDelta > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {diff.totalDelta > 0 ? '▲ Aumentou' : '▼ Diminuiu'} {fmt(Math.abs(diff.totalDelta))}
            </p>
          )}

          {/* Itens alterados */}
          <div>
            <p className="font-bold text-gray-800 mb-2">Itens alterados ({itensRelevantes.length})</p>
            {itensRelevantes.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhuma mudança nos itens — só preço/frete/condições.</p>
            ) : (
              <div className="space-y-2">
                {itensRelevantes.map(({ key, status, a, b }) => (
                  <div key={key} className={`rounded-xl p-3 text-sm flex gap-3 ${STATUS_STYLE[status].row}`}>
                    <ProductThumb label={(b || a)?.label} produto={(b || a)?.produto} size={44} />
                    <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-gray-800 min-w-0">
                        {(b || a)?.label || (b || a)?.produto}
                        {(b || a)?.produto && (b || a)?.produto !== (b || a)?.label && (
                          <span className="block text-xs font-normal text-gray-500 truncate">{(b || a).produto}</span>
                        )}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 shrink-0">{STATUS_STYLE[status].label}</span>
                    </div>
                    {status === 'added' && (
                      <p className="text-xs text-green-700">+ {b.qty} {b.unit} × {fmt(b.preco_unit)} = {fmt(b.total)}</p>
                    )}
                    {status === 'removed' && (
                      <p className="text-xs text-red-700 line-through">{a.qty} {a.unit} × {fmt(a.preco_unit)} = {fmt(a.total)}</p>
                    )}
                    {status === 'changed' && (
                      <p className="text-xs text-amber-700">
                        {a.qty} {a.unit} × {fmt(a.preco_unit)} = {fmt(a.total)}
                        <ArrowRight size={11} className="inline mx-1 -mt-0.5" />
                        {b.qty} {b.unit} × {fmt(b.preco_unit)} = {fmt(b.total)}
                      </p>
                    )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
