// Selo "Lista nova" (cotação feita numa lista de preços anterior) e prévia
// do que muda ao atualizar pra lista atual. Admin confirma a atualização;
// cliente só vê a prévia (atualizar preço é ação do admin no banco).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, X, Loader2, ArrowRight } from 'lucide-react'
import { loadPrecosLista, previewRequote } from '../lib/listaPrecos'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ListaNovaBadge({ label, labelAtual, onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick?.() }}
      title={`Preços da ${label}. Já existe a ${labelAtual} — clique pra ver o que muda.`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 whitespace-nowrap"
    >
      <RefreshCw size={11} /> Lista nova
    </button>
  )
}

export default function ListaNovaModal({ quote, info, isAdmin, onConfirm, onClose }) {
  const [estado, setEstado] = useState('carregando') // carregando | pronto | erro
  const [prev, setPrev] = useState(null)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const daCotacao = info?.porQuote?.[quote.id]

  useEffect(() => {
    let cancel = false
    loadPrecosLista(info.currentId, quote.quote_items)
      .then(precos => {
        if (cancel) return
        setPrev(previewRequote(quote.quote_items, precos, quote))
        setEstado('pronto')
      })
      .catch(e => { if (!cancel) { setErro(e?.message || 'erro'); setEstado('erro') } })
    return () => { cancel = true }
  }, [quote.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    setConfirmando(true)
    await onConfirm?.()
    setConfirmando(false)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 flex items-center gap-2"><RefreshCw size={16} className="text-orange-600" /> Atualizar para a lista atual</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {quote.data?.numero_orcamento || 'Cotação'} · preços da <strong>{daCotacao?.label}</strong>
              <ArrowRight size={11} className="inline mx-1" /> <strong>{info.currentLabel}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {estado === 'carregando' && (
            <p className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center"><Loader2 size={16} className="animate-spin" /> Calculando com a lista atual…</p>
          )}
          {estado === 'erro' && <p className="text-sm text-red-600">Não foi possível carregar a lista atual ({erro}).</p>}
          {estado === 'pronto' && prev && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Total hoje</p>
                  <p className="text-lg font-extrabold text-gray-800">{fmt(prev.totalAtual)}</p>
                </div>
                <div className={`rounded-xl px-4 py-3 border ${prev.diferenca > 0 ? 'bg-red-50 border-red-200' : prev.diferenca < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Com a lista atual</p>
                  <p className="text-lg font-extrabold text-gray-900">{fmt(prev.totalNovo)}</p>
                  <p className={`text-xs font-semibold ${prev.diferenca > 0 ? 'text-red-600' : prev.diferenca < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {prev.diferenca === 0 ? 'sem mudança no total' : `${prev.diferenca > 0 ? '+' : '−'}${fmt(Math.abs(prev.diferenca))}`}
                  </p>
                </div>
              </div>

              {prev.mudaram.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Itens que mudam de preço ({prev.mudaram.length}) — preço de tabela unitário</p>
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 text-xs">
                    {prev.mudaram.map((i, k) => (
                      <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0 truncate text-gray-800">{i.produto || i.label} <span className="text-gray-400">×{i.qty}</span></span>
                        <span className="whitespace-nowrap">
                          <span className="text-gray-400 line-through">{fmt(i.precoAtual)}</span>
                          <ArrowRight size={10} className="inline mx-1 text-gray-400" />
                          <strong className={i.precoNovo > i.precoAtual ? 'text-red-600' : 'text-green-700'}>{fmt(i.precoNovo)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Nenhum item muda de preço na lista atual.</p>
              )}

              {prev.foraDaLista.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {prev.foraDaLista.length} ite{prev.foraDaLista.length === 1 ? 'm não está' : 'ns não estão'} na lista atual e mant{prev.foraDaLista.length === 1 ? 'ém' : 'êm'} o preço de hoje: {prev.foraDaLista.map(i => i.produto || i.label).join(', ')}.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          {isAdmin ? (
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="text-sm font-semibold text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100">Agora não</button>
              <button
                onClick={confirmar}
                disabled={estado !== 'pronto' || confirmando}
                className="text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                {confirmando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Atualizar (vira nova revisão)
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Pra atualizar esta cotação para a <strong>{info.currentLabel}</strong>, fale com seu consultor Ernaniff — ela vira uma nova revisão e você pode comparar com a atual.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
