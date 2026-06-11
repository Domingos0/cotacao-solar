import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductsContext'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { KIT_ROLE, CATEGORIES } from '../data/products'
import {
  FileText, RefreshCw, Edit3, CheckCircle2, Clock, XCircle,
  Package, ChevronDown, ChevronUp, X, Printer, AlertTriangle,
  Trash2, Check, Minus, Plus, Shield, Link2, Home,
} from 'lucide-react'

// ─── Shared constants (mirror of KitBuilder) ──────────────────────────────────
const KIT_SAPS = {
  MC4_6MM:     '15848565',
  CABO_CC_PTO: '13677909',
  CABO_CC_VML: '13677908',
  SURGE_CA:    '14827873',
}

const ROOF_TYPES = [
  { key: 'Cerâmico',      label: 'Telha Cerâmica',          emoji: '🧱', hasIsopleta: true  },
  { key: 'Fibromadeira',  label: 'Fibrocimento / Madeira',   emoji: '🪵', hasIsopleta: true  },
  { key: 'Fibrometálico', label: 'Fibrometálico',            emoji: '🔩', hasIsopleta: true  },
  { key: 'Metálico',      label: 'Metálico perfil 55cm',     emoji: '🏗️', hasIsopleta: false },
  { key: 'Zipado',        label: 'Zipado / Termoacústico',    emoji: '⚡', hasIsopleta: false },
  { key: 'Shingle',       label: 'Shingle (asfáltico)',       emoji: '🏘️', hasIsopleta: false },
  { key: 'Laje',          label: 'Laje',                     emoji: '🏢', hasIsopleta: false },
  { key: 'Carport',       label: 'Garagem Solar / Carport',   emoji: '🚗', hasIsopleta: false },
  { key: 'Solo',          label: 'Solo (fixo)',               emoji: '🌱', hasIsopleta: false },
]

const METALICO_PERFIS = [
  { key: 'padrao', label: 'Perfil 55cm',  match: p => p.includes('perfil 55cm') && !p.includes('33mm') },
  { key: 'longo',  label: 'Perfil longo', match: p => p.includes('perfil longo') && !p.includes('33mm') },
]

const ISOPLETA_OPTIONS = [30, 35, 40, 45, 50]

const round2 = v => Math.round(v * 100) / 100

// Fatores de precificação (mirror de KitBuilder)
const FATOR_BASE = 0.63 * 0.92 * 0.95 * 0.93  // ≈ 0.5121

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = d => d
  ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

export const STATUS_STYLE = {
  rascunho:            { label: 'Rascunho',               cls: 'bg-gray-100 text-gray-600',       icon: FileText },
  enviada:             { label: 'Em análise cliente',      cls: 'bg-blue-100 text-blue-700',       icon: Clock },
  em_analise:          { label: 'Em análise cliente',      cls: 'bg-blue-100 text-blue-700',       icon: Clock },
  revisada:            { label: 'Revisada',               cls: 'bg-purple-100 text-purple-600',   icon: RefreshCw },
  aguardando_desconto: { label: 'Aguardando desconto',    cls: 'bg-yellow-100 text-yellow-700',   icon: Clock },
  aprovada:            { label: 'Desconto aprovado',      cls: 'bg-green-100 text-green-700',     icon: CheckCircle2 },
  recusada:            { label: 'Desconto não aprovado',  cls: 'bg-red-100 text-red-600',         icon: XCircle },
  fechado:             { label: 'Aguardando Implantação', cls: 'bg-orange-100 text-orange-700',   icon: Package },
  implantado:          { label: 'Implantado',             cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  perdida:             { label: 'Proposta Perdida',       cls: 'bg-red-100 text-red-600',         icon: XCircle },
}

function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.rascunho
  const Icon = st.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}>
      <Icon size={11} /> {st.label}
    </span>
  )
}

// ─── Inline Editor ────────────────────────────────────────────────────────────
const CAT_FOR_TYPE = {
  ongrid_mono: CATEGORIES.INVERSORES_MONO,
  ongrid_tri:  CATEGORIES.INVERSORES_TRI,
  micro:       CATEGORIES.MICROINVERSORES,
  bombeamento: CATEGORIES.INVERSORES_BOMBEAMENTO,
}

// Helper: compute acc defaults from inverter config
function calcAccDefaults(isTri, entradas, totalInv) {
  return {
    mc4Qty:         entradas,
    cablePosMeters: 25 * entradas,
    cableNegMeters: 25 * entradas,
    surgeACQty:     (isTri ? 4 : 2) * totalInv,
    inclSurgeCA:    true,
    inclSurgeDC:    true,
    surgeDCQty:     1,
    inclBreaker:    true,
    breakerQty:     totalInv,
  }
}

