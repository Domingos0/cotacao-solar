import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import {
  FileText, RefreshCw, Trash2, Edit3,
  CheckCircle2, Clock, XCircle, AlertTriangle, Package, ChevronDown, ChevronUp,
} from 'lucide-react'

const STATUS_STYLE = {
  rascunho:            { label: 'Rascunho',             cls: 'bg-gray-100 text-gray-600',     icon: FileText },
  enviada:             { label: 'Enviada',              cls: 'bg-blue-100 text-blue-700',     icon: FileText },
  aguardando_desconto: { label: 'Aguardando desconto',  cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  aprovada:            { label: 'Desconto aprovado',    cls: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  recusada:            { label: 'Desconto não aprovado',cls: 'bg-red-100 text-red-600',       icon: XCircle },
}

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function KitItemsTable({ items }) {
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Package size={13} /> Composição do kit ({items.length} iten{items.length !== 1 ? 's' : ''})
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-4">
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Item</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 hidden sm:table-cell">Produto</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-500">Qtd</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">Unit.</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-gray-600 font-medium">{item.label}</td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell max-w-[180px] truncate">{item.produto}</td>
                    <td className="px-3 py-2 text-center font-bold text-gray-700">{item.qty}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MinhasCotacoesPage({ onLoadQuote }) {
  const { session } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchQuotes = async () => {
    if (!session?.user?.id) return
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchQuotes() }, [session?.user?.id])

  const handleDelete = async (id) => {
    setDeletingId(id)
    await supabaseAdmin.from('quote_items').delete().eq('quote_id', id)
    await supabaseAdmin.from('quotes').delete().eq('id', id)
    setQuotes(qs => qs.filter(q => q.id !== id))
    setDeletingId(null)
    setConfirmDelete(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-weg-blue" /> Minhas Cotações
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{quotes.length} cotaç{quotes.length === 1 ? 'ão salva' : 'ões salvas'}</p>
        </div>
        <button onClick={fetchQuotes}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-weg-blue px-3 py-2 rounded-lg hover:bg-gray-100">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <FileText size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Nenhuma cotação salva</h3>
          <p className="text-sm text-gray-400">Acesse "Monte seu Kit" e salve uma cotação para ela aparecer aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(q => {
            const st = STATUS_STYLE[q.status] || STATUS_STYLE.rascunho
            const StatusIcon = st.icon
            const kitData = q.data || {}
            const items = q.quote_items || []

            return (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-base truncate max-w-xs">
                        {q.nome_projeto || `Kit ${q.kwp} kWp`}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                        <StatusIcon size={11} /> {st.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>{q.kwp} kWp</span>
                      {q.kit_type && <span className="capitalize">{q.kit_type.replace(/_/g, ' ')}</span>}
                      <span>{new Date(q.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-gray-900 text-lg">{fmt(q.total_final)}</p>
                    {q.desconto_pct > 0 && (
                      <p className="text-xs text-green-600 font-medium">Desconto: {q.desconto_pct}%</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{q.frete_nome || 'FOB'}</p>
                  </div>
                </div>

                {/* Itens do kit — colapsável */}
                <KitItemsTable items={items} />

                {/* Resposta de desconto */}
                {q.desconto_resposta && (
                  <div className={`px-5 py-3 border-t text-sm ${
                    q.status === 'aprovada'
                      ? 'bg-green-50 border-green-100 text-green-800'
                      : 'bg-gray-50 border-gray-100 text-gray-600'
                  }`}>
                    <p className="flex items-center gap-1.5 font-semibold mb-0.5">
                      {q.status === 'aprovada'
                        ? <><CheckCircle2 size={13} /> Desconto aprovado</>
                        : <><AlertTriangle size={13} /> Resposta do administrador</>}
                    </p>
                    <p className="text-xs">{q.desconto_resposta}</p>
                  </div>
                )}

                {/* Aguardando */}
                {q.status === 'aguardando_desconto' && (
                  <div className="px-5 py-2 border-t border-yellow-100 bg-yellow-50 text-xs text-yellow-700 flex items-center gap-1.5">
                    <Clock size={12} /> Solicitação de desconto enviada — aguardando resposta do administrador.
                  </div>
                )}

                {/* Ações */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2">
                  <button
                    onClick={() => onLoadQuote({ quoteData: kitData, savedId: q.id })}
                    className="flex items-center gap-1.5 bg-weg-blue hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <Edit3 size={13} /> Abrir / Continuar editando
                  </button>

                  {confirmDelete === q.id ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-500">Confirmar exclusão?</span>
                      <button
                        onClick={() => handleDelete(q.id)}
                        disabled={deletingId === q.id}
                        className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {deletingId === q.id ? 'Excluindo…' : 'Sim, excluir'}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(q.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
