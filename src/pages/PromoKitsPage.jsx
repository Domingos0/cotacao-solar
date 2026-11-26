// Item 36: Kits da Promoção — página própria com kits pré-montados em
// desconto por tempo limitado. O preço mostrado já soma o frete da
// promoção da região do cliente (não o frete normal do catálogo).
import { useState, useEffect, useMemo } from 'react'
import { listPromoKits, listPromoRegioes, getPromoStatus, calcPromoPreco, PROMO_STATUS_LABELS } from '../lib/promoKits'
import { regiaoFromUF } from '../lib/regiao'
import { ESTADOS } from '../data/cidadesPorEstado'
import { FileText, Clock, Flame } from 'lucide-react'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Mesma lista de ROOF_TYPES do Monte seu Kit/Minhas Cotações, só que aqui é
// usada só como preferência do cliente (repassada pro Monte seu Kit depois
// de "Solicitar este kit") — a lógica completa de estrutura (isopleta,
// perfil metálico etc.) já existe lá e não precisa ser duplicada aqui.
const ROOF_TYPES_SIMPLE = [
  { key: 'Cerâmico', label: 'Telha Cerâmica' },
  { key: 'Fibromadeira', label: 'Fibrocimento / Madeira' },
  { key: 'Fibrometálico', label: 'Fibrometálico' },
  { key: 'Metálico', label: 'Metálico perfil 55cm' },
  { key: 'Zipado', label: 'Zipado / Termoacústico' },
  { key: 'Shingle', label: 'Shingle (asfáltico)' },
  { key: 'Laje', label: 'Laje' },
  { key: 'Carport', label: 'Garagem Solar / Carport' },
  { key: 'Solo', label: 'Solo (fixo)' },
]

const STATUS_STYLES = {
  ativa: 'bg-green-100 text-green-700',
  ultimos_7_dias: 'bg-amber-100 text-amber-700',
  ultimo_dia: 'bg-red-100 text-red-700',
  encerrada: 'bg-gray-200 text-gray-500',
}

export default function PromoKitsPage({ onRequestPromo }) {
  const [kits, setKits] = useState([])
  const [regioes, setRegioes] = useState({})
  const [loading, setLoading] = useState(true)
  const [uf, setUf] = useState('')
  const [roofByKit, setRoofByKit] = useState({})

  useEffect(() => {
    (async () => {
      const [k, r] = await Promise.all([listPromoKits(), listPromoRegioes()])
      setKits(k.data)
      setRegioes(r.data)
      setLoading(false)
    })()
  }, [])

  const regiao = regiaoFromUF(uf)

  const visibleKits = useMemo(() => {
    const hoje = new Date()
    return kits
      .filter(k => k.ativo && new Date(`${k.data_inicio}T00:00:00`) <= hoje)
      .map(k => ({ ...k, status: getPromoStatus(k, hoje) }))
      .filter(k => k.status.principal !== 'encerrada')
  }, [kits])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Flame size={22} className="text-orange-500" /> Kits da Promoção
        </h1>
        <p className="text-gray-500 text-sm">Kits fechados com desconto especial por tempo limitado.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 max-w-sm">
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Seu estado (pra calcular o frete)</label>
        <select value={uf} onChange={e => setUf(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue">
          <option value="">Selecione...</option>
          {ESTADOS.map(e => <option key={e.uf} value={e.uf}>{e.nome}</option>)}
        </select>
      </div>

      {visibleKits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <Flame size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma promoção ativa no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleKits.map(kit => {
            const preco = calcPromoPreco(kit, regiao, regioes)
            const roofType = roofByKit[kit.id] || ''
            return (
              <div key={kit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900">{kit.nome}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${STATUS_STYLES[kit.status.principal]}`}>
                      {PROMO_STATUS_LABELS[kit.status.principal]}
                    </span>
                  </div>
                  {kit.status.prorrogada && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-2">
                      <Clock size={10} /> Prorrogada
                    </span>
                  )}
                  <p className="text-sm text-gray-500 mb-3">
                    {kit.kwp} kWp · {kit.modulo?.qty}× {kit.modulo?.nome} · {kit.inversor?.nome}
                  </p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-gray-400 line-through">{fmt(kit.preco_homologado)}</span>
                    <span className="text-xs font-bold text-green-600">-{kit.desconto_pct}%</span>
                  </div>
                  <p className="text-2xl font-extrabold text-weg-blue mb-1">{fmt(preco)}</p>
                  {!uf && <p className="text-[11px] text-gray-400 mb-3">Já inclui o frete da promoção — selecione seu estado acima</p>}
                  {uf && <p className="text-[11px] text-gray-400 mb-3">Já inclui o frete da promoção pra {regiao || 'sua região'}</p>}
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Tipo de telhado</label>
                    <select
                      value={roofType}
                      onChange={e => setRoofByKit(prev => ({ ...prev, [kit.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-weg-blue"
                    >
                      <option value="">Selecione...</option>
                      {ROOF_TYPES_SIMPLE.map(rt => <option key={rt.key} value={rt.key}>{rt.label}</option>)}
                    </select>
                  </div>
                  {kit.fob_folder_url && (
                    <a href={kit.fob_folder_url} target="_blank" rel="noopener noreferrer" className="text-xs text-weg-blue hover:underline flex items-center gap-1 mb-1">
                      <FileText size={12} /> Ver folder desta promoção
                    </a>
                  )}
                </div>
                <button
                  onClick={() => onRequestPromo(kit, uf, roofType)}
                  disabled={!uf}
                  title={!uf ? 'Selecione seu estado pra calcular o frete' : undefined}
                  className="w-full bg-weg-blue hover:bg-weg-blue/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
                >
                  Solicitar este kit
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