// Simple qty row for accessories
function AccRow({ label, included, onToggle, qty, onQtyChange, unit = 'un', product }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs transition-colors ${included ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <button
        onClick={onToggle}
        className={`w-8 h-5 rounded-full transition-colors shrink-0 ${included ? 'bg-weg-blue' : 'bg-gray-300'}`}
      >
        <span className={`block w-3 h-3 rounded-full bg-white mx-auto translate-x-0 transition-transform ${included ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
      </button>
      <span className="flex-1 text-gray-700 truncate">{label}</span>
      {product?.preco && included && (
        <span className="text-gray-400 shrink-0">{fmt(product.preco)}/{unit}</span>
      )}
      {included && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onQtyChange(Math.max(0, qty - 1))} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold">−</button>
          <input
            type="number" min="0" value={qty}
            onChange={e => onQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-weg-blue"
          />
          <button onClick={() => onQtyChange(qty + 1)} className="w-6 h-6 rounded bg-weg-blue text-white hover:bg-weg-blue/90 flex items-center justify-center font-bold">+</button>
          <span className="text-gray-400 w-6">{unit}</span>
        </div>
      )}
    </div>
  )
}

function InlineEditor({ quote, onApply, onCancel }) {
  const { catalogProducts, freteOpcoes, desconto } = useProducts()
  const kitData    = quote.data || {}
  const kitType    = kitData.kitType || 'ongrid_mono'
  const isTri      = kitType === 'ongrid_tri'
  const isMicro    = kitType === 'micro'
  const isBomb     = kitType === 'bombeamento'
  const targetKwp  = parseFloat(kitData.kwpDesejado || quote.kwp || 0)

  // ── Panel state ──
  const [tab, setTab]           = useState('modulos')
  const [selPanel, setSelPanel] = useState(kitData.panel || null)
  const [panelQty, setPanelQty] = useState(kitData.panelQty || 0)

  // ── Inverter state ──
  const [selInv, setSelInv] = useState(kitData.inverter || null)
  const [invQty, setInvQty] = useState(kitData.inverterQty || 1)
  const [mixList, setMixList] = useState(
    Array.isArray(kitData.inverters) ? kitData.inverters : null
  )
  const mixMode = Array.isArray(mixList)

  // ── Derived inverter metrics ──
  const curEntradas = mixMode
    ? (mixList || []).reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0)
    : (selInv?.entradas || 2)
  const curTotalInv = mixMode
    ? (mixList || []).reduce((s, i) => s + i.qty, 0)
    : 1

  // ── Accessory state — initialized from kitData or fresh defaults ──
  const initAcc = () => {
    const initE = Array.isArray(kitData.inverters)
      ? kitData.inverters.reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0)
      : (kitData.inverter?.entradas || 2)
    const initN = Array.isArray(kitData.inverters)
      ? kitData.inverters.reduce((s, i) => s + i.qty, 0)
      : 1
    const def = calcAccDefaults(isTri, initE, initN)
    return {
      mc4Qty:         kitData.mc4Qty         ?? def.mc4Qty,
      cablePosMeters: kitData.cablePosMeters ?? def.cablePosMeters,
      cableNegMeters: kitData.cableNegMeters ?? def.cableNegMeters,
      surgeACQty:     kitData.surgeACQty     ?? def.surgeACQty,
      inclSurgeCA:    kitData.inclSurgeCA    ?? def.inclSurgeCA,
      inclSurgeDC:    kitData.inclSurgeDC    ?? (!isMicro && !isBomb),
      surgeDCQty:     kitData.surgeDCQty     ?? 1,
      inclBreaker:    kitData.inclBreaker    ?? true,
      breakerQty:     kitData.breakerQty     ?? def.breakerQty,
    }
  }
  const [acc, setAcc] = useState(initAcc)
  const setA = (k, v) => setAcc(a => ({ ...a, [k]: v }))

  // Recalculate acc when inverter changes
  const resetAccForInverter = (entradas, totalInv) => {
    const def = calcAccDefaults(isTri, entradas, totalInv)
    setAcc(a => ({ ...a, mc4Qty: def.mc4Qty, cablePosMeters: def.cablePosMeters,
      cableNegMeters: def.cableNegMeters, surgeACQty: def.surgeACQty, breakerQty: def.breakerQty }))
  }

  // ── Structure state ──
  const [struct, setStruct] = useState({
    wants:          kitData.wantsEstrutura ?? null,
    roofType:       kitData.estruturaRoofType || '',
    isopleta:       kitData.estruturaIsopleta || 30,
    metalicoPerfil: kitData.metalicoPerfil || 'padrao',
    kit:            kitData.estruturaKit   || null,
    kit3:           kitData.estruturaKit3  || null,
    qty:            kitData.estruturaQty   || null,
    qty3:           kitData.estruturaQty3  || null,
  })
  const setS = (k, v) => setStruct(s => ({ ...s, [k]: v }))
  const handleRoofChange = (key) => setStruct(s => ({ ...s, roofType: key, kit: null, kit3: null, qty: null, qty3: null }))

  // ── Frete state ──
  const initFrete = freteOpcoes.find(f => Math.abs(f.acrescimo - (quote.frete_pct || 1)) < 0.001) || freteOpcoes[0] || null
  const [selFrete, setSelFrete] = useState(initFrete)

  // Nordeste detection (CD Nordeste panels only ship to Northeast)
  const isNordeste = useMemo(() => {
    const nome = ((selPanel || kitData.panel)?.modelo || (selPanel || kitData.panel)?.nome || '').toLowerCase()
    return nome.includes('nordeste')
  }, [selPanel, kitData.panel])

  // ── Product lookups ──
  const bySAP  = (sap) => catalogProducts.find(p => p.codigo === sap && p.preco)
  const byRole = (role) => catalogProducts.find(p => p.kitRole === role && p.preco)
  const mc4P      = bySAP(KIT_SAPS.MC4_6MM)     || byRole(KIT_ROLE.MC4)
  const cablePosP = bySAP(KIT_SAPS.CABO_CC_VML)  || byRole(KIT_ROLE.CABLE_POS)
  const cableNegP = bySAP(KIT_SAPS.CABO_CC_PTO)  || byRole(KIT_ROLE.CABLE_NEG)
  const surgeCAP  = bySAP(KIT_SAPS.SURGE_CA)     || byRole(KIT_ROLE.SURGE_AC)
  const surgeDCP  = byRole(KIT_ROLE.SURGE_DC)

  // ── Structure kits lookup ──
  const structKits = useMemo(() => {
    if (!struct.roofType || struct.roofType === 'Carport') return []
    const rt = ROOF_TYPES.find(r => r.key === struct.roofType)
    return catalogProducts.filter(p => {
      if (p.categoria !== CATEGORIES.ESTRUTURAS || !p.preco) return false
      const n  = p.nome || ''
      const nl = n.toLowerCase()
      if (struct.roofType === 'Metálico') {
        const perfil = METALICO_PERFIS.find(pf => pf.key === struct.metalicoPerfil)
        return perfil ? perfil.match(nl) : nl.includes('perfil 55cm')
      }
      if (rt?.hasIsopleta) {
        return n.includes(`(${struct.isopleta}-`) || n.includes(`/${struct.isopleta}-`)
      }
      // match roof type name in product name
      return nl.includes(struct.roofType.toLowerCase())
    })
  }, [catalogProducts, struct.roofType, struct.isopleta, struct.metalicoPerfil])

  // Auto-select first structure kit whenever the filtered list changes
  useEffect(() => {
    if (!struct.wants || structKits.length === 0) return
    const panels_qty = selPanel ? panelQty : (kitData.panelQty || 1)
    const first = structKits[0]
    const qty   = Math.ceil(panels_qty / (first.potencia || 1))
    setStruct(s => ({ ...s, kit: first, qty }))
  }, [structKits]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Catalog filters ──
  const panels   = catalogProducts.filter(p => p.kitRole === KIT_ROLE.PANEL && p.preco)
  const invCat   = CAT_FOR_TYPE[kitType]
  const inverters = catalogProducts.filter(p => {
    if (p.kitRole !== KIT_ROLE.INVERTER || !p.preco) return false
    if (invCat && p.categoria !== invCat) return false
    return true
  })

  const realKwp = (panelQty || 0) * ((selPanel?.potencia || 0) / 1000)
  const mixKw   = mixMode ? (mixList || []).reduce((s, i) => s + i.inverter.potencia * i.qty, 0) : 0

  const pickPanel = (p) => {
    setSelPanel(p)
    setPanelQty(Math.ceil((targetKwp * 1000) / p.potencia))
  }

  const getMixQty = (id) => mixList?.find(i => i.inverter.id === id)?.qty || 0
  const adjustMix = (inv, delta) => {
    const cur  = getMixQty(inv.id)
    const next = Math.max(0, cur + delta)
    let newList
    if (next === 0) newList = (mixList || []).filter(i => i.inverter.id !== inv.id)
    else if (cur === 0) newList = [...(mixList || []), { inverter: inv, qty: next }]
    else newList = (mixList || []).map(i => i.inverter.id === inv.id ? { ...i, qty: next } : i)
    setMixList(newList)
    const newE = newList.reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0)
    const newN = newList.reduce((s, i) => s + i.qty, 0)
    resetAccForInverter(newE, newN)
  }

  const doSelectSingleInv = (inv) => {
    setSelInv(inv)
    resetAccForInverter(inv.entradas || 2, 1)
  }

  const sizeTag = (inv) => {
    if (!realKwp) return null
    const r = inv.potencia / realKwp
    if (r >= 0.9 && r <= 1.2) return { cls: 'text-green-700 bg-green-100', txt: 'Ideal' }
    if (r >= 0.7 && r <= 1.5) return { cls: 'text-amber-700 bg-amber-100', txt: 'Aceitável' }
    return { cls: 'text-red-600 bg-red-100', txt: 'Fora de range' }
  }

  const doApply = () => {
    const updatedData = {
      ...kitData,
      panel:       selPanel || kitData.panel,
      panelQty:    panelQty || kitData.panelQty,
      inverter:    mixMode ? undefined : (selInv || kitData.inverter),
      inverterQty: mixMode ? undefined : invQty,
      inverters:   mixMode ? mixList : undefined,
      // Apply current accessory state
      mc4Qty:         acc.mc4Qty,
      cablePosMeters: acc.cablePosMeters,
      cableNegMeters: acc.cableNegMeters,
      surgeACQty:     acc.surgeACQty,
      inclSurgeCA:    acc.inclSurgeCA,
      inclSurgeDC:    acc.inclSurgeDC,
      surgeDCQty:     acc.surgeDCQty,
      inclBreaker:    acc.inclBreaker,
      breakerQty:     acc.breakerQty,
      // Structure
      wantsEstrutura:    struct.wants,
      estruturaRoofType: struct.roofType,
      estruturaIsopleta: struct.isopleta,
      metalicoPerfil:    struct.metalicoPerfil,
      estruturaKit:      struct.kit,
      estruturaKit3:     struct.kit3,
      estruturaQty:      struct.qty,
      estruturaQty3:     struct.qty3,
    }

    // Calcula itens e total para persistir no banco e no histórico
    const panel = updatedData.panel
    const pQty  = updatedData.panelQty || 0
    const rawItems = [
      panel && pQty > 0 && { label: 'Módulo Fotovoltaico', product: panel, qty: pQty, unit: 'un' },
      ...(mixMode && mixList
        ? mixList.map(e => ({ label: 'Inversor Solar', product: e.inverter, qty: e.qty, unit: 'un' }))
        : [(selInv || kitData.inverter) && {
            label: 'Inversor Solar',
            product: selInv || kitData.inverter,
            qty: mixMode ? 1 : invQty,
            unit: 'un',
          }]),
      !isMicro && acc.mc4Qty > 0 && mc4P &&
        { label: 'Conector MC4 6mm²', product: mc4P, qty: acc.mc4Qty, unit: 'pares' },
      !isMicro && acc.cablePosMeters > 0 && cablePosP &&
        { label: 'Cabo CC Vermelho (+)', product: cablePosP, qty: acc.cablePosMeters, unit: 'm' },
      !isMicro && acc.cableNegMeters > 0 && cableNegP &&
        { label: 'Cabo CC Preto (–)', product: cableNegP, qty: acc.cableNegMeters, unit: 'm' },
      !isMicro && !isBomb && acc.inclSurgeCA && surgeCAP &&
        { label: 'Protetor de Surto CA', product: surgeCAP, qty: acc.surgeACQty, unit: 'un' },
      !isMicro && !isBomb && acc.inclSurgeDC && surgeDCP &&
        { label: 'Protetor de Surto CC', product: surgeDCP, qty: acc.surgeDCQty, unit: 'un' },
      updatedData.wantsEstrutura && updatedData.estruturaKit && (updatedData.estruturaQty || 0) > 0 &&
        { label: 'Estrutura de Fixação', product: updatedData.estruturaKit, qty: updatedData.estruturaQty, unit: 'kit' },
      updatedData.wantsEstrutura && updatedData.estruturaKit3 && (updatedData.estruturaQty3 || 0) > 0 &&
        { label: 'Estrutura de Fixação', product: updatedData.estruturaKit3, qty: updatedData.estruturaQty3, unit: 'kit' },
      ...(kitData.avulsos || []).map(a => ({
        label: a.nome,
        product: { nome: a.nome, codigo: a.codigo || '—', preco: a.preco },
        qty: a.qty, unit: a.unit,
      })),
    ].filter(Boolean)

    const fatorDesc = round2(1 - (desconto / 100))
    const subtotal  = rawItems.reduce((s, i) => round2(s + round2((i.product?.preco || 0) * i.qty)), 0)
    const totalAjust = round2(subtotal * FATOR_BASE * fatorDesc)
    const newTotal   = round2(totalAjust * (selFrete?.acrescimo || 1))
    const dbItems = rawItems.map(i => ({
      label:      i.label,
      produto:    i.product.nome,
      codigo_sap: i.product.codigo,
      qty:        i.qty,
      unit:       i.unit,
      preco_unit: i.product.preco || 0,
      total:      round2((i.product.preco || 0) * i.qty),
    }))

    onApply(updatedData, selFrete, newTotal, dbItems)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">Alterar componentes</span>
        <span className="text-xs text-gray-400">— módulos, inversores, acessórios e estrutura</span>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
        <span>Meta: <strong className="text-weg-blue">{targetKwp} kWp</strong></span>
        {selPanel && (
          <span>
            <span className="font-medium">{selPanel.potencia} Wp</span> × {panelQty} =&nbsp;
            <strong className="text-green-700">{realKwp.toFixed(2)} kWp</strong>
          </span>
        )}
        {!mixMode && selInv && <span>Inv: <strong>{((selInv.potencia * invQty) / 1000).toFixed(2)} kW</strong></span>}
        {mixMode && mixKw > 0 && <span>Inv: <strong>{(mixKw / 1000).toFixed(2)} kW</strong></span>}
      </div>

      {/* Tab toggle — 3 tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        {[['modulos', '☀️ Módulos'], ['inversores', '⚡ Inversores'], ['acessorios', '🔧 Acessórios']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === key ? 'bg-weg-blue text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Módulos ── */}
      {tab === 'modulos' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {panels.length === 0
              ? <p className="col-span-2 text-center text-gray-400 py-6 text-sm">Nenhum módulo disponível na lista ativa.</p>
              : panels.map(p => {
                  const isSel = selPanel?.id === p.id
                  const qty   = Math.ceil((targetKwp * 1000) / p.potencia)
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickPanel(p)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-xs ${
                        isSel ? 'border-weg-blue bg-weg-blue/5' : 'border-gray-200 bg-white hover:border-weg-blue/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold text-gray-800 truncate">{p.modelo || p.nome}</span>
                        {isSel && <Check size={13} className="text-weg-blue shrink-0" />}
                      </div>
                      <p className="text-gray-400 mt-0.5">{p.potencia} Wp · {qty} un → {(qty * p.potencia / 1000).toFixed(2)} kWp</p>
                      <p className="text-weg-blue font-bold mt-1">{fmt(p.preco)}/un</p>
                    </button>
                  )
                })
            }
          </div>
          {selPanel && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package size={15} className="text-weg-blue" /> Ajustar quantidade de painéis
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setPanelQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={16} /></button>
                <input type="number" min="1" value={panelQty || 1} onChange={e => setPanelQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center border border-gray-200 rounded-lg px-2 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-weg-blue" />
                <button onClick={() => setPanelQty(q => q + 1)} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus size={16} /></button>
                <span className="text-gray-500 text-sm">painéis</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Total: {((panelQty || 1) * selPanel.potencia / 1000).toFixed(2)} kWp · {fmt(selPanel.preco * (panelQty || 1))} em módulos
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Inversores ── */}
      {tab === 'inversores' && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setMixList(null)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                !mixMode ? 'bg-weg-blue text-white border-weg-blue' : 'border-gray-200 text-gray-600 hover:border-weg-blue'
              }`}
            >⚡ Inversor único</button>
            <button
              onClick={() => { if (!mixMode) { const base = selInv ? [{ inverter: selInv, qty: invQty }] : []; setMixList(base) } }}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${
                mixMode ? 'bg-weg-blue text-white border-weg-blue' : 'border-gray-200 text-gray-600 hover:border-weg-blue'
              }`}
            >+ Mesclar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {inverters.length === 0
              ? <p className="col-span-2 text-center text-gray-400 py-6 text-sm">Nenhum inversor compatível na lista ativa.</p>
              : inverters.map(inv => {
                  const isSel = !mixMode && selInv?.id === inv.id
                  const mQty  = mixMode ? getMixQty(inv.id) : 0
                  const sz    = sizeTag(inv)
                  return (
                    <div key={inv.id} onClick={() => !mixMode && doSelectSingleInv(inv)}
                      className={`p-3 rounded-xl border-2 transition-all text-xs cursor-pointer ${
                        isSel || mQty > 0 ? 'border-weg-blue bg-weg-blue/5' : 'border-gray-200 bg-white hover:border-weg-blue/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold text-gray-800 truncate">{inv.modelo || inv.nome}</span>
                        {!mixMode && isSel && <Check size={13} className="text-weg-blue shrink-0" />}
                      </div>
                      <p className="text-gray-400 mt-0.5">{inv.potencia} kW · {inv.entradas || 2} entradas CC</p>
                      {sz && <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded mt-1 ${sz.cls}`}>{sz.txt}</span>}
                      <p className="text-weg-blue font-bold mt-1">{fmt(inv.preco)}/un</p>
                      {mixMode && (
                        <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => adjustMix(inv, -1)} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold">−</button>
                          <span className="font-bold w-4 text-center">{mQty}</span>
                          <button onClick={() => adjustMix(inv, 1)} className="w-6 h-6 rounded-lg bg-weg-blue text-white hover:bg-weg-blue/90 flex items-center justify-center font-bold">+</button>
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>

          {!mixMode && selInv && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package size={15} className="text-weg-blue" /> Quantidade de inversores
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setInvQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={16} /></button>
                <input type="number" min="1" value={invQty} onChange={e => setInvQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center border border-gray-200 rounded-lg px-2 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-weg-blue" />
                <button onClick={() => setInvQty(q => q + 1)} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus size={16} /></button>
                <span className="text-gray-500 text-sm">inversores</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Total: {((selInv.potencia * invQty) / 1000).toFixed(2)} kW · {fmt(selInv.preco * invQty)} em inversores
              </p>
            </div>
          )}

          {mixMode && mixList?.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
              {mixList.map(i => `${i.inverter.modelo || i.inverter.nome} × ${i.qty}`).join(' + ')} = {(mixKw / 1000).toFixed(2)} kW
            </div>
          )}
        </>
      )}

      {/* ── Acessórios & Estrutura ── */}
      {tab === 'acessorios' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Shield size={12} /> Acessórios — {curEntradas} entradas CC · {curTotalInv} inversor(es)
          </p>

          {/* Conectores MC4 */}
          {mc4P && (
            <AccRow label="Conectores MC4 6mm²" product={mc4P} unit="pares"
              included={acc.mc4Qty > 0} onToggle={() => setA('mc4Qty', acc.mc4Qty > 0 ? 0 : curEntradas)}
              qty={acc.mc4Qty} onQtyChange={v => setA('mc4Qty', v)} />
          )}

          {/* Cabo CC+ */}
          {cablePosP && (
            <AccRow label="Cabo CC Vermelho (6mm²)" product={cablePosP} unit="m"
              included={acc.cablePosMeters > 0} onToggle={() => setA('cablePosMeters', acc.cablePosMeters > 0 ? 0 : 25 * curEntradas)}
              qty={acc.cablePosMeters} onQtyChange={v => setA('cablePosMeters', v)} />
          )}

          {/* Cabo CC- */}
          {cableNegP && (
            <AccRow label="Cabo CC Preto (6mm²)" product={cableNegP} unit="m"
              included={acc.cableNegMeters > 0} onToggle={() => setA('cableNegMeters', acc.cableNegMeters > 0 ? 0 : 25 * curEntradas)}
              qty={acc.cableNegMeters} onQtyChange={v => setA('cableNegMeters', v)} />
          )}

          {/* Protetor Surto CA */}
          {!isBomb && surgeCAP && (
            <AccRow label="Protetor de Surto CA (SPW02)" product={surgeCAP}
              included={acc.inclSurgeCA} onToggle={() => setA('inclSurgeCA', !acc.inclSurgeCA)}
              qty={acc.surgeACQty} onQtyChange={v => setA('surgeACQty', v)} />
          )}

          {/* Protetor Surto CC */}
          {!isBomb && !isMicro && surgeDCP && (
            <AccRow label="Protetor de Surto CC (SPW12)" product={surgeDCP}
              included={acc.inclSurgeDC} onToggle={() => setA('inclSurgeDC', !acc.inclSurgeDC)}
              qty={acc.surgeDCQty} onQtyChange={v => setA('surgeDCQty', v)} />
          )}

          {/* Disjuntor CA */}
          {!isBomb && (
            <AccRow label="Minidisjuntor CA" product={null}
              included={acc.inclBreaker} onToggle={() => setA('inclBreaker', !acc.inclBreaker)}
              qty={acc.breakerQty} onQtyChange={v => setA('breakerQty', v)} />
          )}

          {/* ── Estrutura ── */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-300" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs font-semibold text-gray-400 uppercase">Estrutura de Fixação</span></div>
          </div>

          {struct.wants === null && (
            <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">🏗️ Incluir estrutura de fixação?</p>
              <p className="text-xs text-gray-500 mb-3">Kits para fixação dos painéis no telhado ou solo.</p>
              <div className="flex gap-2">
                <button onClick={() => setS('wants', true)} className="flex-1 py-2 rounded-lg bg-weg-blue text-white font-semibold text-xs">Sim, incluir</button>
                <button onClick={() => setS('wants', false)} className="flex-1 py-2 rounded-lg border-2 border-gray-200 text-gray-600 font-semibold text-xs">Não incluir</button>
              </div>
            </div>
          )}

          {struct.wants === false && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <span>🏗️ Estrutura não incluída</span>
              <button onClick={() => setS('wants', null)} className="text-weg-blue hover:underline">Alterar</button>
            </div>
          )}

          {struct.wants === true && (
            <div className="rounded-xl border-2 border-weg-blue bg-blue-50 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Home size={13} className="text-weg-blue" /> Tipo de cobertura</p>
                <button onClick={() => setStruct(s => ({ ...s, wants: null, roofType: '', kit: null, kit3: null, qty: null, qty3: null }))} className="text-xs text-gray-400 hover:underline">Remover</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ROOF_TYPES.map(rt => (
                  <button key={rt.key} onClick={() => handleRoofChange(rt.key)}
                    className={`rounded-lg p-2 text-center border-2 transition-all text-xs font-medium ${
                      struct.roofType === rt.key ? 'border-weg-blue bg-white text-weg-blue shadow-sm' : 'border-blue-100 bg-white/70 text-gray-600 hover:border-weg-blue/50'
                    }`}
                  >
                    <span className="text-lg block mb-0.5">{rt.emoji}</span>
                    <span className="leading-tight text-[10px] block">{rt.label}</span>
                  </button>
                ))}
              </div>

              {/* Isopleta */}
              {struct.roofType && ROOF_TYPES.find(r => r.key === struct.roofType)?.hasIsopleta && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Isopleta de vento (m/s)</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ISOPLETA_OPTIONS.map(iso => (
                      <button key={iso} onClick={() => setStruct(s => ({ ...s, isopleta: iso, kit: null, kit3: null }))}
                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
                          struct.isopleta === iso ? 'border-weg-blue bg-weg-blue text-white' : 'border-blue-200 bg-white text-gray-600 hover:border-weg-blue'
                        }`}
                      >{iso}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Metálico profile */}
              {struct.roofType === 'Metálico' && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Perfil</p>
                  <div className="flex gap-1.5">
                    {METALICO_PERFIS.map(pf => (
                      <button key={pf.key} onClick={() => setStruct(s => ({ ...s, metalicoPerfil: pf.key, kit: null, kit3: null }))}
                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
                          struct.metalicoPerfil === pf.key ? 'border-weg-blue bg-weg-blue text-white' : 'border-blue-200 bg-white text-gray-600 hover:border-weg-blue'
                        }`}
                      >{pf.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Carport */}
              {struct.roofType === 'Carport' && (
                <p className="text-center text-sm font-semibold text-gray-500 py-2">Sob consulta</p>
              )}

              {/* Structure kits */}
              {struct.roofType && struct.roofType !== 'Carport' && structKits.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Selecionar kit</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {structKits.map(k => {
                      const isSel = struct.kit?.id === k.id
                      const unitsNeeded = Math.ceil((selPanel ? panelQty : kitData.panelQty || 1) / (k.potencia || 1))
                      return (
                        <button key={k.id} onClick={() => setStruct(s => ({ ...s, kit: k, qty: unitsNeeded }))}
                          className={`w-full text-left p-2.5 rounded-lg border-2 text-xs transition-all ${
                            isSel ? 'border-weg-blue bg-weg-blue/5' : 'border-blue-100 bg-white hover:border-weg-blue/50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-gray-800 truncate">{k.nome}</span>
                            {isSel && <Check size={12} className="text-weg-blue shrink-0" />}
                          </div>
                          <div className="flex justify-between text-gray-400 mt-0.5">
                            <span>{unitsNeeded} un · {fmt(k.preco)}/un</span>
                            <span className="font-semibold">{fmt(k.preco * unitsNeeded)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {struct.roofType && struct.roofType !== 'Carport' && structKits.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Nenhum kit de estrutura disponível para este tipo na lista ativa.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Frete ── */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🚛 Condição de frete</p>
        <select
          value={selFrete?.id ?? ''}
          onChange={e => setSelFrete(freteOpcoes.find(f => f.id === Number(e.target.value)) || null)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-weg-blue text-gray-700"
        >
          {freteOpcoes.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>

        {/* Nordeste warning */}
        {isNordeste && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
            <p>
              <strong>Atenção:</strong> o módulo selecionado é de distribuição <strong>CD Nordeste</strong>.
              A condição de frete será considerada apenas para entregas na <strong>Região Nordeste</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button onClick={onCancel} className="px-4 py-2.5 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:border-gray-300">
          Cancelar
        </button>
        <button onClick={doApply} className="flex-1 bg-weg-blue text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-weg-blue/90">
          Aplicar e ver resumo →
        </button>
      </div>
    </div>
  )
}

// ─── Quote Detail Modal ────────────────────────────────────────────────────────
function QuoteDetailModal({ quote, onClose, onLoadQuote, onStatusChange, onRefresh, onGoToFechados }) {
  const items    = quote.quote_items || []
  const kitData  = quote.data || {}
  const revisoes = kitData.revisoes || []

  const [confirmAction, setConfirmAction] = useState(null) // 'fechar' | 'rejeitar'
  const [processing, setProcessing]       = useState(false)
  const [done, setDone]                   = useState(null)  // 'fechar' | 'rejeitar'
  const [showRevHistory, setShowRevHistory] = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [successData, setSuccessData]     = useState(null)
  const [countdown, setCountdown]         = useState(4)
  const [isPrinting, setIsPrinting]       = useState(false)
  const [printRevision, setPrintRevision] = useState(null)

  // Auto-close after success
  useEffect(() => {
    if (!successData) return
    if (countdown <= 0) { onRefresh?.(); onClose(); return }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [successData, countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyEdit = async (updatedData, selFrete, newTotal, dbItems) => {
    const novaRevisao = (kitData.revisao || 0) + 1
    const freteNome   = selFrete?.nome || quote.frete_nome || '—'
    const fretePct    = selFrete?.acrescimo || quote.frete_pct || 1
    const totalFinal  = newTotal ?? quote.total_final ?? 0
    const historicoRevisao = {
      revisao:     novaRevisao,
      data:        new Date().toISOString(),
      total_final: totalFinal,
      frete:       freteNome,
      items:       dbItems || [],
    }
    const newData = {
      ...updatedData,
      revisao:  novaRevisao,
      revisoes: [...(kitData.revisoes || []), historicoRevisao],
    }
    await supabaseAdmin.from('quotes').update({
      data:        newData,
      frete_nome:  freteNome,
      frete_pct:   fretePct,
      total_final: totalFinal,
    }).eq('id', quote.id)

    // Atualiza itens do kit no banco
    if (dbItems && dbItems.length > 0) {
      await supabaseAdmin.from('quote_items').delete().eq('quote_id', quote.id)
      await supabaseAdmin.from('quote_items').insert(dbItems.map(i => ({ ...i, quote_id: quote.id })))
    }

    setEditMode(false)
    setSuccessData(newData)
  }

  const totalBase = quote.frete_pct && quote.frete_pct > 1
    ? (quote.total_final / quote.frete_pct)
    : quote.total_final
  const freteAmt = (quote.total_final || 0) - (totalBase || 0)

  const isClosed = ['fechado', 'implantado', 'perdida'].includes(quote.status)

  const handleAction = async (type) => {
    setProcessing(true)
    const newStatus = type === 'fechar' ? 'fechado' : 'perdida'
    const { error } = await supabaseAdmin
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quote.id)
    setProcessing(false)
    if (error) {
      alert(`Erro ao atualizar o kit: ${error.message}`)
      setConfirmAction(null)
      return
    }
    onStatusChange(quote.id, newStatus)
    await onRefresh?.(true)
    setDone(type)
    setConfirmAction(null)
  }

  const handlePrint = () => {
    setIsPrinting(true)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.addEventListener('afterprint', () => setIsPrinting(false), { once: true })
      window.print()
    }))
  }

  const handlePrintRevision = (r) => {
    setPrintRevision(r)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.addEventListener('afterprint', () => setPrintRevision(null), { once: true })
      window.print()
    }))
  }

  // ── Confirmation overlay ──
  if (confirmAction) {
    const isFechar = confirmAction === 'fechar'
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isFechar ? 'bg-orange-100' : 'bg-red-100'}`}>
              {isFechar ? <Package size={22} className="text-orange-500" /> : <XCircle size={22} className="text-red-500" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">
                {isFechar ? 'Fechar kit e solicitar implantação?' : 'Rejeitar proposta?'}
              </h3>
              <p className="text-gray-500 text-sm">
                {isFechar
                  ? 'O time de implementação será notificado. Após fechamento o kit não poderá ser editado.'
                  : 'A proposta será marcada como perdida. Esta ação não pode ser desfeita.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleAction(confirmAction)}
              disabled={processing}
              className={`flex-1 font-semibold py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${isFechar ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {processing
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando…</>
                : isFechar ? <><Check size={15} /> Sim, fechar kit</> : <><XCircle size={15} /> Sim, rejeitar</>}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:border-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Success overlay ──
  if (done) {
    const isFechar = done === 'fechar'
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isFechar ? 'bg-orange-100' : 'bg-red-100'}`}>
            {isFechar
              ? <Package size={36} className="text-orange-500" />
              : <XCircle size={36} className="text-red-500" />}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {isFechar ? 'Kit solicitado para implantação!' : 'Proposta marcada como perdida'}
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            {isFechar
              ? 'Nossa equipe recebeu a solicitação e entrará em contato para confirmar a implantação.'
              : 'A proposta foi arquivada como perdida.'}
          </p>
          {isFechar ? (
            <button
              onClick={() => { onGoToFechados?.() }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <Package size={16} /> Ver Kits Fechados →
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary px-8 py-3">Fechar</button>
          )}
        </div>
      </div>
    )
  }

  // ── Edit-success overlay ──
  if (successData) {
    const sd = successData
    const invLines = Array.isArray(sd.inverters)
      ? sd.inverters.map(i => `${i.inverter?.modelo || i.inverter?.nome || '—'} × ${i.qty}`)
      : sd.inverter
        ? [`${sd.inverter.modelo || sd.inverter.nome || '—'} × ${sd.inverterQty || 1}`]
        : []
    const numOrc = kitData.numero_orcamento || quote.id.slice(0, 8).toUpperCase()
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-0.5">Kit atualizado!</h3>
            <p className="text-xs text-gray-400">Cotação {numOrc} · componentes salvos</p>
          </div>

          {/* Kit summary card */}
          <div className="w-full bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100 text-left text-sm">
            {/* Panel */}
            {sd.panel && (
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg">☀️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{sd.panel.modelo || sd.panel.nome}</p>
                  <p className="text-xs text-gray-400">{sd.panel.potencia} Wp × {sd.panelQty} un = {((sd.panelQty * sd.panel.potencia) / 1000).toFixed(2)} kWp</p>
                </div>
              </div>
            )}
            {/* Inverters */}
            {invLines.map((line, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg">⚡</span>
                <p className="font-semibold text-gray-800 truncate">{line}</p>
              </div>
            ))}
            {/* Accessories summary */}
            {(sd.mc4Qty > 0 || sd.cablePosMeters > 0 || sd.inclSurgeCA || sd.inclBreaker) && (
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🔧</span>
                <p className="text-xs text-gray-600">
                  {[
                    sd.mc4Qty > 0 && `MC4 × ${sd.mc4Qty}`,
                    sd.cablePosMeters > 0 && `Cabo CC ${sd.cablePosMeters}m`,
                    sd.inclSurgeCA && `Surto CA × ${sd.surgeACQty}`,
                    sd.inclBreaker && `Disjuntor × ${sd.breakerQty}`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}
            {/* Structure */}
            {sd.wantsEstrutura && sd.estruturaRoofType && (
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🏗️</span>
                <p className="text-xs text-gray-600">
                  {ROOF_TYPES.find(r => r.key === sd.estruturaRoofType)?.label || sd.estruturaRoofType}
                  {sd.estruturaKit && ` · ${sd.estruturaKit.nome}`}
                </p>
              </div>
            )}
          </div>

          {/* Countdown */}
          <p className="text-xs text-gray-400">Voltando às cotações em <strong>{countdown}s</strong>…</p>
          <button
            onClick={() => { onRefresh?.(); onClose() }}
            className="w-full bg-weg-blue text-white font-semibold py-3 rounded-xl text-sm hover:bg-weg-blue/90"
          >
            Ver cotações agora →
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    {/* Revision print overlay — visible only during print */}
    {printRevision && (
      <div id="kit-print" className="fixed inset-0 bg-white z-[9999] overflow-auto">
        <div className="bg-[#1B3A8A] text-white px-8 py-6 flex items-center justify-between print-header">
          <img src="/logo-ernaniff-branco.png" alt="Ernaniff" className="h-10"
            onError={e => { e.target.style.display = 'none' }} />
          <div className="text-right">
            <p className="font-mono font-bold text-xl">
              {kitData.numero_orcamento ? `${kitData.numero_orcamento}-R${printRevision.revisao}` : `Rev. ${printRevision.revisao}`}
            </p>
            <p className="text-white/70 text-sm">{quote.nome_projeto}</p>
            <p className="text-white/60 text-xs">{fmtDate(printRevision.data)}</p>
          </div>
        </div>
        <div className="px-8 py-6 space-y-4">
          {kitData.clienteNome && (
            <p className="text-sm text-gray-600"><strong>Cliente:</strong> {kitData.clienteNome}</p>
          )}
          {printRevision.items?.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Composição do Kit</h3>
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Item</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Produto / SAP</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Qtd</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Unitário</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printRevision.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-xs font-medium text-gray-800">{item.label}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        <div>{item.produto}</div>
                        <div className="font-mono text-gray-400">{item.codigo_sap}</div>
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-gray-700">{item.qty} {item.unit}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">{fmt(item.preco_unit)}</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-gray-800">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Itens do kit não disponíveis para esta revisão.</p>
          )}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Frete — {printRevision.frete}</span>
              <span className="text-green-600 font-medium">Incluso</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-extrabold text-gray-900">
              <span>Total Final</span>
              <span className="text-[#1B3A8A] text-lg">{fmt(printRevision.total_final)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center pt-4">
            Revisão {printRevision.revisao} — emitida em {fmtDate(printRevision.data)}
          </p>
        </div>
      </div>
    )}

    <div id={isPrinting ? 'kit-print' : undefined} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto print:rounded-none print:shadow-none print:max-h-none">

        {/* Header */}
        <div className="sticky top-0 bg-weg-blue text-white px-6 py-4 flex items-start justify-between gap-3 print:static">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {kitData.numero_orcamento && (
                <span className="font-mono font-bold text-lg">{kitData.numero_orcamento}</span>
              )}
              {(kitData.revisao || 0) > 0 && (
                <span className="bg-white/20 text-xs font-semibold px-2 py-0.5 rounded-full">Rev. {kitData.revisao}</span>
              )}
            </div>
            <p className="text-white/80 text-sm">{quote.nome_projeto}</p>
            {kitData.clienteNome && (
              <p className="text-white/60 text-xs">Referência: {kitData.clienteNome}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={quote.status} />
            <button onClick={onClose} className="print:hidden p-1.5 rounded-lg hover:bg-white/20">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {editMode ? (
            <InlineEditor
              quote={quote}
              onApply={handleApplyEdit}
              onCancel={() => setEditMode(false)}
            />
          ) : (<>

          {/* Kit items table */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Package size={13} /> Composição do kit
            </h4>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Item</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs hidden sm:table-cell">Produto / SAP</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs">Qtd</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs">Unitário</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-xs">Nenhum item registrado</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{item.label}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs hidden sm:table-cell">
                        <div className="truncate max-w-[200px]">{item.produto}</div>
                        <div className="font-mono text-gray-400">{item.codigo_sap}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-gray-700 text-xs">{item.qty} {item.unit}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{fmt(item.preco_unit)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800 text-xs">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Valor de tabela (bruto)</span>
              <span className="font-medium">{fmt(quote.subtotal)}</span>
            </div>
            {quote.desconto_pct > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto comercial ({quote.desconto_pct}%)</span>
                <span className="font-medium">−{fmt((quote.subtotal || 0) * (quote.desconto_pct / 100))}</span>
              </div>
            )}
            {freteAmt > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frete — {quote.frete_nome}</span>
                <span className="font-medium">+{fmt(freteAmt)}</span>
              </div>
            )}
            {freteAmt === 0 && quote.frete_nome && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Frete — {quote.frete_nome}</span>
                <span className="text-green-600 font-medium">Incluso (FOB)</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-extrabold text-gray-900">
              <span>Total Final</span>
              <span className="text-weg-blue text-lg">{fmt(quote.total_final)}</span>
            </div>
          </div>

          {/* Admin discount response */}
          {quote.desconto_resposta && (
            <div className={`rounded-xl p-4 text-sm ${
              quote.status === 'aprovada' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-gray-50 border border-gray-200 text-gray-600'
            }`}>
              <p className="font-semibold mb-0.5">
                {quote.status === 'aprovada' ? '✓ Desconto aprovado' : 'Resposta do administrador'}
              </p>
              <p className="text-xs">{quote.desconto_resposta}</p>
            </div>
          )}

          {/* Implantation confirmation */}
          {quote.status === 'implantado' && (
            <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Implantação confirmada!</p>
                <p className="text-xs">O kit foi confirmado pelo time técnico e está em processo de implantação.</p>
              </div>
            </div>
          )}

          {/* Revision history */}
          {revisoes.length > 0 && (
            <div>
              <button
                onClick={() => setShowRevHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-weg-blue hover:text-weg-blue transition-colors"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} /> Histórico de revisões
                  <span className="bg-weg-blue/10 text-weg-blue text-xs px-2 py-0.5 rounded-full">{revisoes.length}</span>
                </span>
                {showRevHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showRevHistory && (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Revisão</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Data</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-500">Frete</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-500">Total</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {revisoes.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono font-bold text-weg-blue">
                            {kitData.numero_orcamento ? `${kitData.numero_orcamento}-R${r.revisao}` : `Rev. ${r.revisao}`}
                          </td>
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(r.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2 text-gray-400 truncate max-w-[140px]">{r.frete}</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-700">{fmt(r.total_final)}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handlePrintRevision(r)}
                              title="Imprimir esta revisão"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-weg-blue hover:bg-weg-blue/10 transition-colors"
                            >
                              <Printer size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="print:hidden border-t border-gray-100 pt-4 flex flex-wrap gap-2 justify-end">
            {/* PDF */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 bg-white px-4 py-2 rounded-xl font-semibold"
            >
              <Printer size={15} /> Imprimir / PDF
            </button>

            {!isClosed && (
              <>
                {/* Revisar */}
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 text-sm text-weg-blue border border-weg-blue/30 bg-weg-blue/5 hover:bg-weg-blue/10 px-4 py-2 rounded-xl font-semibold"
                >
                  <Edit3 size={15} /> Revisar / Alterar kit
                </button>

                {/* Rejeitar */}
                <button
                  onClick={() => setConfirmAction('rejeitar')}
                  className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl font-semibold"
                >
                  <XCircle size={15} /> Rejeitar proposta
                </button>

                {/* Fechar Kit */}
                <button
                  onClick={() => setConfirmAction('fechar')}
                  className="flex items-center gap-1.5 text-sm text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-xl font-semibold"
                >
                  <Check size={15} /> Fechar kit
                </button>
              </>
            )}
          </div>
          </>)}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const CLOSED_STATUSES = ['fechado', 'implantado', 'perdida']

export default function MinhasCotacoesPage({ onLoadQuote }) {
  const { session } = useAuth()
  const [quotes, setQuotes]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [expandedId, setExpandedId]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingId, setDeletingId]   = useState(null)
  const [activeTab, setActiveTab]     = useState('ativas') // 'ativas' | 'fechados'

  const activeQuotes = quotes.filter(q => !CLOSED_STATUSES.includes(q.status))
  const closedQuotes = quotes.filter(q => CLOSED_STATUSES.includes(q.status))

  const fetchQuotes = async (silent = false) => {
    if (!session?.user?.id) return
    if (!silent) setLoading(true)
    const { data } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    if (!silent) setLoading(false)
  }

  useEffect(() => { fetchQuotes() }, [session?.user?.id])

  const handleStatusChange = (id, newStatus) => {
    setQuotes(qs => qs.map(q => q.id === id ? { ...q, status: newStatus } : q))
    // Update the selected quote too if it's open
    setSelectedQuote(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
  }

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={24} className="text-weg-blue" /> Minhas Cotações
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{quotes.length} cotaç{quotes.length === 1 ? 'ão' : 'ões'} salvas</p>
        </div>
        <button
          onClick={fetchQuotes}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-weg-blue px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('ativas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${
            activeTab === 'ativas'
              ? 'bg-weg-blue text-white border-weg-blue'
              : 'bg-white text-gray-500 border-gray-200 hover:border-weg-blue/50'
          }`}
        >
          <FileText size={15} /> Cotações Ativas
          {activeQuotes.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'ativas' ? 'bg-white/20' : 'bg-weg-blue/10 text-weg-blue'}`}>
              {activeQuotes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('fechados')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${
            activeTab === 'fechados'
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-gray-500 border-gray-200 hover:border-orange-400'
          }`}
        >
          <Package size={15} /> Kits Fechados
          {closedQuotes.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'fechados' ? 'bg-white/20' : 'bg-orange-100 text-orange-600'}`}>
              {closedQuotes.length}
            </span>
          )}
        </button>
      </div>

      {/* ── KITS FECHADOS TAB ── */}
      {activeTab === 'fechados' && (
        closedQuotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <Package size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Nenhum kit fechado</h3>
            <p className="text-sm text-gray-400">Kits fechados para implantação aparecerão aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-orange-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cotação / Referência</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Potência</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Frete</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">OV</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {closedQuotes.map(q => {
                    const kd = q.data || {}
                    const st = STATUS_STYLE[q.status] || STATUS_STYLE.fechado
                    const Icon = st.icon
                    return (
                      <tr key={q.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(q.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => setSelectedQuote(q)} className="font-mono font-bold text-sm text-weg-blue hover:underline">
                            {kd.numero_orcamento || q.id.slice(0, 8).toUpperCase()}
                          </button>
                          {kd.referencia_cliente && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{kd.referencia_cliente}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-sm font-semibold text-gray-700">{q.kwp} kWp</span>
                          <p className="text-xs text-gray-400">{(q.kit_type || '').replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 hidden md:table-cell truncate max-w-[140px]">
                          {q.frete_nome || '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}>
                            <Icon size={11} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {kd.ov_numero
                            ? <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{kd.ov_numero}</span>
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-800 text-sm whitespace-nowrap">
                          {fmt(q.total_final)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── COTAÇÕES ATIVAS TAB ── */}
      {activeTab === 'ativas' && (activeQuotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <FileText size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Nenhuma cotação ativa</h3>
          <p className="text-sm text-gray-400">Acesse "Monte seu Kit" e imprima uma cotação para ela aparecer aqui.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data de Emissão</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Número da Cotação</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revisão</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Referência do Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor Total</th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {activeQuotes.map(q => {
                  const kitData = q.data || {}
                  const revisoes = kitData.revisoes || []
                  const hasRevisions = revisoes.length > 0
                  const isExpanded = expandedId === q.id

                  return (
                    <>
                      {/* Main row — current revision */}
                      <tr
                        key={q.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {fmtDate(q.created_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setSelectedQuote(q)}
                            className="font-mono font-bold text-sm text-weg-blue hover:underline"
                          >
                            {kitData.numero_orcamento || q.id.slice(0, 8).toUpperCase()}
                          </button>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`text-sm font-bold ${(kitData.revisao || 0) > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                            {kitData.revisao || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                          {kitData.clienteNome || '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-900 text-sm whitespace-nowrap">
                          {fmt(q.total_final)}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasRevisions && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : q.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-weg-blue hover:bg-blue-50 transition-colors"
                                title="Histórico de revisões"
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            )}
                            {confirmDelete === q.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(q.id)}
                                  disabled={deletingId === q.id}
                                  className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg disabled:opacity-50"
                                >
                                  {deletingId === q.id ? '…' : 'Sim'}
                                </button>
                                <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">Não</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(q.id)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Revision sub-rows (expandable) */}
                      {isExpanded && revisoes.map((r, ri) => (
                        <tr key={`${q.id}-rev-${ri}`} className="bg-purple-50/40 border-b border-purple-100/50">
                          <td className="px-4 py-2.5 text-xs text-gray-500 pl-8">
                            {fmtDate(r.data)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs text-gray-500">
                              {kitData.numero_orcamento || ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs font-bold text-purple-600">{r.revisao}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">—</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status="revisada" />
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                            {fmt(r.total_final)}
                          </td>
                          <td className="px-3 py-2.5" />
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Detail Modal */}
      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onLoadQuote={onLoadQuote}
          onStatusChange={handleStatusChange}
          onRefresh={fetchQuotes}
          onGoToFechados={async () => { await fetchQuotes(true); setActiveTab('fechados'); setSelectedQuote(null) }}
        />
      )}
    </div>
  )
}
