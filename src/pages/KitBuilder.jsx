import { useState, useMemo, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { notifyDescontoSolicitado } from '../lib/notify'
import { KIT_ROLE, CATEGORIES } from '../data/products'
import { ESTADOS } from '../data/cidadesPorEstado'
import { getProductImage, KIT_TYPE_IMG } from '../data/productImages'
import kitCompositions from '../data/kitCompositions.json'
import { getInverterSpecs } from '../data/inverterSpecs'
import {
  Sun, Zap, Link2, Shield, Cable, ToggleLeft, ChevronRight, ChevronLeft,
  Printer, Plus, Minus, Check, Info, AlertTriangle, Calculator, RefreshCw,
  Package, User, FileText, Home, ChevronDown, Search, Save, BadgePercent,
  CheckCircle2, XCircle, Clock, X, Battery, Cpu
} from 'lucide-react'

function ProductImg({ src, alt, fallback, className }) {
  const [err, setErr] = useState(false)
  if (!src || err) return <span className="text-4xl">{fallback}</span>
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
    />
  )
}

// ─── Mini-thumbnail de item na tabela de proposta / impressão ────────────
function ItemThumb({ product, alt }) {
  const [err, setErr] = useState(false)
  const src = product ? getProductImage(product) : null
  if (!src || err) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-lg shrink-0">
        📦
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
      <img src={src} alt={alt} className="w-full h-full object-contain p-1" onError={() => setErr(true)} />
    </div>
  )
}

const STEPS_BASE = [
  { id: 1, label: 'Tipo de Kit',     icon: Home },
  { id: 2, label: 'Dimensionamento', icon: Calculator },
  { id: 3, label: 'Módulos',         icon: Sun },
  { id: 4, label: 'Inversor',        icon: Zap },
  { id: 5, label: 'Acessórios',      icon: Shield },
  { id: 6, label: 'Resumo',          icon: FileText },
]
const STEPS_HYBRID = [
  { id: 1, label: 'Tipo de Kit',     icon: Home },
  { id: 2, label: 'Dimensionamento', icon: Calculator },
  { id: 3, label: 'Módulos',         icon: Sun },
  { id: 4, label: 'Inversor',        icon: Zap },
  { id: 5, label: 'Bateria',         icon: Battery },
  { id: 6, label: 'Acessórios',      icon: Shield },
  { id: 7, label: 'Resumo',          icon: FileText },
]

// Tipos de kit disponíveis
const KIT_TYPES = [
  {
    key: 'ongrid_mono',
    title: 'On-Grid Monofásico',
    subtitle: '220 V',
    icon: '⚡',
    color: 'blue',
    desc: 'Gerador solar conectado à rede elétrica. Ideal para residências e pequenos comércios com padrão monofásico.',
    catLabel: 'Inversores Monofásicos',
  },
  {
    key: 'ongrid_tri',
    title: 'On-Grid Trifásico',
    subtitle: '380 V',
    icon: '🏭',
    color: 'indigo',
    desc: 'Gerador solar para indústrias, comércios médios e grandes instalações com padrão trifásico.',
    catLabel: 'Inversores Trifásicos',
  },
  {
    key: 'micro',
    title: 'Microinversor',
    subtitle: 'Módulo a módulo',
    icon: '🔌',
    color: 'purple',
    desc: 'Cada painel tem seu próprio inversor. Ideal para telhados com sombreamento parcial ou orientações diferentes.',
    catLabel: 'Microinversores',
  },
  {
    key: 'bombeamento',
    title: 'Bombeamento Solar',
    subtitle: 'Inversor de frequência',
    icon: '💧',
    color: 'cyan',
    desc: 'Sistema para bombeamento de água com energia solar. Ideal para irrigação, propriedades rurais e abastecimento.',
    catLabel: 'Inversores de Bombeamento',
  },
]

// Mapa de tipo de kit → categoria de inversor
const KIT_TYPE_TO_CAT = {
  ongrid_mono: CATEGORIES.INVERSORES_MONO,
  ongrid_tri:  CATEGORIES.INVERSORES_TRI,
  micro:       CATEGORIES.MICROINVERSORES,
  bombeamento: CATEGORIES.INVERSORES_BOMBEAMENTO,
}

// Códigos SAP dos acessórios-padrão por tipo de kit (extraídos das abas da planilha WEG)
const KIT_SAPS = {
  // Comuns
  MC4_6MM:     '15848565',  // Conector MC4 6mm²
  CABO_CC_PTO: '13677909',  // Cabo CC Unipolar NH 6mm² Preto
  CABO_CC_VML: '13677908',  // Cabo CC Unipolar NH 6mm² Vermelho
  // On-Grid (string)
  SURGE_CA:    '14827873',  // Protetor Surto CA SPW02-275-20
  // Bombeamento
  SURGE_CC_12: '14827930',  // Protetor Surto CC SPW12-1100-40
  FUSIVEL_CC:  '17349296',  // Fusível cartucho CC gPV UR 25A
  BASE_FUS:    '17486499',  // Base fusível CC gPV 10X38mm 1P 32A
  SECCION_CC:  '17648938',  // Chave seccionadora CC 4P 1000V ES100-32A
  GATEWAY:     '15557556',  // Monitoramento Gateway WEG ED100
  KIT_DETECT:  '14987105',  // Kit acessórios Módulo Detecção Solar CFW500-KDS
  KIT_SOLAR5W: '18753608',  // Kit acessórios Módulo Solar 5W 17mm RESUN
  // Microinversor
  KIT_CONN_MI:    '18460783',  // Kit conector CA SIW100G W10
  CABO_CA_M010:   '17707221',  // Cabo CA SIW100G M010 (monofásico)
  CABO_CA_M024:   '18512552',  // Cabo CA MP Flex HEPR/NH 3X6mm² 90°C PT 1kV (M024)
  // Bombeamento — Chaves de transferência CA
  CHAVE_CA_2P: '17717300',  // Chave CA S6-02002DS0 (monofásico 220V)
  CHAVE_CA_4P: '17717302',  // Chave CA S6-04002DS0 (trifásico 380V)
}

const SUN_HOURS = 4.5 // HSP médio Brasil

// Localiza no catálogo o disjuntor pelo código do campo disjuntor do inversor.
// Busca primeiro por modelo exato, depois por nome que contenha o código,
// e faz fallback para o primeiro produto com KIT_ROLE.BREAKER.
// Funciona com qualquer tabela importada — sem mapa estático.
function findBreakerProduct(products, disCode) {
  if (!disCode) return products.find(p => p.kitRole === KIT_ROLE.BREAKER)
  return (
    products.find(p => p.kitRole === KIT_ROLE.BREAKER && p.modelo === disCode) ||
    products.find(p => p.kitRole === KIT_ROLE.BREAKER && (p.nome || '').includes(disCode)) ||
    products.find(p => p.kitRole === KIT_ROLE.BREAKER)
  )
}

// Agrupa inversores do mix por código de disjuntor.
// Retorna [{dis, qty, product}] — um item por código único.
function buildBreakerGroups(inverters, products, selections) {
  return inverters.reduce((acc, { inverter: i, qty }) => {
    const dis = i?.disjuntor || '__none__'
    const existing = acc.find(g => g.dis === dis)
    if (existing) { existing.qty += qty; return acc }
    acc.push({
      dis,
      qty,
      product: selections?.[dis] || findBreakerProduct(products, dis !== '__none__' ? dis : null),
    })
    return acc
  }, [])
}

// Calcula o total de protetores de surto CA respeitando a fase de cada inversor.
function calcSurgeACQty(inverters, defaultTri) {
  return inverters.reduce((s, { inverter: i, qty }) => {
    const tri = (i?.categoria || '').toLowerCase().includes('trifásico') || defaultTri
    return s + (tri ? 4 : 2) * qty
  }, 0)
}

// Round to 2 decimal places — uses exponential notation to avoid JS float drift
// e.g. Math.round(1.005 * 100)/100 = 1.00 (wrong); this returns 1.01 (correct)
function round2(v) {
  return Number(Math.round(Number(String(+v) + 'e2')) + 'e-2')
}

// Money multiplication for display only — round2 applied to final product
function moneyMul(preco, qty) { return round2((preco || 0) * (qty || 0)) }

function fmt(v) {
  if (!v && v !== 0) return 'Sob consulta'
  return round2(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(v) {
  if (!v && v !== 0) return 'Sob consulta'
  return Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function StepIndicator({ current, onNavigate, steps = STEPS_BASE }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const Icon = step.icon
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex flex-col items-center gap-1 min-w-[64px] ${done ? 'cursor-pointer group' : ''}`}
              onClick={() => done && onNavigate?.(step.id)}
              title={done ? `Voltar para ${step.label}` : undefined}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                done ? 'bg-green-500 text-white group-hover:bg-green-400 group-hover:scale-110' :
                active ? 'bg-weg-blue text-white ring-4 ring-blue-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight transition-colors ${
                active ? 'text-weg-blue' : done ? 'text-green-600 group-hover:text-green-500' : 'text-gray-400'
              }`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mb-5 mx-1 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Tipo de Kit ─────────────────────────────────────────────────────
function StepKitType({ data, onChange }) {
  const colors = {
    blue:   { border: 'border-blue-500',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700',   ring: 'ring-blue-200',   icon: 'bg-blue-500'   },
    indigo: { border: 'border-indigo-500', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700',ring: 'ring-indigo-200', icon: 'bg-indigo-500' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700',ring: 'ring-purple-200', icon: 'bg-purple-500' },
    cyan:   { border: 'border-cyan-500',   bg: 'bg-cyan-50',   badge: 'bg-cyan-100 text-cyan-700',   ring: 'ring-cyan-200',   icon: 'bg-cyan-500'   },
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Qual kit o cliente deseja montar?</h2>
        <p className="text-gray-500 text-sm">Selecione o tipo de sistema para filtrar os inversores compatíveis</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {KIT_TYPES.map(kt => {
          const selected = data.kitType === kt.key
          const c = colors[kt.color]
          return (
            <button
              key={kt.key}
              onClick={() => onChange({ ...data, kitType: kt.key, inverter: null, tensaoRede: undefined })}
              className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                selected
                  ? `${c.border} ${c.bg} ring-4 ${c.ring}`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {/* Product image banner */}
              <div className="relative h-32 bg-gray-50 overflow-hidden">
                <ProductImg
                  src={KIT_TYPE_IMG[kt.key]}
                  alt={kt.title}
                  fallback={kt.icon}
                  className="w-full h-full object-contain p-3 transition-transform duration-500 hover:scale-105"
                />
                {selected && (
                  <div className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center ${c.icon} shadow-md`}>
                    <Check size={15} className="text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white/60 to-transparent" />
              </div>

              {/* Text content */}
              <div className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-gray-900 text-base">{kt.title}</h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${selected ? c.badge : 'bg-gray-100 text-gray-500'}`}>
                    {kt.subtitle}
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-snug">{kt.desc}</p>
                <p className={`text-xs font-medium mt-2 ${selected ? 'text-gray-700' : 'text-gray-400'}`}>
                  → {kt.catLabel}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Voltage sub-question for on-grid trifásico */}
      {data.kitType === 'ongrid_tri' && (
        <div className="max-w-3xl mx-auto bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
          <h3 className="font-bold text-gray-900 mb-1 text-center">Qual é a tensão da rede elétrica?</h3>
          <p className="text-gray-500 text-sm text-center mb-4">Selecione a tensão para filtrar os inversores compatíveis</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: '220', label: '220 V', desc: 'Trifásico — baixa tensão', badge: 'Tri 220 V' },
              { v: '380', label: '380 V', desc: 'Trifásico — padrão industrial', badge: 'Tri 380 V' },
            ].map(opt => {
              const sel = data.tensaoRede === opt.v
              return (
                <button
                  key={opt.v}
                  onClick={() => onChange({ ...data, tensaoRede: opt.v, inverter: null })}
                  className={`rounded-xl border-2 p-5 text-center transition-all ${
                    sel
                      ? 'border-indigo-500 bg-indigo-100 ring-4 ring-indigo-200'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`text-3xl font-extrabold mb-1 ${sel ? 'text-indigo-700' : 'text-gray-700'}`}>{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.desc}</div>
                  {sel && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                      <Check size={11} /> {opt.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 2B: Dimensionamento Automático de Bombeamento ──────────────────────
const BOMB_STRUCT_TYPES = [
  { key: 'Cerâmico',     label: 'Cerâmica',      emoji: '🧱' },
  { key: 'Fibromadeira', label: 'Fibro/Madeira',  emoji: '🪵' },
  { key: 'Metálico',     label: 'Metálico',       emoji: '🏗️' },
  { key: 'Laje',         label: 'Laje',           emoji: '🏢' },
  { key: 'Zipado',       label: 'Zipado',         emoji: '⚡' },
  { key: 'Shingle',      label: 'Shingle',        emoji: '🏘️' },
  { key: 'Solo',         label: 'Solo',           emoji: '🌱' },
]

function BombDimStep({ data, onChange, products }) {
  const SUB_STEPS = ['tensao', 'metodo', 'motor', 'distancia', 'estrutura', 'resultado']
  const [sub, setSub] = useState(data.bombDimDone ? 'resultado' : 'tensao')
  const [form, setForm] = useState({
    tensao:      data.bombTensao      || '',
    metodo:      data.bombMetodo      || '',
    cv:          data.bombCv          || '',
    corrente:    data.bombCorrente    || '',
    fatServico:  data.bombFatServico  != null ? String(data.bombFatServico) : '1.00',
    distancia:   data.bombDistancia   != null ? String(data.bombDistancia)  : '',
    roofType:    data.bombRoofType    || '',
    hsp:         data.bombHsp         != null ? String(data.bombHsp)        : String(SUN_HOURS),
  })
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const modulos = products
    .filter(p => p.categoria === CATEGORIES.MODULOS && p.potencia && p.preco)
    .sort((a, b) => b.potencia - a.potencia)

  const bombInvs = products
    .filter(p => p.categoria === CATEGORIES.INVERSORES_BOMBEAMENTO && p.preco)
    .sort((a, b) => (a.potencia || 0) - (b.potencia || 0))

  const cvNum      = parseFloat(form.cv)          || 0
  const corrNum    = parseFloat(form.corrente)    || 0
  const fatServico = Math.max(1, parseFloat(form.fatServico) || 1)
  // Pin = P_nominal × FS  (fator de serviço da placa do motor)
  const pMotorKw   = form.metodo === 'cv' ? round2(cvNum * 0.736 * fatServico) : 0
  const pFVMinKw   = round2(pMotorKw * 1.7)
  const iMinInv  = form.metodo === 'corrente' ? corrNum * 1.2  : 0
  const distNum  = parseFloat(form.distancia) || 0
  const needsReact = distNum > 70

  // NBR 16690: 220 V → 7 módulos em série | 380 V → 14 módulos em série
  const seriesPorString = form.tensao === '380' ? 14 : 7

  const calcNMod = (panel) => {
    if (!panel || !pFVMinKw) return seriesPorString
    const nMinimo = Math.ceil((pFVMinKw * 1000) / panel.potencia)
    return Math.max(Math.ceil(nMinimo / seriesPorString) * seriesPorString, seriesPorString)
  }

  const [selPanel, setSelPanel] = useState(() => data.panel || modulos[0] || null)

  // Corrente de saída estimada do inversor: I = P_kW × 1000 / (√3 × V × cosφ)
  const tensaoV   = parseFloat(form.tensao) || 380
  const invFactor = 1000 / (1.732 * tensaoV * 0.87)  // A/kW

  // Retorna compatibilidade do inversor com o motor — 3 estados:
  //   status 'ok'       → ≥ I_motor × 1,20 (recomendado, +20% de margem)
  //   status 'warning'  → I_motor ≤ I_est < I_motor × 1,20 (funciona, abaixo do recomendado)
  //   status 'blocked'  → I_est < I_motor (insuficiente, bloqueado)
  const checkInvCompat = (inv) => {
    if (!inv?.potencia) return { status: 'blocked', ok: false, label: '—' }
    if (form.metodo === 'cv' && pMotorKw > 0) {
      const pct = round2((inv.potencia / pMotorKw - 1) * 100)
      if (inv.potencia >= pMotorKw * 1.20)
        return { status: 'ok',      ok: true,  pct, label: `+${pct}% acima do motor (recomendado)` }
      if (inv.potencia >= pMotorKw)
        return { status: 'warning', ok: true,  pct, label: `+${pct}% — abaixo do recomendado (+20%)` }
      return       { status: 'blocked', ok: false, pct, label: `${Math.abs(pct)}% subdimensionado` }
    }
    if (form.metodo === 'corrente' && corrNum > 0) {
      const iEst = round2(inv.potencia * invFactor)
      const pct  = round2((iEst / corrNum - 1) * 100)
      if (iEst >= corrNum * 1.20)
        return { status: 'ok',      ok: true,  iEst, pct, label: `${iEst} A — +${pct}% acima (recomendado)` }
      if (iEst >= corrNum)
        return { status: 'warning', ok: true,  iEst, pct, label: `${iEst} A — +${pct}% (abaixo do recomendado +20%)` }
      return       { status: 'blocked', ok: false, iEst, pct, label: `${iEst} A < ${corrNum} A (insuficiente)` }
    }
    return { status: 'ok', ok: true, label: '' }
  }

  const autoInverter = useMemo(() => {
    if (form.metodo === 'cv' && pMotorKw > 0) {
      // Preferência: Pinv ≥ Pmotor × 1,20 (recomendado). Fallback: Pinv ≥ Pmotor.
      return (
        bombInvs.find(p => (p.potencia || 0) >= pMotorKw * 1.20) ||
        bombInvs.find(p => (p.potencia || 0) >= pMotorKw) ||
        bombInvs[bombInvs.length - 1] || null
      )
    }
    if (form.metodo === 'corrente' && corrNum > 0) {
      // Preferência: I_est ≥ I_motor × 1,20. Fallback: I_est ≥ I_motor.
      return (
        bombInvs.find(p => (p.potencia || 0) * invFactor >= corrNum * 1.20) ||
        bombInvs.find(p => (p.potencia || 0) * invFactor >= corrNum) ||
        bombInvs[bombInvs.length - 1] || null
      )
    }
    return null
  }, [form.metodo, pMotorKw, corrNum, form.tensao, bombInvs, invFactor])

  const [selInv, setSelInv] = useState(() => data.inverter || null)
  useEffect(() => {
    if (!selInv && autoInverter) setSelInv(autoInverter)
  }, [autoInverter])

  const invFinal  = selInv || autoInverter
  const nMod      = calcNMod(selPanel)
  const pFVReal   = selPanel ? round2(nMod * selPanel.potencia / 1000) : 0
  const entFinal  = invFinal?.entradas || 2
  const paralelos = seriesPorString > 0 ? nMod / seriesPorString : 0
  const hspNum    = parseFloat(form.hsp) || SUN_HOURS
  const eDiaKwh   = pFVReal > 0 ? round2(pFVReal * hspNum * 0.80) : 0
  const eMesKwh   = round2(eDiaKwh * 30)
  const eAnoMwh   = round2((eDiaKwh * 365) / 1000)
  const oversizingPct = pMotorKw > 0 && pFVReal > 0 ? round2((pFVReal / pMotorKw - 1) * 100) : null

  const modulosComparativos = useMemo(() => {
    if (!pFVMinKw || !seriesPorString) return modulos.map(m => ({ ...m, totalMods: 0, paralelos: 0, kWp: 0 }))
    return modulos
      .map(m => {
        const nMin    = Math.ceil((pFVMinKw * 1000) / m.potencia)
        const total   = Math.max(Math.ceil(nMin / seriesPorString) * seriesPorString, seriesPorString)
        const nParal  = total / seriesPorString
        const kWp     = round2(total * m.potencia / 1000)
        return { ...m, totalMods: total, paralelos: nParal, kWp }
      })
      .sort((a, b) => a.paralelos - b.paralelos || a.totalMods - b.totalMods)
  }, [modulos, pFVMinKw, seriesPorString])

  const handleConfirm = () => {
    const panel = selPanel || modulos[0]
    const inv   = invFinal
    const qty   = calcNMod(panel)
    const ent   = inv?.entradas || 2
    onChange({
      ...data,
      kitType: 'bombeamento',
      bombTensao: form.tensao,
      bombMetodo: form.metodo,
      bombCv: form.cv,
      bombCorrente: form.corrente,
      bombDistancia: distNum,
      bombRoofType: form.roofType,
      bombNeedsReactance: needsReact,
      bombFatServico: fatServico,
      bombPMotorKw: round2(pMotorKw),
      bombPFVMinKw: round2(pFVMinKw),
      bombHsp: hspNum,
      bombParalelos: paralelos,
      bombSeries: seriesPorString,
      bombEDia: eDiaKwh,
      bombEMes: eMesKwh,
      bombDimDone: true,
      panel,
      panelQty: qty,
      kwpDesejado: round2(pFVReal),
      inverter: inv,
      inverterQty: 1,
      wantsEstrutura: !!form.roofType,
      estruturaRoofType: form.roofType || data.estruturaRoofType,
      mc4Qty: 2 * ent,
      cablePosMeters: 25 * ent,
      cableNegMeters: 25 * ent,
      inclFusivel: true,  fusilvelQty: 2 * ent,
      inclBaseFus: true,  baseFusQty:  2 * ent,
      inclSurgeCCBomb: true,
      inclSeccion: true,
      inclGateway: true,
      inclDetect:  true,
      inclSolar5w: true,
      inclChaveCA: true,
      inclReactancia: needsReact,
    })
  }

  const subIdx = SUB_STEPS.indexOf(sub)
  const goPrev = () => setSub(SUB_STEPS[Math.max(0, subIdx - 1)])
  const goNext = () => {
    if (sub === 'estrutura') { if (!selInv) setSelInv(autoInverter); setSub('resultado') }
    else setSub(SUB_STEPS[Math.min(SUB_STEPS.length - 1, subIdx + 1)])
  }

  const canNextSub = {
    tensao:    !!form.tensao,
    metodo:    !!form.metodo,
    motor:     form.metodo === 'cv' ? cvNum > 0 : corrNum > 0,
    distancia: form.distancia !== '',
    estrutura: true,
  }

  const progress = (
    <div className="flex items-center justify-center gap-1 mb-6">
      {['tensao', 'metodo', 'motor', 'distancia', 'estrutura'].map((s, i) => (
        <div key={s} className={`h-1.5 rounded-full transition-all ${
          i < subIdx ? 'bg-cyan-500 w-8' : i === subIdx ? 'bg-cyan-500 w-12' : 'bg-gray-200 w-8'
        }`} />
      ))}
    </div>
  )

  const navBtns = (canGo, onNext, label = 'Próximo →') => (
    <div className="flex justify-between pt-2">
      {subIdx > 0
        ? <button onClick={goPrev} className="flex items-center gap-1 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:border-gray-300 transition-all">
            <ChevronLeft size={16} /> Voltar
          </button>
        : <div />
      }
      <button disabled={!canGo} onClick={onNext}
        className="px-8 py-2.5 rounded-xl bg-weg-blue text-white font-semibold hover:bg-weg-blue-mid disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        {label}
      </button>
    </div>
  )

  // ─── tensao ─────────────────────────────────────────────────────────────────
  if (sub === 'tensao') return (
    <div className="space-y-6 max-w-md mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">💧 Tensão do sistema</h2>
        <p className="text-gray-500 text-sm">Qual a tensão da rede elétrica para o bombeamento?</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {['220', '380'].map(v => (
          <button key={v} onClick={() => sf('tensao', v)}
            className={`p-8 rounded-2xl border-2 font-bold text-2xl transition-all ${
              form.tensao === v
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-md'
                : 'border-gray-200 hover:border-cyan-300 text-gray-600'
            }`}>
            {v}V
          </button>
        ))}
      </div>
      {navBtns(canNextSub.tensao, goNext)}
    </div>
  )

  // ─── metodo ─────────────────────────────────────────────────────────────────
  if (sub === 'metodo') return (
    <div className="space-y-6 max-w-md mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">💧 Método de dimensionamento</h2>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {[
          { key: 'cv',       label: 'Por potência da bomba (CV)',  desc: 'Informe os cavalos-vapor do motor' },
          { key: 'corrente', label: 'Por corrente do motor (A)',   desc: 'Informe a corrente nominal do motor' },
        ].map(m => (
          <button key={m.key} onClick={() => sf('metodo', m.key)}
            className={`p-5 rounded-2xl border-2 text-left transition-all ${
              form.metodo === m.key
                ? 'border-cyan-500 bg-cyan-50'
                : 'border-gray-200 hover:border-cyan-300'
            }`}>
            <p className="font-bold text-gray-900">{m.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>
      {navBtns(canNextSub.metodo, goNext)}
    </div>
  )

  // ─── motor ──────────────────────────────────────────────────────────────────
  if (sub === 'motor') return (
    <div className="space-y-5 max-w-md mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          💧 {form.metodo === 'cv' ? 'Potência da bomba (CV)' : 'Corrente do motor (A)'}
        </h2>
      </div>
      {form.metodo === 'cv' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>A potência em CV dos drives é baseada nos motores VEC. Para outros fabricantes, reavaliar o dimensionamento. É indicado cotar pela corrente de saída. <strong>O dimensionamento é de total responsabilidade do integrador.</strong></span>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        {form.metodo === 'cv' ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Potência do motor (CV)</label>
              <input type="number" min="0.5" step="0.5" value={form.cv}
                onChange={e => sf('cv', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Ex: 5" />
            </div>

            {/* Fator de serviço */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Fator de serviço (FS) — placa do motor
              </label>
              <p className="text-xs text-gray-400 mb-2">
                O FS indica a sobrecarga contínua permitida. Use 1,00 quando não informado.
              </p>
              <div className="flex gap-2 flex-wrap mb-2">
                {['1.00', '1.05', '1.10', '1.15', '1.25'].map(v => (
                  <button key={v} type="button"
                    onClick={() => sf('fatServico', v)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${
                      form.fatServico === v
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-gray-200 text-gray-600 hover:border-cyan-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              <input type="number" min="1" max="2" step="0.01" value={form.fatServico}
                onChange={e => sf('fatServico', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>

            {cvNum > 0 && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-600">Potência nominal:</span>
                  <span className="font-bold">{cvNum} CV = {round2(cvNum * 0.736)} kW</span>
                </div>
                {fatServico > 1 && (
                  <div className="flex justify-between bg-amber-50 rounded-lg px-3 py-2">
                    <span className="text-amber-700">Com FS {fatServico} (Pin):</span>
                    <span className="font-bold text-amber-800">{round2(cvNum * 0.736 * fatServico)} kW</span>
                  </div>
                )}
                <div className="flex justify-between bg-cyan-50 rounded-lg px-3 py-2">
                  <span className="text-cyan-700">Potência FV mínima (×1,7):</span>
                  <span className="font-bold text-cyan-800">{round2(pFVMinKw)} kWp</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Corrente nominal do motor (A)</label>
              <input type="number" min="0.1" step="0.1" value={form.corrente}
                onChange={e => sf('corrente', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Ex: 12.5" />
              {corrNum > 0 && (
                <div className="mt-4 bg-cyan-50 rounded-lg px-3 py-2 flex justify-between text-sm">
                  <span className="text-cyan-700">Corrente mínima do inversor (×1,2):</span>
                  <span className="font-bold text-cyan-800">{round2(iMinInv)} A</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {navBtns(canNextSub.motor, goNext)}
    </div>
  )

  // ─── distancia ──────────────────────────────────────────────────────────────
  if (sub === 'distancia') return (
    <div className="space-y-5 max-w-md mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">💧 Distância bomba → inversor</h2>
        <p className="text-gray-500 text-sm">Distância em metros entre a bomba e o inversor</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Distância (metros)</label>
        <input type="number" min="0" step="1" value={form.distancia}
          onChange={e => sf('distancia', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="Ex: 50" />
      </div>
      {needsReact && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span><strong>Atenção:</strong> Distâncias acima de 70 metros exigem reatância de saída. Será adicionada automaticamente ao kit.</span>
        </div>
      )}
      {navBtns(canNextSub.distancia, goNext)}
    </div>
  )

  // ─── estrutura ──────────────────────────────────────────────────────────────
  if (sub === 'estrutura') return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">💧 Tipo de instalação</h2>
        <p className="text-gray-500 text-sm">Selecione o tipo de estrutura (opcional — ajuste nos acessórios)</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BOMB_STRUCT_TYPES.map(rt => (
          <button key={rt.key} onClick={() => sf('roofType', form.roofType === rt.key ? '' : rt.key)}
            className={`p-4 rounded-2xl border-2 text-center transition-all ${
              form.roofType === rt.key
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                : 'border-gray-200 hover:border-cyan-200'
            }`}>
            <div className="text-2xl mb-1">{rt.emoji}</div>
            <div className="text-xs font-semibold">{rt.label}</div>
          </button>
        ))}
      </div>
      {navBtns(true, goNext, 'Calcular →')}
    </div>
  )

  // ─── resultado ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {progress}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">💧 Dimensionamento automático</h2>
        <p className="text-gray-500 text-sm">Revise e confirme o kit calculado</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <span className="bg-cyan-100 text-cyan-800 text-xs font-semibold px-3 py-1.5 rounded-full">{form.tensao}V</span>
        {form.metodo === 'cv' && (
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full">
            {cvNum} CV{fatServico > 1 ? ` × FS ${fatServico}` : ''} → {round2(pMotorKw)} kW
          </span>
        )}
        {form.metodo === 'corrente' && <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full">Imotor {corrNum} A → Iinv ≥ {round2(iMinInv)} A</span>}
        {form.metodo === 'cv' && <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1.5 rounded-full">FV mín.: {round2(pFVMinKw)} kWp</span>}
        {paralelos > 0 && selPanel && (
          <span className="bg-cyan-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {paralelos}×{seriesPorString} strings
          </span>
        )}
        {needsReact && <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-3 py-1.5 rounded-full">⚠ Reatância ({distNum}m)</span>}
      </div>

      {/* Configuração de strings */}
      {selPanel && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
          <h3 className="font-bold text-cyan-800 mb-3 flex items-center gap-2">
            <span>📐</span> Configuração das strings (NBR 16690)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white rounded-lg p-3 border border-cyan-100">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Config.</p>
              <p className="text-xl font-black text-cyan-700">{paralelos}×{seriesPorString}</p>
              <p className="text-[10px] text-gray-400">paralelo × série</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-cyan-100">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Total módulos</p>
              <p className="text-xl font-black text-cyan-700">{nMod}</p>
              <p className="text-[10px] text-gray-400">{pFVReal} kWp instalado</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-cyan-100">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Vmp string</p>
              <p className="text-xl font-black text-cyan-700">
                {selPanel.vmp ? `${round2(selPanel.vmp * seriesPorString)} V` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">{seriesPorString}×Vmp</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-cyan-100">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Isc string</p>
              <p className="text-xl font-black text-cyan-700">
                {selPanel.isc ? `${selPanel.isc} A` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">por string</p>
            </div>
          </div>
          {form.metodo === 'cv' && (
            <p className="text-xs text-cyan-700 mt-3 text-center">
              P_FV mín. {round2(pFVMinKw)} kW (motor {round2(pMotorKw)} kW × 1,70) →
              arredondado para múltiplo de {seriesPorString} = <strong>{nMod} módulos ({paralelos} string{paralelos !== 1 ? 's' : ''})</strong>
            </p>
          )}
        </div>
      )}

      {/* Comparativo de módulos disponíveis — por número de paralelos */}
      {pFVMinKw > 0 && modulosComparativos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 mb-1">📊 Comparativo — catálogo por nº de strings em paralelo</h3>
          <p className="text-xs text-gray-400 mb-3">Clique para selecionar o módulo. Configuração {form.tensao}V: {seriesPorString} módulos em série por string.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-500 text-left">
                  <th className="pb-2 pr-2 font-semibold">Módulo</th>
                  <th className="pb-2 font-semibold text-center">Wp</th>
                  <th className="pb-2 font-semibold text-center">Config.</th>
                  <th className="pb-2 font-semibold text-center">Total</th>
                  <th className="pb-2 font-semibold text-right">kWp</th>
                  <th className="pb-2 font-semibold text-right">Módulos R$</th>
                </tr>
              </thead>
              <tbody>
                {modulosComparativos.map(m => {
                  const isSelected = selPanel?.id === m.id
                  return (
                    <tr key={m.id}
                      onClick={() => setSelPanel(products.find(p => p.id === m.id) || m)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-50' : 'hover:bg-gray-50'
                      }`}>
                      <td className={`py-1.5 pr-2 font-medium leading-snug ${isSelected ? 'text-cyan-700' : 'text-gray-800'}`}>
                        {m.nome}
                        {isSelected && <span className="ml-1 text-cyan-600">✓</span>}
                      </td>
                      <td className="py-1.5 text-center text-gray-600">{m.potencia}</td>
                      <td className="py-1.5 text-center">
                        <span className={`font-black font-mono ${isSelected ? 'text-cyan-700' : 'text-gray-700'}`}>
                          {m.paralelos}×{seriesPorString}
                        </span>
                      </td>
                      <td className="py-1.5 text-center text-gray-600">{m.totalMods} un</td>
                      <td className="py-1.5 text-right font-semibold text-gray-700">{m.kWp} kWp</td>
                      <td className="py-1.5 text-right text-weg-orange font-semibold">
                        {m.preco ? fmtInt(m.preco * m.totalMods) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel selector (compacto — seleção pelo comparativo acima) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800">☀️ Módulo selecionado</h3>
          {selPanel && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
              {nMod} un · {pFVReal} kWp
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
          {modulos.map(m => {
            const n = calcNMod(m)
            const p = round2(n * m.potencia / 1000)
            const pal = n / seriesPorString
            return (
              <button key={m.id} onClick={() => setSelPanel(m)}
                className={`text-left text-sm rounded-lg border p-2.5 transition-all ${
                  selPanel?.id === m.id ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 hover:border-cyan-300'
                }`}>
                <div className="font-semibold">{m.nome}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {m.potencia} Wp · <span className="font-bold text-cyan-700">{pal}×{seriesPorString}</span> = {n} un · {p} kWp · {fmt(m.preco)}/un
                </div>
                {(() => {
                  const s = m.estoque || 'Disponível'
                  if (s === 'Esgotado' || s === 'Sem estoque') return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Esgotado
                    </span>
                  )
                  if (s === 'Previsão') {
                    const prev = m.estoque_previsao
                    const prevFmt = prev ? new Date(prev + 'T12:00:00').toLocaleDateString('pt-BR') : null
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-700 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                        {prevFmt ? `Previsão: ${prevFmt}` : 'Previsão de entrega'}
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Disponível
                    </span>
                  )
                })()}
              </button>
            )
          })}
          {modulos.length === 0 && <p className="text-sm text-gray-400 text-center py-3 col-span-2">Nenhum módulo no catálogo.</p>}
        </div>
      </div>

      {/* Inverter selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-800">⚡ Inversor / Drive de bombeamento</h3>
          {invFinal && <span className="text-xs text-gray-500 font-mono">{invFinal.codigo}</span>}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {form.metodo === 'cv'
            ? `Recomendado: P_inv ≥ ${round2(pMotorKw * 1.20)} kW (+20% sobre motor ${round2(pMotorKw)} kW). Mínimo: ≥ ${round2(pMotorKw)} kW.`
            : `Recomendado: I_inv ≥ ${round2(corrNum * 1.20)} A (+20% sobre motor ${corrNum} A). Mínimo: ≥ ${corrNum} A.`}
        </p>
        <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
          {bombInvs.map(inv => {
            const compat = checkInvCompat(inv)
            const isSelected = invFinal?.id === inv.id
            const iEst = form.metodo === 'corrente' ? round2((inv.potencia || 0) * invFactor) : null
            const borderCls = isSelected
              ? compat.status === 'ok'      ? 'border-green-500 bg-green-50'
              : compat.status === 'warning' ? 'border-amber-400 bg-amber-50'
              :                               'border-red-400 bg-red-50'
              : compat.status === 'blocked' ? 'border-red-100 bg-red-50/30 opacity-50'
              :                               'border-gray-200 hover:border-cyan-300'
            return (
              <button key={inv.id} onClick={() => setSelInv(inv)}
                className={`text-left text-sm rounded-lg border p-2.5 transition-all ${borderCls}`}>
                <div className="flex justify-between items-center gap-2">
                  <span className={`font-semibold ${
                    compat.status === 'blocked' ? 'text-red-700' :
                    compat.status === 'warning' ? 'text-amber-800' : ''
                  }`}>{inv.nome}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      compat.status === 'ok'      ? 'bg-green-100 text-green-700' :
                      compat.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-600'
                    }`}>
                      {compat.status === 'ok'      ? '✓ Recomendado' :
                       compat.status === 'warning' ? '⚠ Aceitável'    :
                                                     '✗ Insuficiente'}
                    </span>
                    <span className="text-weg-orange font-bold">{fmt(inv.preco)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                  {inv.potencia && <span>{inv.potencia} kW</span>}
                  {iEst !== null && (
                    <span className={`font-semibold ${
                      compat.status === 'ok' ? 'text-green-600' :
                      compat.status === 'warning' ? 'text-amber-600' : 'text-red-500'
                    }`}>I_est {iEst} A</span>
                  )}
                  {inv.entradas && <span>· {inv.entradas} entradas</span>}
                  {compat.label && <span className={`font-medium ${
                    compat.status === 'ok' ? 'text-green-600' :
                    compat.status === 'warning' ? 'text-amber-600' : 'text-red-500'
                  }`}>· {compat.label}</span>}
                </div>
              </button>
            )
          })}
          {bombInvs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">Nenhum inversor de bombeamento no catálogo. Importe a tabela com inversores CFW.</p>
          )}
        </div>
      </div>

      {/* Accessories summary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm">
        <h3 className="font-bold text-gray-800 mb-3">🔧 Acessórios incluídos automaticamente</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
          <div>· {2 * entFinal} pares Conector MC4 6mm²</div>
          <div>· {25 * entFinal}m Cabo CC Vermelho 6mm²</div>
          <div>· {25 * entFinal}m Cabo CC Preto 6mm²</div>
          <div>· {2 * entFinal} Fusíveis gPV 25A</div>
          <div>· {2 * entFinal} Bases fusível 10×38mm</div>
          <div>· DPS CC SPW12-1100-40</div>
          <div>· Chave Secc. CC ES100-32A</div>
          <div>· Chave CA ({form.tensao === '380' ? 'S6-04002DS0' : 'S6-02002DS0'})</div>
          <div>· Gateway WEG ED100</div>
          <div>· Kit Detecção Solar CFW500-KDS</div>
          <div>· Kit Solar 5W RESUN</div>
          {needsReact && <div className="text-orange-600 font-semibold col-span-2">· Reatância de saída (distância {distNum}m)</div>}
        </div>
      </div>

      {/* Produção de energia */}
      {pFVReal > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 mb-3">⚡ Estimativa de produção de energia</h3>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">HSP (h/dia):</label>
            <input type="number" min="1" max="8" step="0.1" value={form.hsp}
              onChange={e => sf('hsp', e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            <span className="text-xs text-gray-400">Padrão Brasil: {SUN_HOURS} h — ajuste conforme a região</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Diária</p>
              <p className="text-lg font-black text-yellow-700">{eDiaKwh}</p>
              <p className="text-[10px] text-gray-400">kWh/dia</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Mensal</p>
              <p className="text-lg font-black text-yellow-700">{eMesKwh}</p>
              <p className="text-[10px] text-gray-400">kWh/mês</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Anual</p>
              <p className="text-lg font-black text-yellow-700">{eAnoMwh}</p>
              <p className="text-[10px] text-gray-400">MWh/ano</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Fórmula: {pFVReal} kWp × {hspNum} HSP × 0,80 (PR) = {eDiaKwh} kWh/dia
          </p>
        </div>
      )}

      {/* Aviso de eficiência do sistema (oversizing) */}
      {oversizingPct !== null && form.metodo === 'cv' && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          oversizingPct >= 70
            ? 'bg-green-50 border-green-200 text-green-800'
            : oversizingPct >= 50
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="text-xl shrink-0">{oversizingPct >= 70 ? '✅' : '⚠️'}</span>
          <div>
            <p className="font-bold text-sm">
              Eficiência do sistema — Oversizing: {oversizingPct}%
            </p>
            <p className="text-xs mt-0.5">
              {oversizingPct >= 70
                ? `Sistema dentro da recomendação técnica (mínimo 70%). Potência FV ${pFVReal} kWp ÷ motor ${round2(pMotorKw)} kW = fator ${round2(pFVReal / pMotorKw)}.`
                : oversizingPct >= 50
                ? `Oversizing abaixo de 70%. Recomenda-se aumentar o número de módulos para melhor desempenho em dias nublados.`
                : `Oversizing insuficiente (< 50%). O sistema pode não partir o motor em condições de baixa irradiação.`
              }
            </p>
            <p className="text-[10px] mt-1 opacity-70">O cliente pode alterar o dimensionamento nos passos seguintes.</p>
          </div>
        </div>
      )}

      {/* Validation messages */}
      {(() => {
        const invCompat = invFinal ? checkInvCompat(invFinal) : null
        return (
          <div className="space-y-2 text-sm">
            {form.metodo === 'cv' && selPanel && pFVReal > 0 && pFVReal < pFVMinKw && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>FV {pFVReal} kWp abaixo do mínimo {round2(pFVMinKw)} kWp — mínimo de {seriesPorString} módulos aplicado.</span>
              </div>
            )}
            {!invFinal && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>Nenhum inversor de bombeamento encontrado. Importe a tabela com inversores CFW.</span>
              </div>
            )}
            {invFinal && invCompat?.status === 'blocked' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  {form.metodo === 'cv'
                    ? `⛔ Inversor subdimensionado: ${invFinal.potencia} kW < motor ${round2(pMotorKw)} kW. Necessário ≥ ${round2(pMotorKw)} kW.`
                    : `⛔ Corrente insuficiente: I_est ${invCompat.iEst} A < I_motor ${corrNum} A. Necessário ≥ ${corrNum} A.`}
                </span>
              </div>
            )}
            {invFinal && invCompat?.status === 'warning' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  {form.metodo === 'cv'
                    ? `⚠ Abaixo do recomendado: ${invFinal.potencia} kW está entre P_motor (${round2(pMotorKw)} kW) e o recomendado (${round2(pMotorKw * 1.20)} kW). O inversor funcionará, mas com menor margem de segurança.`
                    : `⚠ Abaixo do recomendado: I_est ${invCompat.iEst} A está entre I_motor (${corrNum} A) e o recomendado (${round2(corrNum * 1.20)} A = I × 1,20). Funcionará, mas sem a margem de +20%.`}
                </span>
              </div>
            )}
            {invFinal && invCompat?.status === 'ok' && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 flex items-center gap-2">
                <Check size={14} />
                <span>
                  {form.metodo === 'cv'
                    ? `✓ Inversor recomendado: ${invFinal.potencia} kW ≥ ${round2(pMotorKw * 1.20)} kW (+20% motor).`
                    : `✓ Corrente recomendada: I_est ${invCompat.iEst} A ≥ ${round2(corrNum * 1.20)} A (+20% I_motor).`}
                  {form.metodo === 'cv' && pFVReal >= pFVMinKw
                    ? ` FV ${pFVReal} kWp — oversizing ${oversizingPct}% ✓`
                    : ''}
                </span>
              </div>
            )}
          </div>
        )
      })()}

      <div className="flex justify-between pt-2">
        <button onClick={() => setSub('estrutura')} className="flex items-center gap-1 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:border-gray-300 transition-all">
          <ChevronLeft size={16} /> Voltar
        </button>
        {(() => {
          const compat = invFinal ? checkInvCompat(invFinal) : null
          const blocked = !selPanel || !invFinal || compat?.status === 'blocked'
          return (
            <button onClick={handleConfirm}
              disabled={blocked}
              className={`px-8 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                compat?.status === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-weg-blue hover:bg-weg-blue-mid text-white'
              }`}
              title={blocked ? 'Selecione um inversor compatível com o motor' : undefined}>
              {compat?.status === 'warning' ? '⚠ Confirmar (com ressalva)' : '✓ Confirmar dimensionamento'}
            </button>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Step 2: Dimensionamento (somente kWp) ───────────────────────────────────
function Step1({ data, onChange }) {
  const { freteOpcoes } = useProducts()
  const [cidades, setCidades] = useState([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [cidadeBusca, setCidadeBusca] = useState(data.clienteCidade || '')
  const [cidadeDropdown, setCidadeDropdown] = useState(false)
  const cidadeRef = useRef(null)

  // Busca cidades do IBGE ao mudar o estado
  useEffect(() => {
    if (!data.clienteUF) { setCidades([]); return }
    setLoadingCidades(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.clienteUF}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then(lista => setCidades(lista.map(m => m.nome)))
      .catch(() => setCidades([]))
      .finally(() => setLoadingCidades(false))
  }, [data.clienteUF])

  // Sync input when cidade muda externamente (troca de estado zera)
  useEffect(() => {
    setCidadeBusca(data.clienteCidade || '')
  }, [data.clienteCidade])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (cidadeRef.current && !cidadeRef.current.contains(e.target)) setCidadeDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const cidadesFiltradas = useMemo(() => {
    if (!cidadeBusca || cidades.includes(cidadeBusca)) return cidades
    const q = cidadeBusca.toLowerCase()
    return cidades.filter(c => c.toLowerCase().includes(q))
  }, [cidades, cidadeBusca])

  const handleEstadoChange = (uf) => {
    const regiao = regiaoFromUF(uf)
    let freteAutoIdByRegiao = null
    if (regiao === 'norte') {
      freteAutoIdByRegiao = freteOpcoes.find(f => /\bnorte\b/i.test(f.nome))?.id ?? null
    } else if (regiao === 'nordeste') {
      freteAutoIdByRegiao = freteOpcoes.find(f => /nordeste/i.test(f.nome))?.id ?? null
    }
    onChange({
      ...data,
      clienteUF: uf || null,
      clienteCidade: '',
      clienteLocal: uf || '',
      freteAutoIdByRegiao,
    })
  }

  const handleCidadeChange = (cidade) => {
    const uf = data.clienteUF || ''
    const local = uf ? `${cidade} / ${uf}` : cidade
    onChange({ ...data, clienteCidade: cidade, clienteLocal: local })
  }

  const regiaoDetectada = regiaoFromUF(data.clienteUF)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Qual a potência desejada do sistema?</h2>
        <p className="text-gray-500 text-sm">Informe a potência pico em kWp para dimensionar o kit</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md mx-auto">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ☀️ Potência pico do sistema (kWp)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={data.kwpDesejado || ''}
              onChange={e => onChange({ ...data, kwpDesejado: parseFloat(e.target.value) || '', mode: 'potencia' })}
              placeholder="Ex: 5"
              className="flex-1 text-2xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-weg-blue text-center"
            />
            <span className="text-gray-500 font-medium">kWp</span>
          </div>

          {data.kwpDesejado > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mt-4">
              <p className="text-xs text-gray-500 mb-1">Geração estimada:</p>
              <p className="text-2xl font-extrabold text-weg-blue">
                {(data.kwpDesejado * (data.hsp || SUN_HOURS) * 30).toFixed(0)} kWh/mês
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ({data.hsp || SUN_HOURS}h de sol pico/dia × 30 dias)
              </p>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="border-t border-gray-100 mt-6 pt-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
            <User size={12} /> Informações do cliente (opcional)
          </h4>
          <div className="space-y-2">
            <input
              value={data.clienteNome || ''}
              onChange={e => onChange({ ...data, clienteNome: e.target.value })}
              placeholder="Nome do cliente"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            />

            {/* Estado */}
            <select
              value={data.clienteUF || ''}
              onChange={e => handleEstadoChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-weg-blue text-gray-700"
            >
              <option value="">Selecione o estado</option>
              {ESTADOS.map(e => (
                <option key={e.uf} value={e.uf}>{e.uf} — {e.nome}</option>
              ))}
            </select>

            {/* Cidade — combobox com busca */}
            {data.clienteUF && (
              <div className="relative" ref={cidadeRef}>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={cidadeBusca}
                    onChange={e => { setCidadeBusca(e.target.value); setCidadeDropdown(true) }}
                    onFocus={() => setCidadeDropdown(true)}
                    disabled={loadingCidades}
                    placeholder={loadingCidades ? 'Carregando cidades…' : 'Buscar cidade…'}
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-7 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue disabled:opacity-60"
                  />
                  {loadingCidades && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-weg-blue border-t-transparent rounded-full animate-spin pointer-events-none" />
                  )}
                  {data.clienteCidade && !loadingCidades && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center pointer-events-none">
                      <Check size={9} className="text-white" />
                    </div>
                  )}
                </div>
                {cidadeDropdown && !loadingCidades && cidadesFiltradas.length > 0 && (
                  <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {cidadesFiltradas.map(c => (
                      <li
                        key={c}
                        onMouseDown={() => {
                          handleCidadeChange(c)
                          setCidadeDropdown(false)
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer ${
                          c === data.clienteCidade
                            ? 'bg-blue-50 text-weg-blue font-medium'
                            : 'hover:bg-blue-50 hover:text-weg-blue'
                        }`}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
                {cidadeDropdown && !loadingCidades && cidadeBusca && cidadesFiltradas.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                    Nenhuma cidade encontrada
                  </div>
                )}
              </div>
            )}

            {/* Feedback de região + frete */}
            {regiaoDetectada && (
              <p className="text-[11px] text-green-700 flex items-center gap-1 mt-0.5 ml-0.5">
                <Check size={11} />
                Região <strong>{regiaoDetectada.replace('_', '-')}</strong>
                {data.freteAutoIdByRegiao
                  ? <span className="text-green-600"> — frete pré-selecionado automaticamente no resumo</span>
                  : <span className="text-gray-400"> — sem frete específico para esta região</span>
                }
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mapeamento UF → Região ──────────────────────────────────────────────────
const UF_REGIAO = {
  AC:'norte', AM:'norte', AP:'norte', PA:'norte', RO:'norte', RR:'norte', TO:'norte',
  AL:'nordeste', BA:'nordeste', CE:'nordeste', MA:'nordeste', PB:'nordeste',
  PE:'nordeste', PI:'nordeste', RN:'nordeste', SE:'nordeste',
  DF:'centro_oeste', GO:'centro_oeste', MS:'centro_oeste', MT:'centro_oeste',
  ES:'sudeste', MG:'sudeste', RJ:'sudeste', SP:'sudeste',
  PR:'sul', RS:'sul', SC:'sul',
}

// Extrai a sigla de UF de strings como "Manaus / AM", "São Paulo - SP", "PA"
function detectUF(local) {
  if (!local) return null
  const m = local.trim().match(/\b([A-Za-z]{2})\s*$/)
  if (m) {
    const uf = m[1].toUpperCase()
    if (UF_REGIAO[uf]) return uf
  }
  return null
}

function regiaoFromUF(uf) {
  return uf ? (UF_REGIAO[uf] || null) : null
}

// Detecta painel de CD Nordeste pelo nome
function isNordestePanel(panel) {
  if (!panel?.nome) return false
  return /(nordeste|cd\s*ne\b)/i.test(panel.nome)
}

// ─── Step 2: Módulos ─────────────────────────────────────────────────────────
function Step2({ data, onChange, products, targetKwp }) {
  const { freteOpcoes } = useProducts()
  const [nordesteWarning, setNordesteWarning] = useState(null) // { panel, qty }
  const [stockAlert, setStockAlert]           = useState(null) // { panel } when estoque ≠ Disponível

  const panels = products.filter(p => p.kitRole === KIT_ROLE.PANEL && p.preco)

  const clienteRegiao = regiaoFromUF(data.clienteUF)
  const isClienteNordeste = clienteRegiao === 'nordeste'

  // Quando o cliente é do Nordeste, módulos CD Nordeste sobem para o topo
  const panelsSorted = useMemo(() => {
    if (!isClienteNordeste) return panels
    const nordeste = panels.filter(p => isNordestePanel(p))
    const outros = panels.filter(p => !isNordestePanel(p))
    return [...nordeste, ...outros]
  }, [panels, isClienteNordeste])

  const nordesteFreteId = freteOpcoes.find(f => /nordeste/i.test(f.nome))?.id

  const confirmSelectPanel = (panel, qty, freteAutoId) => {
    onChange({ ...data, panel, panelQty: qty, freteAutoId })
    setNordesteWarning(null)
  }

  const norteFreteId = freteOpcoes.find(f => /\bnorte\b/i.test(f.nome))?.id

  const selectPanel = (panel) => {
    const qty = Math.ceil((targetKwp * 1000) / panel.potencia)
    const wasNordeste = isNordestePanel(data.panel)
    const willBeNordeste = isNordestePanel(panel)

    // Switching FROM nordeste TO non-nordeste → ask for confirmation
    if (wasNordeste && !willBeNordeste) {
      setNordesteWarning({ panel, qty })
      return
    }

    let freteAutoId = undefined
    if (willBeNordeste) {
      // Cliente da região Norte com CD Nordeste → pré-seleciona frete Norte
      const clienteRegiao = regiaoFromUF(data.clienteUF)
      freteAutoId = (clienteRegiao === 'norte' && norteFreteId) ? norteFreteId : nordesteFreteId
    }
    onChange({ ...data, panel, panelQty: qty, freteAutoId })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Escolha o módulo fotovoltaico</h2>
        <p className="text-gray-500 text-sm">
          Sistema alvo: <span className="font-bold text-weg-blue">{targetKwp.toFixed(2)} kWp</span>
        </p>
      </div>

      {/* Sugestão: cliente Nordeste sem módulo CD Nordeste selecionado */}
      {isClienteNordeste && !isNordestePanel(data.panel) && (
        <div className="max-w-3xl mx-auto bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
          <Info size={15} className="shrink-0 text-blue-500" />
          <span>Cliente da <strong>região Nordeste</strong> — módulos <strong>CD Nordeste</strong> estão destacados no topo da lista.</span>
        </div>
      )}

      {/* Aviso de frete auto-selecionado quando painel Nordeste */}
      {isNordestePanel(data.panel) && regiaoFromUF(data.clienteUF) !== 'norte' && (
        <div className="max-w-3xl mx-auto bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-orange-800">
          <AlertTriangle size={15} className="shrink-0 text-orange-500" />
          <span>Painel <strong>CD Nordeste</strong> selecionado — o frete <strong>Nordeste</strong> foi pré-selecionado automaticamente no resumo.</span>
        </div>
      )}

      {/* Aviso especial: cliente região Norte + módulo CD Nordeste */}
      {isNordestePanel(data.panel) && regiaoFromUF(data.clienteUF) === 'norte' && (
        <div className="max-w-3xl mx-auto bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="shrink-0 text-amber-500 mt-0.5" />
          <span>
            <strong>Atenção:</strong> módulo <strong>CD Nordeste</strong> selecionado para cliente da{' '}
            <strong>região Norte ({data.clienteUF})</strong>.
            O frete <strong>Norte</strong> foi pré-selecionado — verifique se é a modalidade correta para esta entrega.
          </span>
        </div>
      )}

      {/* Modal de alerta: módulo com estoque restrito */}
      {stockAlert && (() => {
        const s = stockAlert.panel.estoque || 'Disponível'
        const isEsgotado = s === 'Esgotado' || s === 'Sem estoque'
        const prev = stockAlert.panel.estoque_previsao
        const prevFmt = prev
          ? new Date(prev + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'})
          : null
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isEsgotado ? 'bg-red-100' : 'bg-yellow-100'}`}>
                  <AlertTriangle size={22} className={isEsgotado ? 'text-red-600' : 'text-yellow-600'} />
                </div>
                <div>
                  <h3 className={`font-bold text-gray-900 mb-0.5 ${isEsgotado ? 'text-red-800' : 'text-yellow-800'}`}>
                    {isEsgotado ? 'Módulo Esgotado' : 'Módulo com Previsão de Entrega'}
                  </h3>
                  <p className="text-xs text-gray-500">{stockAlert.panel.nome} · {stockAlert.panel.potencia} Wp</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-5">
                {isEsgotado
                  ? <>Este módulo está <strong className="text-red-600">esgotado</strong> no momento. Recomendamos selecionar outro módulo disponível para garantir o prazo de entrega.</>
                  : <>Este módulo tem previsão de entrega para <strong className="text-yellow-700">{prevFmt || 'data a confirmar'}</strong>. Verifique com o fornecedor antes de fechar o pedido ou escolha outro módulo disponível.</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStockAlert(null)}
                  className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  Escolher outro
                </button>
                <button
                  onClick={() => { selectPanel(stockAlert.panel); setStockAlert(null) }}
                  className={`flex-1 font-semibold py-2.5 rounded-xl text-sm text-white ${
                    isEsgotado ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                >
                  Usar mesmo assim
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de confirmação ao trocar painel nordeste por outro */}
      {nordesteWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Atenção: frete CD Nordeste</h3>
                <p className="text-sm text-gray-600">
                  Você estava com um painel <strong>CD Nordeste</strong>. Ao trocar por{' '}
                  <strong>{nordesteWarning.panel.nome}</strong>, a seleção automática de frete Nordeste será removida.
                </p>
                <p className="text-sm text-gray-500 mt-2">Deseja confirmar a troca?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => confirmSelectPanel(nordesteWarning.panel, nordesteWarning.qty, undefined)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                Confirmar troca
              </button>
              <button
                onClick={() => setNordesteWarning(null)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:border-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {panelsSorted.map(panel => {
          const qty     = Math.ceil((targetKwp * 1000) / panel.potencia)
          const realKwp = (qty * panel.potencia / 1000).toFixed(2)
          const selected = data.panel?.id === panel.id
          const estoque  = panel.estoque || 'Disponível'
          const isEsg    = estoque === 'Esgotado' || estoque === 'Sem estoque'
          const isPrev   = estoque === 'Previsão'
          const prev     = isPrev ? panel.estoque_previsao : null
          const prevFmt  = prev ? new Date(prev + 'T12:00:00').toLocaleDateString('pt-BR') : null

          return (
            <button
              key={panel.id}
              onClick={() => {
                if (isEsg || isPrev) { setStockAlert({ panel }); return }
                selectPanel(panel)
              }}
              className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
                selected
                  ? 'border-weg-blue bg-blue-50 ring-2 ring-blue-100'
                  : isEsg  ? 'border-red-300 bg-red-50/40 hover:border-red-400 hover:shadow-md'
                  : isPrev ? 'border-yellow-300 bg-yellow-50/30 hover:border-yellow-400 hover:shadow-md'
                  : 'border-gray-200 bg-white hover:border-weg-blue/50 hover:shadow-md'
              }`}
            >
              {/* Panel image */}
              <div className="relative h-32 bg-gradient-to-br from-amber-50 to-amber-100 overflow-hidden flex items-center justify-center">
                <ProductImg
                  src={getProductImage(panel)}
                  alt={panel.nome}
                  fallback="☀️"
                  className={`w-full h-full object-contain p-3 transition-transform duration-500 hover:scale-105 ${isEsg ? 'opacity-50 grayscale' : ''}`}
                />
                {/* Availability badge — top-left overlay */}
                <div className={`absolute top-2 left-2 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                  isEsg ? 'bg-red-500' : isPrev ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block shrink-0" />
                  {isEsg ? 'Esgotado' : isPrev ? (prevFmt ? `Prev. ${prevFmt}` : 'Previsão') : 'Disponível'}
                </div>
                {selected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-weg-blue flex items-center justify-center shadow-md">
                    <Check size={13} className="text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white/60 to-transparent" />
              </div>

              <div className="p-4">
              <div className="flex justify-between items-start mb-2 gap-1 flex-wrap">
                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  ☀️ {panel.fabricante}
                </span>
                {isNordestePanel(panel) && (
                  <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                    📦 CD Nordeste
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{panel.nome}</h3>
              <p className="text-xs text-gray-400 font-mono mb-3">{panel.modelo}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Potência:</span>
                  <span className="font-bold text-weg-blue">{panel.potencia} Wp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Qtd. estimada:</span>
                  <span className="font-bold">{qty} painéis</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total real:</span>
                  <span className="font-semibold text-green-700">{realKwp} kWp</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-gray-500">Preço unit.:</span>
                  <span className="font-bold text-gray-900">{fmt(panel.preco)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total painéis:</span>
                  <span className="font-bold text-weg-orange">{fmt(moneyMul(panel.preco, qty))}</span>
                </div>
              </div>
              </div>{/* /p-4 */}
            </button>
          )
        })}
      </div>

      {/* Manual quantity override */}
      {data.panel && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 max-w-sm mx-auto">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Package size={15} className="text-weg-blue" /> Ajustar quantidade de painéis
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ ...data, panelQty: Math.max(1, (data.panelQty || 1) - 1) })}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              value={data.panelQty || 1}
              onChange={e => onChange({ ...data, panelQty: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-20 text-center border border-gray-200 rounded-lg px-2 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-weg-blue"
            />
            <button
              onClick={() => onChange({ ...data, panelQty: (data.panelQty || 1) + 1 })}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
            >
              <Plus size={16} />
            </button>
            <span className="text-gray-500 text-sm">painéis</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Total: {((data.panelQty || 1) * data.panel.potencia / 1000).toFixed(2)} kWp
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Inversor ─────────────────────────────────────────────────────────
// ─── Overload helpers ────────────────────────────────────────────────────────
function getOverloadMax(inv) {
  const m = (inv.modelo || inv.nome || '').toUpperCase()
  if (/SIW420G.*K075/.test(m))   return 0.70  // atípico, catálogo a confirmar
  if (/SIW200H/.test(m))         return 1.00  // toda a linha SIW200H
  if (/SIW400H/.test(m))         return 1.00  // toda a linha SIW400H (K e T series)
  if (/SIW500G.*K075/.test(m))   return 0.00  // atípico, catálogo a confirmar
  return 0.50  // demais linhas (SIW200G, SIW300/SIW300H, SIW400G, SIW500H/G, SIW600/610)
}
function getMaxDCkW(inv) { return round2(inv.potencia * (1 + getOverloadMax(inv))) }
function invOverloadPct(totalKwp, invKw) {
  if (!invKw || !totalKwp) return null
  return round2((totalKwp / invKw - 1) * 100)
}

// ── SIW400H K-series — potência e overload dependem da tensão da rede ─────────
// inv.potencia = CA nominal 380V (ex: K008 = 15 kW); para rede 220/127V usar CA abaixo.
const SIW400K_CA_220 = { '007': 7.5, '008': 8.6, '011': 11.5, '014': 14.4, '017': 17.4 }
const SIW400K_OL_220 = { '007': 1.00, '008': 1.00, '011': 1.00, '014': 1.00, '017': 1.00 }

function getK400KVariant(inv) {
  const match = (inv?.modelo || inv?.nome || '').toUpperCase().match(/SIW400H.*\bK(\d{3})\b/)
  return match ? match[1] : null
}
// Potência CA efetiva considerando tensão da rede (380/220V ou 220/127V)
function getInvEffKw(inv, gridConf) {
  const variant = getK400KVariant(inv)
  if (variant && gridConf === '220' && SIW400K_CA_220[variant]) return SIW400K_CA_220[variant]
  return inv.potencia
}
// Overload máximo considerando tensão da rede
function getOverloadMaxGrid(inv, gridConf) {
  const variant = getK400KVariant(inv)
  if (variant && gridConf === '220' && SIW400K_OL_220[variant] !== undefined) return SIW400K_OL_220[variant]
  return getOverloadMax(inv)
}
// DC máx considerando tensão da rede
function getMaxDCkWGrid(inv, gridConf) {
  return round2(getInvEffKw(inv, gridConf) * (1 + getOverloadMaxGrid(inv, gridConf)))
}

function isInvCompatible(inv, realKwp) {
  const ol = realKwp / inv.potencia - 1
  return ol >= -0.3 && ol <= getOverloadMax(inv)
}
// Grid-aware compatibility (applies reduced power for K-series on 220V grid)
function isInvCompatibleGrid(inv, realKwp, gridConf) {
  const effKw = getInvEffKw(inv, gridConf)
  const ol = realKwp / effKw - 1
  return ol >= -0.3 && ol <= getOverloadMaxGrid(inv, gridConf)
}
function invTypeBadge(inv) {
  const m = (inv.modelo || inv.nome || '').toUpperCase()
  if (/SIW\d*H/.test(m)) return { label: 'Híbrido', cls: 'bg-violet-100 text-violet-700' }
  if (/SIW/.test(m))     return { label: 'On-Grid', cls: 'bg-sky-100 text-sky-700' }
  return null
}
function invHybridSubBadge(inv) {
  const m = (inv.modelo || inv.nome || '').toUpperCase()
  if (!/SIW\d*H/.test(m)) return null
  // SIW200H S-series (S057/S075/S114) → Split 127/220V
  if (/SIW200H/.test(m) && /\bS\d/.test(m)) return { label: 'Split 127/220V', cls: 'bg-amber-100 text-amber-700' }
  // SIW200H M-series (M050/M075/M105) and SIW300H → Mono 220V
  if (/SIW200H/.test(m) || /SIW300H/.test(m)) return { label: 'Mono 220V', cls: 'bg-blue-100 text-blue-700' }
  // SIW400H K-series (K008/K017) → Tri 220V
  if (/SIW400H/.test(m) && /\bK\d/.test(m)) return { label: 'Tri 220V', cls: 'bg-sky-100 text-sky-700' }
  // SIW400H T-series (T015/T030) → Tri 380V
  if (/SIW400H/.test(m) && /\bT\d/.test(m)) return { label: 'Tri 380V', cls: 'bg-indigo-100 text-indigo-700' }
  return null
}

function isHybridInv(inv) {
  if (!inv) return false
  return /SIW\d*H/i.test(inv.modelo || inv.nome || '')
}

// Linha "CB" de bateria de alta tensão (SIW200H/SIW400H) — inclui a geração
// CB050/CB100 e a geração mais nova SBW200 CB057/CB115 (mesma compatibilidade
// e mesma regra de quantidade/JBW da linha original, por decisão comercial).
const BAT_CB_MODELS = [
  { type: 'CB050',        desc: '5,02 kWh / 192V DC',  kwh: 5.02,  volt: 192 },
  { type: 'CB100',        desc: '10,07 kWh / 384V DC', kwh: 10.07, volt: 384 },
  { type: 'SBW200 CB057', desc: '5,76 kWh / 192V DC',  kwh: 5.76,  volt: 192 },
  { type: 'SBW200 CB115', desc: '11,52 kWh / 384V DC', kwh: 11.52, volt: 384 },
]
const batKwhByType = (type) => BAT_CB_MODELS.find(m => m.type === type)?.kwh || 0

// ─── Battery Step ─────────────────────────────────────────────────────────────
function BatteryStep({ data, onChange, products }) {
  const inv = data.inverter || data.inverters?.[0]?.inverter
  const m = (inv?.modelo || inv?.nome || '').toUpperCase()

  const isSIW200H  = /SIW200H/.test(m)
  const isSIW300H  = /SIW300H/.test(m)
  // SIW400H W30 (T050/T075/T125) usa o sistema de bateria SBW400 (B160 + HV
  // Box), diferente do W10/W20 que usa CB050/CB100/SBW200 — tem que excluir
  // o W30 do ecossistema CB senão ele oferece a bateria errada.
  const isSIW400H_W30 = /SIW400H/.test(m) && /\bW30\b/.test(m)
  const isSIW400H  = /SIW400H/.test(m) && !isSIW400H_W30
  const isSIW500H  = /SIW500H/.test(m)
  const isCBEco    = isSIW200H || isSIW400H
  const isSBWEco   = isSIW300H || isSIW500H
  const isSBW400Eco = isSIW400H_W30
  // JBW 41DC: SIW200H ≥2 bat → 1 JBW; SIW400H ≥3 bat → 1 JBW, ≥6 bat → 2 JBW
  const k400kVar     = getK400KVariant(inv)
  const jbwThreshold = isSIW200H ? 2 : (isSIW400H ? 3 : null)
  const maxBat       = isSIW400H ? 8 : 4
  const maxGroups    = isSIW300H ? 6 : 12
  // CB ecosystem products (CB050/CB100 = geração original; SBW200 CB057/CB115 = geração nova)
  // Busca na lista ativa (products = catalogProducts) — respeita o que o
  // admin publicou, inclusive modelos aposentados (ex: CB100 removido da
  // lista some do seletor automaticamente).
  const batCB050      = products.find(p => /\bCB.?050\b/i.test(p.modelo || p.nome || ''))
  const batCB100      = products.find(p => /\bCB.?100\b/i.test(p.modelo || p.nome || ''))
  const batSBW200_057 = products.find(p => /SBW200/i.test(p.modelo || p.nome || '') && /057/.test(p.modelo || p.nome || ''))
  const batSBW200_115 = products.find(p => /SBW200/i.test(p.modelo || p.nome || '') && /115/.test(p.modelo || p.nome || ''))
  const batProductByType = {
    'CB050': batCB050, 'CB100': batCB100,
    'SBW200 CB057': batSBW200_057, 'SBW200 CB115': batSBW200_115,
  }
  const jbwProd   = products.find(p => /JBW.*41DC|41DC.*JBW/i.test(p.modelo || p.nome || ''))
  // SBW300 ecosystem: 1 módulo de controle (LUNA2000-10KW) + SmartGuard
  // (quadro de transferência, backup) + até 3 módulos de bateria (LUNA2000-7-E1)
  const sgSProd      = products.find(p => /SmartGuard/i.test(p.nome || p.modelo || '') && /\bS0\b/i.test(p.nome || p.modelo || ''))
  const sgTProd      = products.find(p => /SmartGuard/i.test(p.nome || p.modelo || '') && /\bT0\b/i.test(p.nome || p.modelo || ''))
  const luna2000Prod = products.find(p => /LUNA2000/i.test(p.modelo || p.nome || '') && /bateria/i.test(p.tipo || ''))
  const lunaCtrlProd = products.find(p => /LUNA2000/i.test(p.modelo || p.nome || '') && /controle/i.test(p.tipo || ''))
  const sgCtrlProd   = isSIW300H ? sgSProd : sgTProd   // mandatory controller for SBW300 ecosystem

  // SBW400 ecosystem (SIW400H W30): 1 HV Box (BMS) por torre + 4 a 15
  // módulos B160 (16,07 kWh cada) por torre, até 3 torres (720 kWh)
  const b160Prod  = products.find(p => /B160/i.test(p.modelo || p.nome || ''))
  const hvBoxProd = products.find(p => /HV.?Box/i.test(p.modelo || p.nome || ''))
  // DTSU666 — multimedidor obrigatório pro controle de exportação (ficha técnica WEG)
  const dtsuProd  = products.find(p => /DTSU666/i.test(p.modelo || p.nome || ''))
  const SBW400_MIN = 4, SBW400_MAX_PER_TOWER = 15, SBW400_MAX_TOWERS = 3

  const [sub, setSub]             = useState(data.batteryDone ? 'done' : 'ask')
  const [batType, setBatType]     = useState(data.batType || 'CB050')
  const [batQty, setBatQty]       = useState(data.batQty || 1)
  const [sbwGroups, setSbwGroups] = useState(data.sbwGroups || 1)
  const [sbw400Qty, setSbw400Qty] = useState(data.sbw400ModQty || SBW400_MIN)
  const sbw400Towers = Math.max(1, Math.ceil(sbw400Qty / SBW400_MAX_PER_TOWER))
  const sbw400Kwh     = 16.07 * sbw400Qty

  const jbwNeeded = isCBEco && jbwThreshold !== null && batQty >= jbwThreshold
  const jbwQty    = !jbwNeeded ? 0 : (isSIW400H && batQty >= 6 ? 2 : 1)

  const confirmBattery = () => {
    const selBatProd = batProductByType[batType]
    onChange({
      ...data,
      wantsBattery: true, batteryDone: true,
      batEco:          isCBEco ? 'CB' : isSBW400Eco ? 'SBW400' : 'SBW300',
      batType:         isCBEco ? batType : isSBW400Eco ? 'SBW400' : 'SBW300',
      batQty:          isCBEco ? batQty : null,
      sbwGroups:       isSBWEco ? sbwGroups : null,
      sbwModType:      null,
      batProduct:      isCBEco ? selBatProd : null,
      // SBW300 ecosystem: SmartGuard (backup) + módulo de controle + baterias LUNA2000-7-E1
      sgCtrlProduct:   isSBWEco ? sgCtrlProd : null,
      lunaCtrlProduct: isSBWEco ? lunaCtrlProd : null,
      luna2000Product: isSBWEco ? luna2000Prod : null,
      batB070Product:  null,
      batCModProduct:  null,
      // SBW400 ecosystem (SIW400H W30): HV Box (1 por torre) + módulos B160 + DTSU666 (export)
      sbw400ModQty:    isSBW400Eco ? sbw400Qty : null,
      sbw400Towers:    isSBW400Eco ? sbw400Towers : null,
      b160Product:     isSBW400Eco ? b160Prod : null,
      hvBoxProduct:    isSBW400Eco ? hvBoxProd : null,
      dtsuProduct:     isSBW400Eco ? dtsuProd : null,
      inclJBW41DC:     jbwNeeded,
      jbwQty:          jbwQty,
      jbwProduct:      jbwNeeded ? jbwProd : null,
      // Backup: não compatível com SIW200H/SIW400H
      inclBatBackup:   false,
      batBackupType:   null,
      sgProduct:       null,
      backupBoxProduct: null,
    })
    setSub('done')
  }

  const confirmNoBattery = () => {
    onChange({ ...data, wantsBattery: false, batteryDone: true,
      batProduct: null, sgCtrlProduct: null, lunaCtrlProduct: null, luna2000Product: null,
      batB070Product: null, batCModProduct: null,
      sbw400ModQty: null, sbw400Towers: null, b160Product: null, hvBoxProduct: null, dtsuProduct: null,
      inclJBW41DC: false, jbwQty: 0, jbwProduct: null, inclBatBackup: false,
      sgProduct: null, backupBoxProduct: null })
    setSub('done')
  }

  const editBattery = () => {
    onChange({ ...data, batteryDone: false, wantsBattery: undefined })
    setSub('ask')
  }

  const invName = inv?.nome || inv?.modelo || 'Inversor híbrido'
  const cbKwh   = batKwhByType(batType) * batQty
  const sbwKwh  = 6.9 * sbwGroups

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Armazenamento de Energia</h2>
        <p className="text-gray-500 text-sm">Configuração de bateria para o inversor híbrido</p>
      </div>

      <div className="max-w-2xl mx-auto bg-violet-50 border border-violet-200 rounded-xl p-3 text-sm text-violet-800 flex items-center gap-2">
        <Battery size={15} className="shrink-0" />
        <span>Inversor híbrido: <strong>{invName}</strong></span>
      </div>

      {/* ── Sub-step: ask ── */}
      {sub === 'ask' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-center text-gray-700 font-semibold text-lg">O cliente deseja incluir bateria?</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSub(isCBEco ? 'cbsel' : isSBW400Eco ? 'sbw400sel' : 'sbwsel')}
              className="rounded-2xl border-2 border-violet-300 bg-violet-50 hover:bg-violet-100 p-8 text-center font-bold text-violet-800 text-xl transition-all hover:scale-105"
            >
              ⚡ Sim
              <p className="text-xs font-normal text-violet-500 mt-1">Incluir bateria no kit</p>
            </button>
            <button
              onClick={confirmNoBattery}
              className="rounded-2xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 p-8 text-center font-bold text-gray-600 text-xl transition-all hover:scale-105"
            >
              ✕ Não
              <p className="text-xs font-normal text-gray-400 mt-1">Sem armazenamento</p>
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-step: CB battery selection ── */}
      {sub === 'cbsel' && (
        <div className="max-w-2xl mx-auto space-y-5">
          <p className="text-center text-gray-700 font-semibold">Selecione o modelo de bateria</p>
          <div className="grid grid-cols-2 gap-4">
            {BAT_CB_MODELS.map(opt => ({ ...opt, prod: batProductByType[opt.type] })).filter(opt => opt.prod).map(opt => (
              <button key={opt.type} onClick={() => setBatType(opt.type)}
                className={`rounded-2xl border-2 p-5 text-left transition-all ${
                  batType === opt.type ? 'border-violet-500 bg-violet-50 ring-4 ring-violet-100' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <ProductImg src={getProductImage(opt.prod)} alt={opt.type} fallback="🔋" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-base leading-tight">{opt.type}</p>
                    <p className="text-sm text-gray-500 leading-tight">{opt.desc}</p>
                  </div>
                </div>
                {opt.prod?.preco && <p className="text-xs font-semibold text-violet-700">{fmt(opt.prod.preco)}/un</p>}
              </button>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Quantidade (máx. {maxBat})</p>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setBatQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Minus size={16} />
              </button>
              <span className="text-3xl font-bold text-gray-900 w-12 text-center">{batQty}</span>
              <button onClick={() => setBatQty(q => Math.min(maxBat, q + 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            <p className="text-center mt-2 text-sm text-violet-700 font-semibold">{cbKwh.toFixed(2)} kWh total</p>
            {jbwNeeded && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-sm mx-auto space-y-1">
                <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                  <Info size={12} className="shrink-0" />
                  {jbwQty}× JBW 41DC 50A adicionado automaticamente
                </div>
                {isSIW400H && (
                  <div className="text-[11px] text-amber-700 pl-4 space-y-0.5 border-l-2 border-amber-200 ml-1">
                    {jbwQty === 1 ? (
                      <>
                        <p>Entrada 1 (JBW): {batQty - 1} {batQty - 1 === 1 ? 'bateria' : 'baterias'} em paralelo</p>
                        <p>Entrada 2 (direta): 1 bateria</p>
                      </>
                    ) : (
                      <>
                        <p>Entrada 1 (JBW): {Math.ceil(batQty / 2)} baterias em paralelo</p>
                        <p>Entrada 2 (JBW): {Math.floor(batQty / 2)} baterias em paralelo</p>
                      </>
                    )}
                  </div>
                )}
                {isSIW200H && <p className="text-[11px] text-amber-700 pl-5">Baterias em paralelo via JBW</p>}
              </div>
            )}
          </div>


          <div className="flex justify-between pt-2">
            <button onClick={() => setSub('ask')} className="btn-outline px-4 py-2 text-sm">← Voltar</button>
            <button onClick={confirmBattery} className="btn-primary px-6 py-2 text-sm">Confirmar ✓</button>
          </div>
        </div>
      )}

      {/* ── Sub-step: SBW300 selection ── */}
      {sub === 'sbwsel' && (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-violet-900 mb-2">Sistema SBW300 — componentes do pedido:</p>
            <ul className="text-violet-800 text-xs space-y-1">
              <li>• 1× Módulo de controle: <strong>LUNA2000-10KW</strong> (obrigatório)</li>
              <li>• 1× SmartGuard (backup de cargas críticas): <strong>SmartGuard-63A-{isSIW300H ? 'S0' : 'T0'}</strong> (obrigatório)</li>
              <li>• N× Módulo de bateria: <strong>LUNA2000-7-E1</strong> — 6,9 kWh cada (máx. 3)</li>
            </ul>
            {(lunaCtrlProd?.preco || sgCtrlProd?.preco) && (
              <p className="text-xs text-violet-600 mt-2">
                {lunaCtrlProd?.preco && <>Módulo de controle: {fmt(lunaCtrlProd.preco)}</>}
                {lunaCtrlProd?.preco && sgCtrlProd?.preco && ' · '}
                {sgCtrlProd?.preco && <>SmartGuard: {fmt(sgCtrlProd.preco)}</>}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Módulos LUNA2000-7-E1 (máx. {maxGroups})</p>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setSbwGroups(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Minus size={16} />
              </button>
              <span className="text-3xl font-bold text-gray-900 w-12 text-center">{sbwGroups}</span>
              <button onClick={() => setSbwGroups(q => Math.min(maxGroups, q + 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            {luna2000Prod?.preco && (
              <p className="text-center text-xs text-gray-400 mt-1">{fmt(luna2000Prod.preco)}/módulo</p>
            )}
            <p className="text-center mt-1 text-sm text-violet-700 font-semibold">{sbwKwh.toFixed(1)} kWh total</p>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setSub('ask')} className="btn-outline px-4 py-2 text-sm">← Voltar</button>
            <button onClick={confirmBattery} className="btn-primary px-6 py-2 text-sm">Confirmar ✓</button>
          </div>
        </div>
      )}

      {/* ── Sub-step: SBW400 selection (SIW400H W30) ── */}
      {sub === 'sbw400sel' && (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-violet-900 mb-2">Sistema SBW400 — componentes do pedido:</p>
            <ul className="text-violet-800 text-xs space-y-1">
              <li>• {sbw400Towers}× HV Box (BMS) — 1 por torre (obrigatório)</li>
              <li>• N× Módulo de bateria: <strong>SBW400 B160 W00</strong> — 16,07 kWh cada (4 a 15 por torre, máx. 3 torres)</li>
              <li>• 1× Multimedidor: <strong>DTSU666</strong> (controle de exportação, obrigatório)</li>
            </ul>
            {(hvBoxProd?.preco || b160Prod?.preco) && (
              <p className="text-xs text-violet-600 mt-2">
                {hvBoxProd?.preco && <>HV Box: {fmt(hvBoxProd.preco)}/un</>}
                {hvBoxProd?.preco && b160Prod?.preco && ' · '}
                {b160Prod?.preco && <>B160: {fmt(b160Prod.preco)}/un</>}
              </p>
            )}
            {(!b160Prod || !hvBoxProd || !dtsuProd) && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                SBW400 B160 W00, HV Box e/ou DTSU666 ainda não estão cadastrados no catálogo — o preço fica indisponível até lançar os produtos.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Módulos B160 (4 a {SBW400_MAX_PER_TOWER * SBW400_MAX_TOWERS})</p>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setSbw400Qty(q => Math.max(SBW400_MIN, q - 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Minus size={16} />
              </button>
              <span className="text-3xl font-bold text-gray-900 w-12 text-center">{sbw400Qty}</span>
              <button onClick={() => setSbw400Qty(q => Math.min(SBW400_MAX_PER_TOWER * SBW400_MAX_TOWERS, q + 1))}
                className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            {b160Prod?.preco && (
              <p className="text-center text-xs text-gray-400 mt-1">{fmt(b160Prod.preco)}/módulo</p>
            )}
            <p className="text-center mt-1 text-sm text-violet-700 font-semibold">{sbw400Kwh.toFixed(2)} kWh total em {sbw400Towers} torre{sbw400Towers > 1 ? 's' : ''}</p>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setSub('ask')} className="btn-outline px-4 py-2 text-sm">← Voltar</button>
            <button onClick={confirmBattery} className="btn-primary px-6 py-2 text-sm">Confirmar ✓</button>
          </div>
        </div>
      )}

      {/* ── Sub-step: done / summary ── */}
      {sub === 'done' && (
        <div className="max-w-2xl mx-auto">
          {!data.wantsBattery ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Check size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-700 font-semibold">Sem bateria — kit híbrido padrão</p>
              <p className="text-gray-400 text-sm mt-1">Continue para configurar os acessórios</p>
              <button onClick={editBattery} className="mt-4 text-sm text-violet-600 underline">Alterar</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <p className="font-bold text-violet-900 mb-3 flex items-center gap-2">
                  <Check size={16} /> Bateria configurada
                </p>
                {data.batEco === 'CB' ? (
                  <ul className="text-sm text-violet-800 space-y-1">
                    <li>• <strong>{data.batQty}× {data.batType}</strong> — {(batKwhByType(data.batType) * data.batQty).toFixed(2)} kWh</li>
                    {data.inclJBW41DC && (
                      <li>
                        • {data.jbwQty || 1}× JBW 41DC 50A
                        {isSIW400H && data.batQty > 0 && (
                          <span className="text-violet-600 text-xs ml-1">
                            {(data.jbwQty || 1) >= 2
                              ? `(Ent.1: ${Math.ceil(data.batQty / 2)} bat. · Ent.2: ${Math.floor(data.batQty / 2)} bat.)`
                              : `(Ent.1 JBW: ${data.batQty - 1} bat. · Ent.2: 1 bat.)`}
                          </span>
                        )}
                      </li>
                    )}
                  </ul>
                ) : data.batEco === 'SBW400' ? (
                  <ul className="text-sm text-violet-800 space-y-1">
                    <li>• <strong>{data.sbw400Towers}× HV Box</strong> (BMS, obrigatório — 1 por torre)</li>
                    <li>• <strong>{data.sbw400ModQty}× SBW400 B160 W00</strong> — {(16.07 * (data.sbw400ModQty || 0)).toFixed(2)} kWh</li>
                    <li>• <strong>1× DTSU666</strong> (multimedidor, obrigatório)</li>
                  </ul>
                ) : (
                  <ul className="text-sm text-violet-800 space-y-1">
                    <li>• <strong>1× LUNA2000-10KW</strong> (módulo de controle, obrigatório)</li>
                    <li>• <strong>1× SmartGuard-63A-{isSIW300H ? 'S0' : 'T0'}</strong> (backup, obrigatório)</li>
                    <li>• <strong>{data.sbwGroups}× LUNA2000-7-E1</strong> — {(6.9 * data.sbwGroups).toFixed(1)} kWh</li>
                  </ul>
                )}
              </div>
              <button onClick={editBattery} className="w-full text-sm text-violet-600 underline text-center">
                Alterar configuração de bateria
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Step3({ data, onChange, products, realKwp }) {
  const kitTypeCat = KIT_TYPE_TO_CAT[data.kitType]
  const kitTypeInfo = KIT_TYPES.find(k => k.key === data.kitType)

  const allInverters = products.filter(p => {
    if (p.kitRole !== KIT_ROLE.INVERTER || !p.preco) return false
    if (kitTypeCat && p.categoria !== kitTypeCat) return false
    if (data.kitType === 'ongrid_tri' && data.tensaoRede) {
      const tipo = (p.tipo || '').toLowerCase()
      if (!tipo.includes(data.tensaoRede)) return false
    }
    return true
  })

  // Trifásico: mostrar todos os modelos por padrão (com badges de overload visíveis)
  const [showAll, setShowAll] = useState(data.kitType === 'ongrid_tri')
  const usePowerFilter = data.kitType === 'ongrid_mono' || data.kitType === 'ongrid_tri'

  // SIW400H K-series: deriva tensão da rede da seleção feita no passo 1 (tensaoRede)
  const gridConf = data.tensaoRede || '380'  // '380' = rede 380/220V, '220' = rede 220/127V

  // Inverters sorted: compatible (valid overload) first sorted by closeness to 20% OL,
  // then incompatible sorted by potencia. When showAll=false, hide incompatible.
  const suggested = usePowerFilter
    ? allInverters.filter(inv => isInvCompatibleGrid(inv, realKwp, gridConf))
    : allInverters
  const notSuggested = usePowerFilter
    ? allInverters.filter(inv => !isInvCompatibleGrid(inv, realKwp, gridConf))
    : []
  const sortedSuggested = [...suggested].sort((a, b) => {
    const IDEAL = 0.20
    const effA = getInvEffKw(a, gridConf), effB = getInvEffKw(b, gridConf)
    return Math.abs(realKwp / effA - 1 - IDEAL) - Math.abs(realKwp / effB - 1 - IDEAL)
  })
  const displayList = usePowerFilter
    ? [...sortedSuggested, ...(showAll ? notSuggested : [])]
    : allInverters

  // Mix suggestions: computed when single inverter doesn't cover realKwp
  const mixSuggestions = useMemo(() => {
    if (!usePowerFilter || realKwp <= 0) return []
    const invs = allInverters.filter(inv => inv.preco && inv.potencia > 0)
    const results = []

    // Same-model multiples (2-6 units)
    for (const inv of invs) {
      const maxPer = getMaxDCkW(inv)
      if (maxPer <= 0) continue
      const n = Math.ceil(realKwp / maxPer)
      if (n < 2 || n > 6) continue
      const ol = realKwp / (n * inv.potencia) - 1
      if (ol > getOverloadMax(inv) + 0.001) continue
      results.push({
        inverters: [{ inverter: inv, qty: n }],
        totalCA: round2(n * inv.potencia),
        overloadPct: Math.max(0, round2(ol * 100)),
        totalPrice: round2(n * (inv.preco || 0)),
        units: n,
        label: `${n}× ${inv.nome}`,
      })
    }

    // Pairs 1+1 of different models — feasible when sumMaxDC >= realKwp
    const small = invs.slice(0, 20)
    for (let i = 0; i < small.length; i++) {
      for (let j = i + 1; j < small.length; j++) {
        const a = small[i], b = small[j]
        if (getMaxDCkW(a) + getMaxDCkW(b) < realKwp) continue
        const combinedCA = a.potencia + b.potencia
        const ol = realKwp / combinedCA - 1
        if (ol > Math.min(getOverloadMax(a), getOverloadMax(b)) + 0.001) continue
        results.push({
          inverters: [{ inverter: a, qty: 1 }, { inverter: b, qty: 1 }],
          totalCA: round2(combinedCA),
          overloadPct: Math.max(0, round2(ol * 100)),
          totalPrice: round2((a.preco || 0) + (b.preco || 0)),
          units: 2,
          label: `${a.nome} + ${b.nome}`,
        })
      }
    }

    return results
      .sort((a, b) => a.units - b.units || a.overloadPct - b.overloadPct || a.totalPrice - b.totalPrice)
      .slice(0, 4)
  }, [allInverters, realKwp, usePowerFilter])

  // Mix mode: data.inverters is an array [{inverter, qty}]
  const mixMode = Array.isArray(data.inverters)
  const mixList = data.inverters || []
  const combinedKw = mixList.reduce((s, i) => s + (i.inverter?.potencia || 0) * i.qty, 0)

  const enterMixMode = () => {
    const initial = data.inverter
      ? [{ inverter: data.inverter, qty: data.inverterQty || 1 }]
      : []
    onChange({ ...data, inverters: initial, inverter: undefined, inverterQty: undefined })
  }
  const exitMixMode = () => {
    const first = mixList[0]
    onChange({ ...data, inverters: undefined, inverter: first?.inverter, inverterQty: first?.qty || 1 })
  }

  // ── Warning modal state ──
  const [invWarn, setInvWarn] = useState(null)
  // invWarn: { inv, type:'overload'|'superdim', olPct, maxOlPct, effKw, step:1|2|3, suggestedMix }

  const findSuggestedMix = (inv, effKw) => {
    // Find smallest inverter that covers remaining power with acceptable OL
    const remaining = realKwp - effKw
    const candidates = allInverters
      .filter(p => p.id !== inv.id && p.preco && p.potencia > 0)
      .sort((a, b) => a.potencia - b.potencia)
    return candidates.find(p => {
      const pEff = getInvEffKw(p, gridConf)
      const combinedOl = realKwp / (effKw + pEff) - 1
      return pEff >= remaining * 0.85 && combinedOl <= getOverloadMaxGrid(p, gridConf) + 0.001
    }) || null
  }

  const handleInvClick = (inv, olPct, maxOlPct, effKw) => {
    if (olPct !== null && olPct > maxOlPct) {
      const suggestedMix = findSuggestedMix(inv, effKw)
      setInvWarn({ inv, type: 'overload', olPct, maxOlPct, effKw, step: 1, suggestedMix })
    } else if (olPct !== null && olPct < -20) {
      setInvWarn({ inv, type: 'superdim', olPct, step: 1 })
    } else {
      onChange({ ...data, inverter: inv })
    }
  }

  const applyInvWarning = () => {
    onChange({ ...data, inverter: invWarn.inv })
    setInvWarn(null)
  }

  const applyMixWarning = () => {
    const { inv, suggestedMix, effKw } = invWarn
    onChange({ ...data, inverters: [{ inverter: inv, qty: 1 }, { inverter: suggestedMix, qty: 1 }], inverter: undefined, inverterQty: undefined })
    setInvWarn(null)
  }

  // Modal de aviso de inversores
  const InvWarnModal = invWarn && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── OVERLOAD ── */}
        {invWarn.type === 'overload' && invWarn.step === 1 && (<>
          <div className="bg-red-600 text-white px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <p className="font-bold text-base">Overload excessivo!</p>
              <p className="text-xs text-red-100 mt-0.5">{invWarn.inv.nome}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              Este inversor operaria em <strong className="text-red-600">{invWarn.olPct.toFixed(0)}% de overload</strong>, excedendo o máximo permitido de <strong>{invWarn.maxOlPct}%</strong>.
            </p>
            {invWarn.suggestedMix && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-weg-blue uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Calculator size={12} /> Sugestão de mesclagem
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {invWarn.inv.nome} <span className="text-gray-400">+</span> {invWarn.suggestedMix.nome}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {invWarn.effKw} kW + {getInvEffKw(invWarn.suggestedMix, gridConf)} kW = {round2(invWarn.effKw + getInvEffKw(invWarn.suggestedMix, gridConf))} kW CA
                </p>
                <button
                  onClick={applyMixWarning}
                  className="mt-3 w-full py-2 rounded-xl bg-weg-blue text-white text-sm font-bold hover:bg-weg-blue/90 transition-colors">
                  ↗ Aplicar mesclagem sugerida
                </button>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-500 text-center">ou prosseguir com apenas este inversor:</p>
              <button
                onClick={() => setInvWarn(w => ({ ...w, step: 2 }))}
                className="w-full py-2 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors">
                Continuar com inversor único
              </button>
              <button
                onClick={() => setInvWarn(null)}
                className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </>)}

        {invWarn.type === 'overload' && invWarn.step === 2 && (<>
          <div className="bg-amber-500 text-white px-5 py-4 flex items-center gap-3">
            <Info size={20} className="shrink-0" />
            <p className="font-bold text-base">Este inversor é para ampliação futura?</p>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">
              Se a instalação for expandida (mais painéis) futuramente, o overload temporário pode ser justificado.
            </p>
            <button
              onClick={applyInvWarning}
              className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors">
              Sim, é para ampliação futura — prosseguir
            </button>
            <button
              onClick={() => setInvWarn(w => ({ ...w, step: 3 }))}
              className="w-full py-2.5 rounded-xl border-2 border-amber-400 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors">
              Não, é a instalação definitiva
            </button>
            <button
              onClick={() => setInvWarn(null)}
              className="w-full py-1.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
          </div>
        </>)}

        {invWarn.type === 'overload' && invWarn.step === 3 && (<>
          <div className="bg-gray-800 text-white px-5 py-4 flex items-center gap-3">
            <Shield size={20} className="shrink-0 text-red-400" />
            <div>
              <p className="font-bold text-base">Atenção — Garantia</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <p className="font-bold mb-1">⚠️ A garantia WEG não cobre este caso</p>
              <p>Em caso de falhas ou mau funcionamento causados por operação acima da capacidade nominal ({invWarn.maxOlPct}% máx.), a garantia do inversor <strong>não será válida</strong>.</p>
            </div>
            <button
              onClick={applyInvWarning}
              className="w-full py-2.5 rounded-xl bg-gray-700 text-white text-sm font-bold hover:bg-gray-800 transition-colors">
              Entendi, prosseguir mesmo assim
            </button>
            <button
              onClick={() => setInvWarn(null)}
              className="w-full py-1.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
          </div>
        </>)}

        {/* ── SUPERDIM ── */}
        {invWarn.type === 'superdim' && (<>
          <div className="bg-sky-600 text-white px-5 py-4 flex items-center gap-3">
            <Info size={20} className="shrink-0" />
            <div>
              <p className="font-bold text-base">Inversor superdimensionado</p>
              <p className="text-xs text-sky-100 mt-0.5">{invWarn.inv.nome}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              Este inversor tem capacidade superior à demanda do sistema (<strong className="text-sky-700">{Math.abs(invWarn.olPct).toFixed(0)}% superdimensionado</strong>).
            </p>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800 space-y-1">
              <p>• O inversor não operará na faixa de maior eficiência.</p>
              <p>• Pode haver menor aproveitamento de geração nos horários de pico.</p>
              <p>• Justificável para ampliação futura ou redundância.</p>
            </div>
            <button
              onClick={applyInvWarning}
              className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-colors">
              Entendi, prosseguir mesmo assim
            </button>
            <button
              onClick={() => setInvWarn(null)}
              className="w-full py-1.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
          </div>
        </>)}

      </div>
    </div>
  )

  const getMixEntry = (invId) => mixList.find(i => i.inverter.id === invId)
  const setMixQty = (inv, qty) => {
    if (qty <= 0) {
      onChange({ ...data, inverters: mixList.filter(i => i.inverter.id !== inv.id) })
    } else {
      const exists = mixList.some(i => i.inverter.id === inv.id)
      onChange({
        ...data,
        inverters: exists
          ? mixList.map(i => i.inverter.id === inv.id ? { ...i, qty } : i)
          : [...mixList, { inverter: inv, qty }],
      })
    }
  }

  const catBadge = (inv) => {
    if (inv.categoria === CATEGORIES.MICROINVERSORES) return { cls: 'bg-purple-100 text-purple-700', label: '🔌 Micro' }
    if (inv.categoria === CATEGORIES.INVERSORES_MONO)  return { cls: 'bg-blue-100 text-blue-700',   label: '⚡ Mono'  }
    if (inv.categoria === CATEGORIES.INVERSORES_BOMBEAMENTO) return { cls: 'bg-cyan-100 text-cyan-700', label: '💧 Bomb.' }
    return { cls: 'bg-indigo-100 text-indigo-700', label: '⚡ Tri' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Escolha o inversor</h2>
        <p className="text-gray-500 text-sm flex items-center justify-center gap-2 flex-wrap">
          {kitTypeInfo && (
            <span className="inline-flex items-center gap-1 bg-weg-blue/10 text-weg-blue px-2 py-0.5 rounded-full text-xs font-semibold">
              {kitTypeInfo.icon} {kitTypeInfo.title}
            </span>
          )}
          <span>Sistema: <span className="font-bold text-weg-blue">{realKwp.toFixed(2)} kWp</span></span>
          {usePowerFilter && suggested.length > 0 && !showAll && (
            <span className="text-green-600">— {suggested.length} compatível{suggested.length !== 1 ? 'is' : ''}</span>
          )}
        </p>
        {/* Overload do inversor selecionado */}
        {usePowerFilter && (() => {
          let olPct = null, maxOl = null, label = null, cls = null, invName = null
          if (!mixMode && data.inverter) {
            const effKw = getInvEffKw(data.inverter, gridConf)
            olPct = (realKwp / effKw - 1) * 100
            maxOl = Math.round(getOverloadMaxGrid(data.inverter, gridConf) * 100)
            invName = data.inverter.nome
          } else if (mixMode && mixList.length > 0) {
            olPct = (realKwp / combinedKw - 1) * 100
            maxOl = Math.min(...mixList.map(({ inverter: i }) => Math.round(getOverloadMaxGrid(i, gridConf) * 100)))
            invName = `${mixList.length} inversores`
          }
          if (olPct === null) return null
          const over = olPct > maxOl
          const sub  = olPct < -20
          cls = over ? 'bg-red-100 text-red-700 border-red-200'
              : sub  ? 'bg-sky-100 text-sky-700 border-sky-200'
              : olPct > 30 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
              : 'bg-green-100 text-green-700 border-green-200'
          label = over ? `⚠ OL ${olPct.toFixed(0)}% — excede máx. ${maxOl}%`
                : sub  ? `Superdim. ${Math.abs(olPct).toFixed(0)}%`
                : `OL ${olPct.toFixed(0)}% (máx. ${maxOl}%)`
          return (
            <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${cls}`}>
              <Zap size={12} />
              <span>{invName}:</span>
              <span>{label}</span>
            </div>
          )
        })()}
      </div>

      {/* Warning modal */}
      {InvWarnModal}

      {/* Mode toggle */}
      {data.kitType !== 'micro' && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
            <button
              onClick={exitMixMode}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !mixMode
                  ? 'bg-white shadow-sm text-weg-blue border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚡ Inversor único
            </button>
            <button
              onClick={enterMixMode}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                mixMode
                  ? 'bg-white shadow-sm text-weg-blue border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus size={14} /> Mesclar inversores
            </button>
          </div>
        </div>
      )}

      {/* Dica: Trifásico 220V para kit mais barato — só quando nenhum mono comporta o sistema */}
      {data.kitType === 'ongrid_mono' && realKwp > 0 && suggested.length === 0 && (() => {
        const triInvs = products.filter(p =>
          p.kitRole === KIT_ROLE.INVERTER && p.preco && p.potencia &&
          p.categoria === CATEGORIES.INVERSORES_TRI &&
          (p.tipo || '').toLowerCase().includes('220')
        )
        const cheapestTri = triInvs
          .filter(inv => isInvCompatible(inv, realKwp))
          .sort((a, b) => a.preco - b.preco)[0]
        if (!cheapestTri) return null
        const cheapestMono = [...suggested].sort((a, b) => a.preco - b.preco)[0]
        const saving = cheapestMono && cheapestTri.preco < cheapestMono.preco
          ? round2(cheapestMono.preco - cheapestTri.preco) : null
        return (
          <div className="max-w-2xl mx-auto bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-xl shrink-0">💡</span>
              <div className="min-w-0">
                <p className="font-bold text-emerald-800 text-sm">Kit mais econômico disponível</p>
                <p className="text-xs text-emerald-700 mt-0.5 truncate">
                  {cheapestTri.nome} — {fmt(cheapestTri.preco)}
                  {saving ? ` · economia de ${fmt(saving)} vs. monofásico` : ' (Trifásico 220V)'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onChange({ ...data, kitType: 'ongrid_tri', tensaoRede: '220', inverter: undefined, inverters: undefined })}
              className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              Ver Trifásico 220V →
            </button>
          </div>
        )
      })()}

      {/* Aviso + sugestões de mesclagem */}
      {usePowerFilter && (suggested.length === 0 || mixMode) && mixSuggestions.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3">
          {suggested.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Nenhum inversor único comporta <strong>{realKwp.toFixed(2)} kWp</strong> com as regras de overload. Sugestões de mesclagem abaixo.</span>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-bold text-weg-blue uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Calculator size={13} /> Mesclagens sugeridas — decisão final do cliente
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mixSuggestions.map((s, idx) => (
                <button key={idx}
                  onClick={() => {
                    if (!mixMode) onChange({ ...data, inverters: s.inverters.map(i => ({ ...i })), inverter: undefined, inverterQty: undefined })
                    else {
                      let next = { ...data }
                      for (const { inverter: inv, qty } of s.inverters) {
                        const existing = (next.inverters || []).some(i => i.inverter.id === inv.id)
                        next = { ...next, inverters: existing
                          ? (next.inverters || []).map(i => i.inverter.id === inv.id ? { ...i, qty } : i)
                          : [...(next.inverters || []), { inverter: inv, qty }] }
                      }
                      onChange(next)
                    }
                  }}
                  className="text-left bg-white rounded-xl border border-blue-200 hover:border-weg-blue hover:shadow-sm p-3 transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-bold text-gray-800 leading-tight">{s.label}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      s.overloadPct <= 30 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{s.overloadPct.toFixed(0)}% OL</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1 leading-tight">
                    {s.inverters.map(({ inverter: inv, qty }) =>
                      `${qty > 1 ? qty + '× ' : ''}${inv.potencia} kW`
                    ).join(' + ')}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Total: {s.totalCA} kW CA</span>
                    <span className="font-bold text-weg-orange">{fmt(s.totalPrice)}</span>
                  </div>
                  <p className="text-[10px] text-weg-blue mt-1.5 group-hover:font-semibold">↗ Aplicar esta mesclagem</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Combined power bar (mix mode only) */}
      {mixMode && (
        <div className={`max-w-2xl mx-auto rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-4 ${
          mixList.length === 0
            ? 'border-gray-200 bg-gray-50'
            : combinedKw >= realKwp * 0.85
            ? 'border-green-400 bg-green-50'
            : 'border-amber-400 bg-amber-50'
        }`}>
          <div className="flex items-center gap-3">
            <Zap size={18} className={mixList.length === 0 ? 'text-gray-400' : combinedKw >= realKwp * 0.85 ? 'text-green-600' : 'text-amber-600'} />
            <div>
              <p className="text-sm font-bold text-gray-800">
                {mixList.length === 0 ? 'Nenhum inversor selecionado' : `Potência combinada: ${combinedKw.toFixed(1)} kW`}
              </p>
              {mixList.length > 0 && (
                <p className="text-xs text-gray-500">
                  {mixList.map(i => `${i.qty}× ${i.inverter.nome}`).join(' + ')}
                </p>
              )}
            </div>
          </div>
          {mixList.length > 0 && (() => {
            const olPct = (realKwp / combinedKw - 1) * 100
            const falta = combinedKw < realKwp * 0.85
            if (falta) return (
              <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0 bg-amber-100 text-amber-700">
                falta {(realKwp - combinedKw).toFixed(1)} kW
              </span>
            )
            const over = olPct > 50
            const sub  = olPct < -20
            const cls = over ? 'bg-red-100 text-red-700'
                      : sub  ? 'bg-sky-100 text-sky-700'
                      : olPct > 30 ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
            const lbl = over ? `⚠ OL ${olPct.toFixed(0)}%`
                      : sub  ? `Superdim. ${Math.abs(olPct).toFixed(0)}%`
                      : olPct >= 0 ? `OL ${olPct.toFixed(0)}% ✓`
                      : `OL 0%`
            return (
              <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${cls}`}>
                {lbl}
              </span>
            )
          })()}
        </div>
      )}

      {/* Inverter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayList.map((inv, listIdx) => {
          const badge = catBadge(inv)
          const typeBadge = invTypeBadge(inv)
          const hybridSubBadge = invHybridSubBadge(inv)
          const k400kVar  = getK400KVariant(inv)
          const effKw     = getInvEffKw(inv, gridConf)
          const olPct     = usePowerFilter ? invOverloadPct(realKwp, effKw) : null
          const maxOlPct  = Math.round(getOverloadMaxGrid(inv, gridConf) * 100)
          const compatible = usePowerFilter ? isInvCompatibleGrid(inv, realKwp, gridConf) : true
          // Divider before the first non-suggested inverter in the list
          const firstNotSugg = usePowerFilter && showAll && listIdx === sortedSuggested.length && notSuggested.length > 0
          // Availability
          const invEstoque  = inv.estoque || 'Disponível'
          const invIsEsg    = invEstoque === 'Esgotado' || invEstoque === 'Sem estoque'
          const invIsPrev   = invEstoque === 'Previsão'
          const invPrev     = invIsPrev ? inv.estoque_previsao : null
          const invPrevFmt  = invPrev ? new Date(invPrev + 'T12:00:00').toLocaleDateString('pt-BR') : null

          // ── SINGLE MODE ──
          if (!mixMode) {
            const selected = data.inverter?.id === inv.id
            const olBarCls = olPct === null ? '' :
              olPct > maxOlPct ? 'bg-red-100 text-red-700' :
              olPct > 30       ? 'bg-yellow-100 text-yellow-700' :
              olPct >= 0       ? 'bg-green-100 text-green-700' :
              olPct >= -30     ? 'bg-sky-50 text-sky-600' :
                                 'bg-gray-100 text-gray-500'
            const olLabel = olPct === null ? null :
              olPct > maxOlPct ? `✗ ${olPct.toFixed(0)}% OL — excede máx. ${maxOlPct}%` :
              olPct >= 0       ? `Overload ${olPct.toFixed(0)}% (máx. ${maxOlPct}%)` :
                                 `Superdim. ${olPct.toFixed(0)}%`
            return (
              <div key={inv.id} className="contents">
                {firstNotSugg && (
                  <div className="col-span-full flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">Fora da faixa de overload ({notSuggested.length} modelos)</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <button
                  onClick={() => handleInvClick(inv, olPct, maxOlPct, effKw)}
                  className={`text-left rounded-xl border-2 overflow-hidden transition-all flex flex-col ${
                    selected ? 'border-weg-blue ring-2 ring-blue-100' :
                    invIsEsg  ? 'border-red-300 bg-white hover:border-red-400 hover:shadow-md' :
                    invIsPrev ? 'border-yellow-300 bg-white hover:border-yellow-400 hover:shadow-md' :
                    compatible ? 'border-gray-200 bg-white hover:border-weg-blue/60 hover:shadow-md' :
                    'border-gray-200 bg-white opacity-65 hover:opacity-100 hover:shadow-md'
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-28 bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden flex items-center justify-center shrink-0">
                    <ProductImg src={getProductImage(inv)} alt={inv.nome} fallback="⚡"
                      className={`w-full h-full object-contain p-2 transition-transform duration-500 hover:scale-105 ${invIsEsg ? 'opacity-50 grayscale' : ''}`} />
                    <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[85%]">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${badge.cls}`}>{badge.label}</span>
                      {typeBadge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${typeBadge.cls}`}>{typeBadge.label}</span>}
                      {hybridSubBadge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${hybridSubBadge.cls}`}>{hybridSubBadge.label}</span>}
                      {compatible && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm bg-green-500 text-white">✓ Sugerido</span>}
                      {(invIsEsg || invIsPrev) && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${invIsEsg ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block shrink-0" />
                          {invIsEsg ? 'Esgotado' : invPrevFmt ? `Prev. ${invPrevFmt}` : 'Previsão'}
                        </span>
                      )}
                    </div>
                    {selected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-weg-blue flex items-center justify-center shadow-md">
                        <Check size={13} className="text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white/60 to-transparent" />
                  </div>

                  {/* Specs */}
                  <div className="px-3 pt-3 pb-2 flex-1 space-y-1 text-xs">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{inv.nome}</h3>
                    {(() => {
                      const m = getInverterSpecs(inv)?.subtitulo?.match(/^(STANDARD|LINHA PREMIUM)/)
                      if (!m) return null
                      const isStd = m[1] === 'STANDARD'
                      return (
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 tracking-wide ${isStd ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                          {m[1]}
                        </span>
                      )
                    })()}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Potência CA:</span>
                      <span className="font-bold text-weg-blue">
                        {effKw} kW
                        {k400kVar && effKw !== inv.potencia && (
                          <span className="ml-1 text-gray-400 font-normal">(rede {gridConf === '220' ? '220V' : '380V'})</span>
                        )}
                      </span>
                    </div>
                    {k400kVar && gridConf === '220' && (
                      <div className="flex justify-between text-gray-400">
                        <span>CA 380V:</span>
                        <span>{inv.potencia} kW</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">DC máx:</span>
                      <span className="font-semibold text-gray-700">{getMaxDCkWGrid(inv, gridConf)} kWp (OL máx. {maxOlPct}%)</span>
                    </div>
                    {inv.entradas != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entradas MPPT:</span>
                        <span className="font-semibold text-gray-700">{inv.entradas}</span>
                      </div>
                    )}
                    {inv.disjuntor && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Disjuntor:</span>
                        <span className="font-mono font-semibold text-gray-700">{inv.disjuntor}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-1.5 flex justify-between">
                      <span className="text-gray-500">Preço:</span>
                      <span className="font-bold text-gray-900">{fmt(inv.preco)}</span>
                    </div>
                  </div>

                  {/* Overload bar — full width strip at bottom */}
                  {olLabel && (
                    <div className={`w-full px-3 py-2 text-[11px] font-bold text-center ${olBarCls}`}>
                      {olLabel}
                    </div>
                  )}
                </button>
              </div>
            )
          }

          // ── MIX MODE ──
          const entry = getMixEntry(inv.id)
          const qty = entry?.qty || 0
          const inMix = qty > 0
          // In mix, overload is calculated with qty inverters
          const mixOlPct = qty > 0 && usePowerFilter ? invOverloadPct(realKwp, qty * inv.potencia) : olPct
          const mixMaxOl = Math.round(getOverloadMax(inv) * 100)
          return (
            <div key={inv.id} className="contents">
              {firstNotSugg && (
                <div className="col-span-full flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">Fora da faixa de overload</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
            <div
              className={`rounded-xl border-2 overflow-hidden transition-all ${
                inMix    ? 'border-weg-blue bg-blue-50 ring-2 ring-blue-100' :
                invIsEsg  ? 'border-red-300 bg-white' :
                invIsPrev ? 'border-yellow-300 bg-white' :
                'border-gray-200 bg-white'
              }`}
            >
              <div className="relative h-28 bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden flex items-center justify-center">
                <ProductImg src={getProductImage(inv)} alt={inv.nome} fallback="⚡"
                  className={`w-full h-full object-contain p-2 ${invIsEsg ? 'opacity-50 grayscale' : ''}`} />
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[85%]">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${badge.cls}`}>{badge.label}</span>
                  {typeBadge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${typeBadge.cls}`}>{typeBadge.label}</span>}
                  {hybridSubBadge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${hybridSubBadge.cls}`}>{hybridSubBadge.label}</span>}
                  {compatible && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm bg-green-500 text-white">✓</span>}
                  {(invIsEsg || invIsPrev) && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${invIsEsg ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block shrink-0" />
                      {invIsEsg ? 'Esgotado' : invPrevFmt ? `Prev. ${invPrevFmt}` : 'Previsão'}
                    </span>
                  )}
                </div>
                {inMix && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-weg-blue flex items-center justify-center shadow-md">
                    <Check size={13} className="text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white/70 to-transparent" />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-sm mb-1">{inv.nome}</h3>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  <div className="flex justify-between">
                    <span>Potência CA:</span>
                    <span className="font-bold text-weg-blue">{inv.potencia} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DC máx:</span>
                    <span className="font-semibold text-gray-700">{getMaxDCkW(inv)} kWp (OL máx. {maxOlPct}%)</span>
                  </div>
                  {inv.entradas && <div className="flex justify-between"><span>Entradas MPPT:</span><span className="font-semibold text-gray-700">{inv.entradas}</span></div>}
                  <div className="flex justify-between">
                    <span>Preço unit.:</span>
                    <span className="font-bold text-gray-900">{fmt(inv.preco)}</span>
                  </div>
                </div>
                {olPct !== null && !inMix && (
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-full text-center mb-2 ${
                    olPct > maxOlPct ? 'bg-red-100 text-red-700' : olPct >= 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    1× → overload {olPct.toFixed(0)}%
                  </div>
                )}
                {inMix && mixOlPct !== null && (
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-full text-center mb-2 ${
                    mixOlPct > mixMaxOl ? 'bg-red-100 text-red-700' : mixOlPct >= 0 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {qty}× → overload {mixOlPct.toFixed(0)}%
                  </div>
                )}
                {/* Qty controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMixQty(inv, qty - 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className={`flex-1 text-center font-bold text-lg ${inMix ? 'text-weg-blue' : 'text-gray-300'}`}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setMixQty(inv, qty + 1)}
                    className="w-8 h-8 rounded-lg border border-weg-blue bg-weg-blue text-white flex items-center justify-center hover:bg-weg-blue-mid transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {inMix && (
                  <p className="text-xs text-center text-weg-blue font-semibold mt-1.5">
                    {(qty * inv.potencia).toFixed(1)} kW — {fmt(moneyMul(inv.preco, qty))}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
        })}
      </div>

      {usePowerFilter && notSuggested.length > 0 && (
        <div className="text-center">
          {!showAll
            ? <button onClick={() => setShowAll(true)} className="text-sm text-gray-500 hover:text-weg-blue hover:underline">
                Ver todos os {allInverters.length} modelos (inclui {notSuggested.length} fora do overload)
              </button>
            : <button onClick={() => setShowAll(false)} className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
                Ocultar inversores fora do overload
              </button>
          }
        </div>
      )}

      {/* Seletor de quantidade — modo inversor único */}
      {!mixMode && data.inverter && data.kitType !== 'micro' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 max-w-sm mx-auto">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap size={15} className="text-weg-blue" /> Quantidade de inversores
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ ...data, inverterQty: Math.max(1, (data.inverterQty || 1) - 1) })}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
            >
              <Minus size={16} />
            </button>
            <input
              type="number" min="1"
              value={data.inverterQty || 1}
              onChange={e => onChange({ ...data, inverterQty: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-20 text-center border border-gray-200 rounded-lg px-2 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-weg-blue"
            />
            <button
              onClick={() => onChange({ ...data, inverterQty: (data.inverterQty || 1) + 1 })}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
            >
              <Plus size={16} />
            </button>
            <span className="text-gray-500 text-sm">inversores</span>
          </div>
          {(data.inverterQty || 1) > 1 && (
            <p className="text-xs text-gray-400 mt-2">
              Potência combinada: {((data.inverterQty || 1) * data.inverter.potencia).toFixed(1)} kW
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AccessoryRow (compartilhado) ────────────────────────────────────────────
function AccessoryRow({ icon: Icon, label, product, included, onToggle, qty, onQtyChange, unit = '', color = 'blue' }) {
  const colors = {
    blue:   { border: 'border-weg-blue bg-blue-50',   icon: 'bg-weg-blue',   btn: 'bg-weg-blue hover:bg-weg-blue-mid', sep: 'border-blue-100',  input: 'border-blue-200 focus:ring-weg-blue'   },
    orange: { border: 'border-weg-orange bg-orange-50',icon: 'bg-weg-orange', btn: 'bg-weg-orange hover:bg-orange-600', sep: 'border-orange-100',input: 'border-orange-200 focus:ring-weg-orange'},
    green:  { border: 'border-green-500 bg-green-50',  icon: 'bg-green-600',  btn: 'bg-green-600 hover:bg-green-700',   sep: 'border-green-100', input: 'border-green-200 focus:ring-green-500' },
    violet: { border: 'border-violet-400 bg-violet-50',icon: 'bg-violet-600', btn: 'bg-violet-600 hover:bg-violet-700', sep: 'border-violet-100',input: 'border-violet-200 focus:ring-violet-500'},
  }
  const c = colors[color] || colors.blue
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${included ? c.border : 'border-gray-200 bg-white opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
            <ProductImg src={product ? getProductImage(product) : null} alt={product?.nome || label}
              fallback={<Icon size={18} className={included ? 'text-gray-500' : 'text-gray-400'} />}
              className="max-w-full max-h-full object-contain p-1" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{label}</p>
            {product ? (
              <>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{product.nome}</p>
                <p className="text-xs font-mono text-gray-400">{product.codigo} • {fmt(product.preco)}{unit ? `/${unit}` : ''}</p>
              </>
            ) : (
              <p className="text-xs text-red-400">Produto não encontrado no catálogo</p>
            )}
          </div>
        </div>
        <button onClick={onToggle} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${included ? c.btn + ' text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {included ? '✓' : '+'}
        </button>
      </div>
      {included && onQtyChange && (
        <div className={`mt-3 pt-3 border-t flex items-center gap-3 ${c.sep}`}>
          <span className="text-xs text-gray-500 shrink-0">Qtd:</span>
          <button onClick={() => onQtyChange(Math.max(1, qty - 1))} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus size={12} /></button>
          <input type="number" min="1" value={qty} onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className={`w-16 text-center border rounded-lg px-2 py-1 text-sm font-bold bg-white focus:outline-none focus:ring-1 ${c.input}`} />
          <button onClick={() => onQtyChange(qty + 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus size={12} /></button>
          <span className="text-xs text-gray-400">{unit || 'un'}</span>
          {product?.preco && <span className="ml-auto text-sm font-bold text-weg-orange">{fmt(moneyMul(product.preco, qty))}</span>}
        </div>
      )}
    </div>
  )
}

function CableRow({ label, color, product, meters, onChange }) {
  const isRed = color === 'red'
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${meters > 0 ? (isRed ? 'border-red-400 bg-red-50' : 'border-gray-600 bg-gray-50') : 'border-gray-200 opacity-60'}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          <ProductImg src={product ? getProductImage(product) : null} alt={label}
            fallback={<Cable size={15} className={isRed ? 'text-red-500' : 'text-gray-700'} />}
            className="max-w-full max-h-full object-contain p-1" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{label}</p>
          <p className="text-xs text-gray-400 font-mono">{product?.codigo} • {fmt(product?.preco)}/m</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min="0" value={meters}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className={`w-20 text-center rounded-lg px-2 py-1.5 text-sm font-bold bg-white focus:outline-none focus:ring-1 ${isRed ? 'border border-red-200 focus:ring-red-400' : 'border border-gray-300 focus:ring-gray-400'}`} />
        <span className="text-xs text-gray-500">metros</span>
        {product?.preco && meters > 0 && (
          <span className={`ml-auto text-sm font-bold ${isRed ? 'text-red-600' : 'text-gray-700'}`}>{fmt(moneyMul(product.preco, meters))}</span>
        )}
      </div>
    </div>
  )
}

// ─── BreakerRow — seletor de disjuntor com lista expansível ──────────────────
function BreakerRow({ products, selectedBreaker, onSelect, included, onToggle, isTri, qty = 1, onQtyChange }) {
  const [open, setOpen] = useState(false)

  // Filtra disjuntores da fase correta
  const allBreakers = products.filter(p =>
    p.kitRole === KIT_ROLE.BREAKER && p.preco
  ).sort((a, b) => {
    // Ordena por corrente (número no nome): C16 < C25 < C40 etc.
    const n = s => parseInt((s.nome || '').match(/[CH](\d+)/)?.[1] || 0)
    return n(a) - n(b)
  })

  // Separa mono (bipolar -2) e tri (tripolar -3)
  const monoBreakers = allBreakers.filter(p => /-2$/.test(p.nome) || /-2$/.test(p.modelo))
  const triBreakers  = allBreakers.filter(p => /-3$/.test(p.nome) || /-3$/.test(p.modelo) || /3DF|3DA/i.test(p.nome))
  const displayList  = isTri
    ? (triBreakers.length  ? triBreakers  : allBreakers)
    : (monoBreakers.length ? monoBreakers : allBreakers)

  const current = selectedBreaker

  return (
    <div className={`rounded-xl border-2 transition-all ${included ? 'border-weg-blue bg-blue-50' : 'border-gray-200 bg-white opacity-60'}`}>
      {/* Linha principal */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          <ProductImg src={current ? getProductImage(current) : null} alt={current?.nome || 'Minidisjuntor'}
            fallback={<ToggleLeft size={18} className={included ? 'text-weg-blue' : 'text-gray-400'} />}
            className="max-w-full max-h-full object-contain p-1" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">
            Minidisjuntor CA{current ? ` — ${current.modelo || current.nome}` : ''}
          </p>
          {current ? (
            <p className="text-xs font-mono text-gray-400">{current.codigo} • {fmt(current.preco)}{qty > 1 ? ` × ${qty}` : ''}</p>
          ) : (
            <p className="text-xs text-amber-600">Selecione o modelo abaixo</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {included && (
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1 text-xs font-semibold text-weg-blue bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Alterar <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${included ? 'bg-weg-blue text-white hover:bg-weg-blue-mid' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {included ? '✓' : '+'}
          </button>
        </div>
      </div>

      {/* Qty controls — shown when included and qty prop is provided */}
      {included && onQtyChange && (
        <div className="border-t border-blue-100 px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">Qtd:</span>
          <button onClick={() => onQtyChange(Math.max(1, qty - 1))} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus size={12} /></button>
          <input type="number" min="1" value={qty} onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center border border-blue-200 rounded-lg px-2 py-1 text-sm font-bold bg-white focus:outline-none focus:ring-1 focus:ring-weg-blue" />
          <button onClick={() => onQtyChange(qty + 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus size={12} /></button>
          <span className="text-xs text-gray-400">un</span>
          {current?.preco && <span className="ml-auto text-sm font-bold text-weg-orange">{fmt(moneyMul(current.preco, qty))}</span>}
        </div>
      )}

      {/* Lista expansível */}
      {included && open && (
        <div className="border-t border-blue-100 px-4 pb-4 pt-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {isTri ? 'Disjuntores Trifásicos (-3)' : 'Disjuntores Bipolares (-2)'} disponíveis
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {displayList.map(brk => {
              const sel = current?.id === brk.id
              return (
                <button
                  key={brk.id}
                  onClick={() => { onSelect(brk); setOpen(false) }}
                  className={`text-left rounded-lg border px-3 py-2 transition-all text-sm ${
                    sel
                      ? 'border-weg-blue bg-weg-blue text-white'
                      : 'border-gray-200 bg-white hover:border-weg-blue hover:bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold font-mono text-xs">{brk.modelo || brk.nome}</span>
                    {sel && <Check size={13} />}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className={`text-[11px] font-mono ${sel ? 'text-white/70' : 'text-gray-400'}`}>{brk.codigo}</span>
                    <span className={`text-[11px] font-semibold ${sel ? 'text-white/90' : 'text-weg-blue'}`}>{fmt(brk.preco)}</span>
                  </div>
                </button>
              )
            })}
          </div>
          {displayList.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Nenhum disjuntor encontrado no catálogo.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 5: Acessórios ──────────────────────────────────────────────────────
function Step4({ data, onChange, products }) {
  const kitType  = data.kitType || 'ongrid_mono'
  const isTri    = kitType === 'ongrid_tri'
  const isBomb   = kitType === 'bombeamento'
  const isMicro  = kitType === 'micro'
  const isHybridKit = isHybridInv(data.inverter || data.inverters?.[0]?.inverter)
  const panelCount = data.panelQty || 1
  // In mix mode, first inverter is used for breaker detection; entradas is the sum
  const inv      = data.inverter || data.inverters?.[0]?.inverter
  const entradas = Array.isArray(data.inverters)
    ? Math.max(2, data.inverters.reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0))
    : (inv?.entradas || 2)

  // Microinversores: quantidade = ceil(painéis / entradas por micro) — M010÷2, M024÷4
  const microCount = (isMicro && inv)
    ? Math.max(1, Math.ceil(panelCount / (inv.entradas || 2)))
    : 1
  const microMaxSeries = isMicro ? (inv?.entradas === 4 ? 2 : 5) : 1
  const microSeries    = isMicro ? Math.min(data.microSeries || 1, microMaxSeries) : 1
  const microStrings   = isMicro ? Math.ceil(microCount / microSeries) : 1

  const set  = (k, v) => onChange({ ...data, [k]: v })

  // Battery qty change with auto JBW recalc
  const invModel    = inv?.modelo || ''
  const isSIW400HKit = /SIW400H/.test(invModel)
  const isSIW200HKit = /SIW200H/.test(invModel)
  const batMaxQty   = isSIW400HKit ? 8 : 4
  const updateBatQty = (newQty) => {
    const qty = Math.max(1, Math.min(batMaxQty, newQty))
    const threshold = isSIW200HKit ? 2 : (isSIW400HKit ? 3 : null)
    const needed = (isSIW200HKit || isSIW400HKit) && threshold !== null && qty >= threshold
    const jQty = !needed ? 0 : (isSIW400HKit && qty >= 6 ? 2 : 1)
    onChange({ ...data, batQty: qty, inclJBW41DC: needed, jbwQty: jQty })
  }
  const updateSbwGroups = (newQty) => {
    const maxG = inv?.modelo ? (/SIW500H/.test(inv.modelo) ? 3 : 2) : 2
    set('sbwGroups', Math.max(1, Math.min(maxG, newQty)))
  }
  const updateSbw400Qty = (newQty) => {
    const qty = Math.max(4, Math.min(45, newQty))
    set('sbw400ModQty', qty)
    set('sbw400Towers', Math.max(1, Math.ceil(qty / 15)))
  }

  const bySAP = sap => products.find(p => p.codigo === sap)
  const byRole = role => products.find(p => p.kitRole === role)

  // ── Produtos comuns ──────────────────────────────────────────────────────
  const mc4P        = bySAP(KIT_SAPS.MC4_6MM)     || byRole(KIT_ROLE.MC4)
  const cablePosP   = bySAP(KIT_SAPS.CABO_CC_VML) || byRole(KIT_ROLE.CABLE_POS)
  const cableNegP   = bySAP(KIT_SAPS.CABO_CC_PTO) || byRole(KIT_ROLE.CABLE_NEG)

  // ── Produtos On-Grid string ──────────────────────────────────────────────
  const surgeCAP    = bySAP(KIT_SAPS.SURGE_CA)    || byRole(KIT_ROLE.SURGE_AC)
  const surgeDCP    = byRole(KIT_ROLE.SURGE_DC)
  const isMix       = Array.isArray(data.inverters)
  const invDis      = inv?.disjuntor
  const breakerP    = findBreakerProduct(products, invDis)
  // Mix mode: um grupo por código de disjuntor → um BreakerRow por grupo
  const mixBreakerGroups = isMix
    ? buildBreakerGroups(data.inverters, products, data.breakerSelections)
    : null

  // ── Monitoramento = gateway. Regra conforme ficha técnica WEG de
  // dataloggers/gateways: linha sem Wi-Fi para internet → gateway
  // OBRIGATÓRIO; linha com Wi-Fi integrado mas listada em algum gateway →
  // OPCIONAL; linha com Wi-Fi e sem gateway listado → não aparece.
  const invModelUp = invModel.toUpperCase()
  // Sem Wi-Fi: SIW500H M2/M3/ST060, SIW500G, SIW600/SIW610, SIW750, CFW500/700 SD
  const isHighPowerLoggerFamily = /SIW500H|SIW500G|SIW600|SIW610|SIW750|CFW500|CFW700/.test(invModelUp)
  // Com Wi-Fi mas listada em algum gateway (ED100/PVLOGGER/SolarView/SmartDongle/SmartLogger)
  const isOptionalLoggerFamily  = !isHighPowerLoggerFamily && /SIW300H/.test(invModelUp)
  const monitorRequired = isHighPowerLoggerFamily
  const LOGGER_SAPS = isHighPowerLoggerFamily
    ? ['15557556', '15460491']                             // ED100, SmartLogger3000A — obrigatório
    : isOptionalLoggerFamily
      ? ['15557556', '14312415', '16127033', '15179555']   // ED100, SolarView, IED202, SmartDongle — opcional
      : []                                                  // SIW200H/SIW400H/SIW400G/SIW420G — Wi-Fi, sem gateway listado
  const loggerOptions = LOGGER_SAPS.map(sap => bySAP(sap)).filter(Boolean)

  // ── Produtos Bombeamento ─────────────────────────────────────────────────
  const surgeCCBombP = bySAP(KIT_SAPS.SURGE_CC_12) || byRole(KIT_ROLE.SURGE_DC)
  const fusivelP     = bySAP(KIT_SAPS.FUSIVEL_CC)
  const baseFusP     = bySAP(KIT_SAPS.BASE_FUS)
  const seccionP     = bySAP(KIT_SAPS.SECCION_CC)
  const gatewayP     = bySAP(KIT_SAPS.GATEWAY)
  const kitDetectP   = bySAP(KIT_SAPS.KIT_DETECT)
  const kitSolar5wP  = bySAP(KIT_SAPS.KIT_SOLAR5W)

  // ── Produtos Microinversor ───────────────────────────────────────────────
  const kitConnMiP  = bySAP(KIT_SAPS.KIT_CONN_MI)
  const cableCAP    = isMicro
    ? (bySAP(inv?.entradas === 4 ? KIT_SAPS.CABO_CA_M024 : KIT_SAPS.CABO_CA_M010) || bySAP(KIT_SAPS.CABO_CA_M024))
    : bySAP(KIT_SAPS.CABO_CA_M024)
  const MICRO_BREAKERS_TABLE = isMicro
    ? (inv?.entradas === 4
      ? { 1: 'MDWP-C20-2', 2: 'MDWP-C40-2' }
      : { 1: 'MDWP-C10-2', 2: 'MDWP-C16-2', 3: 'MDWP-C20-2', 4: 'MDWP-C32-2', 5: 'MDWP-C40-2' })
    : {}
  const microBreakerCode = isMicro ? (MICRO_BREAKERS_TABLE[microSeries] || MICRO_BREAKERS_TABLE[1]) : null
  const breakerMicroP    = isMicro ? findBreakerProduct(products, microBreakerCode) : null

  // Total de inversores no kit (1 para modo único, soma das qtds no modo mix)
  const totalInvCount = Array.isArray(data.inverters)
    ? data.inverters.reduce((s, i) => s + i.qty, 0)
    : 1

  // ── Defaults por tipo de kit ─────────────────────────────────────────────
  const defaults = isMicro ? {
    microSeries:   1,
    inclKitConnMi: true,  kitConnMiQty: microStrings,
    cableCAMeters: 10 * microStrings,
    inclSurgeCA:   true,  surgeACQty: 2,
    inclBreaker:   true,  breakerQty: 1,
  } : isBomb ? {
    mc4Qty:        entradas,  cablePosMeters: 25 * entradas, cableNegMeters: 25 * entradas,
    inclFusivel:   true,  fusilvelQty: entradas,
    inclBaseFus:   true,  baseFusQty:  entradas,
    inclSurgeCCBomb: true,
    inclSeccion:   true,
    inclGateway:   true,  inclDetect: true,  inclSolar5w: true,
  } : {
    // On-Grid Mono/Tri
    mc4Qty:        entradas,
    cablePosMeters: 25 * entradas,
    cableNegMeters: 25 * entradas,
    // Surto CA: 2 por inversor mono, 4 por trifásico — calculado por grupo no mix
    surgeACQty: isMix
      ? calcSurgeACQty(data.inverters, isTri)
      : (isTri ? 4 : 2) * totalInvCount,
    inclSurgeCA:   true,
    inclSurgeDC:   true,   surgeDCQty: 1,
    inclBreaker:   true,   breakerQty: totalInvCount,
    monitorSAP:    loggerOptions[0]?.codigo,
    inclMonitor:   true,
  }

  const d = key => data[key] !== undefined ? data[key] : defaults[key]

  // Salva defaults no data (sem loop infinito)
  const pendingDefaults = Object.entries(defaults).filter(([k]) => data[k] === undefined)
  if (pendingDefaults.length > 0) {
    setTimeout(() => onChange({ ...data, ...Object.fromEntries(pendingDefaults) }), 0)
  }

  const estruturaSep = (
    <div className="relative my-2">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-300" /></div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-widest">Estrutura de Fixação</span>
      </div>
    </div>
  )

  const header = (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Acessórios do kit</h2>
      <p className="text-gray-500 text-sm">Quantidades calculadas pelas fórmulas da planilha WEG — ajuste se necessário</p>
    </div>
  )

  // ────────────────────────── MICRO ──────────────────────────────────────────
  if (isMicro) return (
    <div className="space-y-6">
      {header}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800 flex items-center gap-2 max-w-2xl mx-auto">
        <Info size={15} className="shrink-0" />
        <span>Kit Microinversor: <strong>{microCount}×</strong> {inv?.nome} | {panelCount} módulos</span>
      </div>

      {/* Seletor: micros em série por string */}
      <div className="bg-white border border-purple-200 rounded-xl p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Micros em série por string</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {microStrings} string{microStrings !== 1 ? 's' : ''} &bull; Disjuntor:{' '}
              <span className="font-mono font-medium text-purple-700">{microBreakerCode || '–'}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {Array.from({ length: microMaxSeries }, (_, i) => i + 1).map(n => (
              <button key={n}
                onClick={() => onChange({ ...data, microSeries: n, kitConnMiQty: Math.ceil(microCount / n), cableCAMeters: 10 * Math.ceil(microCount / n), selectedBreaker: undefined })}
                className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-colors ${microSeries === n ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-gray-600 hover:border-purple-400'}`}
              >{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
        <AccessoryRow icon={Link2}    label="Kit conector CA (microinversor)"
          product={kitConnMiP} included={d('inclKitConnMi')} onToggle={() => set('inclKitConnMi', !d('inclKitConnMi'))}
          qty={d('kitConnMiQty') ?? microStrings} onQtyChange={v => set('kitConnMiQty', v)} />

        <div className={`rounded-xl border-2 p-4 ${d('cableCAMeters') > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 opacity-60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0"><Cable size={15} /></div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Cabo CA Trifásico</p>
              <p className="text-xs text-gray-400 font-mono">{cableCAP?.codigo} • {fmt(cableCAP?.preco)}/m</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={d('cableCAMeters')} onChange={e => set('cableCAMeters', parseInt(e.target.value) || 0)}
              className="w-20 text-center border border-green-200 rounded-lg px-2 py-1.5 text-sm font-bold bg-white focus:outline-none focus:ring-1 focus:ring-green-400" />
            <span className="text-xs text-gray-500">metros</span>
            {cableCAP?.preco && d('cableCAMeters') > 0 && <span className="ml-auto text-sm font-bold text-green-700">{fmt(moneyMul(cableCAP.preco, d('cableCAMeters')))}</span>}
          </div>
        </div>

        <AccessoryRow icon={Shield}   label="Protetor de Surto CA (SPW02-275-20)"
          product={surgeCAP} included={d('inclSurgeCA')} onToggle={() => set('inclSurgeCA', !d('inclSurgeCA'))}
          qty={d('surgeACQty') ?? 2} onQtyChange={v => set('surgeACQty', v)} />

        <BreakerRow
          products={products}
          selectedBreaker={data.selectedBreaker ?? breakerMicroP ?? breakerP}
          onSelect={brk => set('selectedBreaker', brk)}
          included={d('inclBreaker') ?? true}
          onToggle={() => set('inclBreaker', !d('inclBreaker'))}
          isTri={false}
          qty={d('breakerQty') ?? 1}
          onQtyChange={v => set('breakerQty', v)}
        />

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} panelCount={panelCount} />
      </div>
    </div>
  )

  // ────────────────────────── BOMBEAMENTO ────────────────────────────────────
  if (isBomb) return (
    <div className="space-y-6">
      {header}
      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-sm text-cyan-800 flex items-center gap-2 max-w-2xl mx-auto">
        <Info size={15} className="shrink-0" />
        <span>Kit Bombeamento: <strong>{entradas} entradas</strong> de string → {entradas} fusíveis + {entradas} bases fusível</span>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">

        <AccessoryRow icon={Link2} label="Conectores MC4 6mm²"
          product={mc4P} included={(d('mc4Qty') ?? entradas) > 0}
          onToggle={() => set('mc4Qty', (d('mc4Qty') ?? entradas) > 0 ? 0 : entradas)}
          qty={d('mc4Qty') ?? entradas} onQtyChange={v => set('mc4Qty', v)} unit="pares" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CableRow label="Cabo CC Vermelho (+)" color="red"  product={cablePosP} meters={d('cablePosMeters') ?? 25 * entradas} onChange={v => set('cablePosMeters', v)} />
          <CableRow label="Cabo CC Preto (–)"   color="dark" product={cableNegP} meters={d('cableNegMeters') ?? 25 * entradas} onChange={v => set('cableNegMeters', v)} />
        </div>

        <AccessoryRow icon={Zap}   label="Fusível cartucho CC gPV UR 25A"
          product={fusivelP} included={d('inclFusivel') ?? true}
          onToggle={() => set('inclFusivel', !d('inclFusivel'))}
          qty={d('fusilvelQty') ?? entradas} onQtyChange={v => set('fusilvelQty', v)} color="orange" />

        <AccessoryRow icon={Package} label="Base fusível CC gPV 10X38mm 1P 32A"
          product={baseFusP} included={d('inclBaseFus') ?? true}
          onToggle={() => set('inclBaseFus', !d('inclBaseFus'))}
          qty={d('baseFusQty') ?? entradas} onQtyChange={v => set('baseFusQty', v)} color="orange" />

        <AccessoryRow icon={Shield} label="Protetor de Surto CC SPW12-1100-40"
          product={surgeCCBombP} included={d('inclSurgeCCBomb') ?? true}
          onToggle={() => set('inclSurgeCCBomb', !d('inclSurgeCCBomb'))} />

        <AccessoryRow icon={ToggleLeft} label="Chave Seccionadora CC 4P 1000V"
          product={seccionP} included={d('inclSeccion') ?? true}
          onToggle={() => set('inclSeccion', !d('inclSeccion'))} />

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-300" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-widest">Monitoramento</span></div>
        </div>

        <AccessoryRow icon={Info}  label="Monitoramento Gateway WEG ED100"
          product={gatewayP}   included={d('inclGateway') ?? true} onToggle={() => set('inclGateway', !d('inclGateway'))} color="green" />
        <AccessoryRow icon={Info}  label="Kit Módulo Detecção Solar CFW500-KDS"
          product={kitDetectP} included={d('inclDetect') ?? true}  onToggle={() => set('inclDetect', !d('inclDetect'))}   color="green" />
        <AccessoryRow icon={Info}  label="Kit Módulo Solar 5W 17mm RESUN"
          product={kitSolar5wP}included={d('inclSolar5w') ?? true} onToggle={() => set('inclSolar5w', !d('inclSolar5w'))} color="green" />

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-300" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-widest">Elétrica CA</span></div>
        </div>

        <AccessoryRow icon={ToggleLeft}
          label={`Chave CA ${data.bombTensao === '380' ? 'S6-04002DS0 (380V/Trifásico)' : 'S6-02002DS0 (220V/Monofásico)'}`}
          product={bySAP(data.bombTensao === '380' ? KIT_SAPS.CHAVE_CA_4P : KIT_SAPS.CHAVE_CA_2P)}
          included={d('inclChaveCA') ?? true}
          onToggle={() => set('inclChaveCA', !d('inclChaveCA'))} />

        {data.bombNeedsReactance && (
          <AccessoryRow icon={Zap}
            label="Reatância de saída (distância bomba > 70m)"
            product={products.find(p => /reat[âa]ncia/i.test(p.nome || '') || /reat[âa]ncia/i.test(p.tipo || ''))}
            included={d('inclReactancia') ?? true}
            onToggle={() => set('inclReactancia', !d('inclReactancia'))} />
        )}

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} panelCount={panelCount} />
      </div>
    </div>
  )

  // ────────────────────────── ON-GRID (MONO / TRI) ───────────────────────────
  return (
    <div className="space-y-6">
      {header}
      {isTri && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-800 flex items-center gap-2 max-w-2xl mx-auto">
          <Info size={15} className="shrink-0" />
          <span>Kit Trifásico{data.tensaoRede ? ` ${data.tensaoRede} V` : ''}: <strong>4 protetores de surto CA</strong> + disjuntor trifásico (-3)</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">

        <AccessoryRow icon={Link2} label={`Conectores MC4 6mm² (${entradas} entradas)`}
          product={mc4P} included={(d('mc4Qty') ?? entradas) > 0}
          onToggle={() => set('mc4Qty', (d('mc4Qty') ?? entradas) > 0 ? 0 : entradas)}
          qty={d('mc4Qty') ?? entradas} onQtyChange={v => set('mc4Qty', v)} unit="pares" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CableRow label="Cabo CC Vermelho (+)" color="red"  product={cablePosP} meters={d('cablePosMeters') ?? 25 * entradas} onChange={v => set('cablePosMeters', v)} />
          <CableRow label="Cabo CC Preto (–)"   color="dark" product={cableNegP} meters={d('cableNegMeters') ?? 25 * entradas} onChange={v => set('cableNegMeters', v)} />
        </div>

        <AccessoryRow icon={Shield}
          label={isMix
            ? `Protetor de Surto CA — ${d('surgeACQty') ?? calcSurgeACQty(data.inverters, isTri)} un. (mix)`
            : `Protetor de Surto CA — ${isTri ? '4 un. (Trifásico)' : '2 un. (Monofásico)'}`}
          product={surgeCAP} included={d('inclSurgeCA') ?? true}
          onToggle={() => set('inclSurgeCA', !d('inclSurgeCA'))}
          qty={d('surgeACQty') ?? (isMix ? calcSurgeACQty(data.inverters, isTri) : (isTri ? 4 : 2) * totalInvCount)}
          onQtyChange={v => set('surgeACQty', v)} />

        {mixBreakerGroups
          ? mixBreakerGroups.map(g => (
              <BreakerRow key={g.dis}
                products={products}
                selectedBreaker={(data.breakerSelections || {})[g.dis] || g.product}
                onSelect={brk => set('breakerSelections', { ...(data.breakerSelections || {}), [g.dis]: brk })}
                included={d('inclBreaker') ?? true}
                onToggle={() => set('inclBreaker', !(d('inclBreaker') ?? true))}
                isTri={isTri}
                qty={data[`brkQty_${g.dis}`] ?? g.qty}
                onQtyChange={v => set(`brkQty_${g.dis}`, v)}
              />
            ))
          : <BreakerRow
              products={products}
              selectedBreaker={d('selectedBreaker') ?? breakerP}
              onSelect={brk => set('selectedBreaker', brk)}
              included={d('inclBreaker') ?? true}
              onToggle={() => set('inclBreaker', !(d('inclBreaker') ?? true))}
              isTri={isTri}
              qty={d('breakerQty') ?? totalInvCount}
              onQtyChange={v => set('breakerQty', v)}
            />
        }

        {/* ── Hybrid battery accessories ── */}
        {isHybridKit && data.wantsBattery && (
          <>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-violet-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-violet-500 uppercase tracking-widest">Armazenamento</span></div>
            </div>

            {/* Battery product row */}
            {data.batEco === 'CB' && data.batProduct && (
              <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-violet-200 flex items-center justify-center shrink-0 overflow-hidden">
                    <ProductImg src={getProductImage(data.batProduct)} alt={data.batProduct.nome} fallback="🔋" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{data.batProduct.nome || data.batProduct.modelo}</p>
                    <p className="text-xs text-gray-400 font-mono">{data.batProduct.codigo} • {fmt(data.batProduct.preco)}/un</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateBatQty(data.batQty - 1)}
                      className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600">
                      <Minus size={11} />
                    </button>
                    <span className="text-sm font-bold text-violet-700 w-14 text-center">{data.batQty}× = </span>
                    <button onClick={() => updateBatQty(data.batQty + 1)}
                      disabled={data.batQty >= batMaxQty}
                      className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus size={11} />
                    </button>
                    <span className="text-sm font-bold text-violet-700 ml-1">{fmt(moneyMul(data.batProduct.preco, data.batQty))}</span>
                  </div>
                </div>
                <p className="text-xs text-violet-600 mt-2 ml-11">
                  {(batKwhByType(data.batType) * data.batQty).toFixed(2)} kWh total
                  {(isSIW400HKit || isSIW200HKit) && data.batQty >= (isSIW200HKit ? 2 : 3) && (
                    <span className="ml-2 text-amber-600">
                      • JBW: {data.batQty >= 6 && isSIW400HKit ? `Ent.1: ${Math.ceil(data.batQty/2)} bat. · Ent.2: ${Math.floor(data.batQty/2)} bat.` : `Ent.1: ${data.batQty-1} bat. · Ent.2: 1 bat.`}
                    </span>
                  )}
                </p>
              </div>
            )}

            {data.batEco === 'SBW300' && (
              <>
                {data.lunaCtrlProduct && (
                  <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Cpu size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{data.lunaCtrlProduct.nome || data.lunaCtrlProduct.modelo}</p>
                        <p className="text-xs text-gray-400 font-mono">{data.lunaCtrlProduct.codigo} • {fmt(data.lunaCtrlProduct.preco)}</p>
                        <p className="text-xs text-violet-500">Módulo de controle (BMS)</p>
                      </div>
                      <span className="text-xs font-semibold text-violet-600 shrink-0 bg-violet-100 px-2 py-0.5 rounded-full">obrigatório</span>
                    </div>
                  </div>
                )}
                {data.sgCtrlProduct && (
                  <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Shield size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{data.sgCtrlProduct.nome || data.sgCtrlProduct.modelo}</p>
                        <p className="text-xs text-gray-400 font-mono">{data.sgCtrlProduct.codigo} • {fmt(data.sgCtrlProduct.preco)}</p>
                      </div>
                      <span className="text-xs font-semibold text-violet-600 shrink-0 bg-violet-100 px-2 py-0.5 rounded-full">obrigatório</span>
                    </div>
                  </div>
                )}
                {data.luna2000Product && (
                  <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center shrink-0"><Battery size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{data.luna2000Product.nome || data.luna2000Product.modelo}</p>
                        <p className="text-xs text-gray-400 font-mono">{data.luna2000Product.codigo} • {fmt(data.luna2000Product.preco)}/un</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => updateSbwGroups(data.sbwGroups - 1)}
                          className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600">
                          <Minus size={11} />
                        </button>
                        <span className="text-sm font-bold text-violet-700 w-8 text-center">{data.sbwGroups}×</span>
                        <button onClick={() => updateSbwGroups(data.sbwGroups + 1)}
                          className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600">
                          <Plus size={11} />
                        </button>
                        <span className="text-sm font-bold text-violet-700 ml-1">= {fmt(moneyMul(data.luna2000Product.preco, data.sbwGroups))}</span>
                      </div>
                    </div>
                    <p className="text-xs text-violet-600 mt-2 ml-11">{(6.9 * data.sbwGroups).toFixed(1)} kWh total</p>
                  </div>
                )}
              </>
            )}

            {data.batEco === 'SBW400' && (
              <>
                <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Cpu size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{data.hvBoxProduct?.nome || data.hvBoxProduct?.modelo || 'HV Box (BMS)'}</p>
                      <p className="text-xs text-gray-400 font-mono">{data.hvBoxProduct ? `${data.hvBoxProduct.codigo} • ${fmt(data.hvBoxProduct.preco)}/un` : 'produto a cadastrar'}</p>
                      <p className="text-xs text-violet-500">1 por torre</p>
                    </div>
                    <span className="text-sm font-bold text-violet-700 shrink-0">{data.sbw400Towers}×</span>
                    <span className="text-xs font-semibold text-violet-600 shrink-0 bg-violet-100 px-2 py-0.5 rounded-full">obrigatório</span>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-violet-200 flex items-center justify-center shrink-0 overflow-hidden">
                      <ProductImg src={getProductImage(data.b160Product || { nome: 'SBW400 B160' })} alt="SBW400 B160" fallback="🔋" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{data.b160Product?.nome || data.b160Product?.modelo || 'SBW400 B160 W00'}</p>
                      <p className="text-xs text-gray-400 font-mono">{data.b160Product ? `${data.b160Product.codigo} • ${fmt(data.b160Product.preco)}/un` : 'produto a cadastrar'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => updateSbw400Qty(data.sbw400ModQty - 1)}
                        className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600">
                        <Minus size={11} />
                      </button>
                      <span className="text-sm font-bold text-violet-700 w-8 text-center">{data.sbw400ModQty}×</span>
                      <button onClick={() => updateSbw400Qty(data.sbw400ModQty + 1)}
                        className="w-6 h-6 rounded-full border border-violet-300 flex items-center justify-center hover:border-violet-500 hover:bg-violet-100 transition-colors text-violet-600">
                        <Plus size={11} />
                      </button>
                      {data.b160Product?.preco && (
                        <span className="text-sm font-bold text-violet-700 ml-1">= {fmt(moneyMul(data.b160Product.preco, data.sbw400ModQty))}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-violet-600 mt-2 ml-11">{(16.07 * data.sbw400ModQty).toFixed(2)} kWh total em {data.sbw400Towers} torre{data.sbw400Towers > 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Zap size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{data.dtsuProduct?.nome || data.dtsuProduct?.modelo || 'DTSU666'}</p>
                      <p className="text-xs text-gray-400 font-mono">{data.dtsuProduct ? `${data.dtsuProduct.codigo} • ${fmt(data.dtsuProduct.preco)}` : 'produto a cadastrar'}</p>
                      <p className="text-xs text-violet-500">Multimedidor — controle de exportação</p>
                    </div>
                    <span className="text-xs font-semibold text-violet-600 shrink-0 bg-violet-100 px-2 py-0.5 rounded-full">obrigatório</span>
                  </div>
                </div>
              </>
            )}

            {/* JBW 41DC */}
            {data.inclJBW41DC && data.jbwProduct && (() => {
              const jQty = data.jbwQty || 1
              const incl = d('inclJBW41DC') ?? true
              return (
                <div className={`rounded-xl border-2 p-4 transition-all ${incl ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${incl ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'}`}><Zap size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">JBW 41DC 50A (paralelo de baterias)</p>
                      <p className="text-xs text-gray-400 font-mono">{data.jbwProduct.codigo} • {fmt(data.jbwProduct.preco)}/un</p>
                    </div>
                    <span className="text-sm font-bold text-violet-700 shrink-0">{jQty}× = {fmt(moneyMul(data.jbwProduct.preco, jQty))}</span>
                    <button onClick={() => set('inclJBW41DC', !incl)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${incl ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {incl ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              )
            })()}

          </>
        )}

        {/* ── Monitoramento (gateway) — obrigatório se a linha não tem Wi-Fi,
             opcional se tem Wi-Fi mas aparece listada em algum gateway ── */}
        {loggerOptions.length > 0 && (
          <>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-green-200" /></div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-green-600 uppercase tracking-widest">
                  Monitoramento ({monitorRequired ? 'obrigatório' : 'opcional'})
                </span>
              </div>
            </div>
            {!monitorRequired && (
              <div className="flex justify-end -mt-1">
                <button onClick={() => set('inclMonitor', !(d('inclMonitor')))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    d('inclMonitor') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {d('inclMonitor') ? '✓ Incluído no kit' : '+ Incluir gateway'}
                </button>
              </div>
            )}
            {(monitorRequired || d('inclMonitor')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {loggerOptions.map(opt => {
                const selected = (d('monitorSAP') ?? loggerOptions[0]?.codigo) === opt.codigo
                return (
                  <button key={opt.codigo} onClick={() => set('monitorSAP', opt.codigo)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      selected ? 'border-green-500 bg-green-50 ring-2 ring-green-100' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <p className="font-semibold text-gray-900 text-sm">{opt.nome || opt.modelo}</p>
                    <p className="text-xs text-gray-400 font-mono">{opt.codigo} • {fmt(opt.preco)}</p>
                  </button>
                )
              })}
            </div>
            )}
          </>
        )}

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} panelCount={panelCount} />
      </div>
    </div>
  )
}

// ─── Structure Section ────────────────────────────────────────────────────────
const ROOF_TYPES = [
  { key: 'Cerâmico',      label: 'Telha Cerâmica',         emoji: '🧱', hasIsopleta: true  },
  { key: 'Fibromadeira',  label: 'Fibrocimento / Madeira',  emoji: '🪵', hasIsopleta: true  },
  { key: 'Fibrometálico', label: 'Fibrometálico',           emoji: '🔩', hasIsopleta: true  },
  { key: 'Metálico',      label: 'Metálico perfil 55cm',    emoji: '🏗️', hasIsopleta: false },
  { key: 'Zipado',        label: 'Zipado / Termoacústico',   emoji: '⚡', hasIsopleta: false },
  { key: 'Shingle',       label: 'Shingle (asfáltico)',      emoji: '🏘️', hasIsopleta: false },
  { key: 'Laje',          label: 'Laje',                    emoji: '🏢', hasIsopleta: false },
  { key: 'Carport',       label: 'Garagem Solar / Carport',  emoji: '🚗', hasIsopleta: false },
  { key: 'Solo',          label: 'Solo (fixo)',              emoji: '🌱', hasIsopleta: false },
]

// Metálico profile options: label shown in selector → substring to match in product name
const METALICO_PERFIS = [
  { key: 'padrao', label: 'Perfil 55cm',  match: p => p.includes('perfil 55cm') && !p.includes('33mm') },
  { key: 'longo',  label: 'Perfil longo', match: p => p.includes('perfil longo') && !p.includes('33mm') },
]

// Find the optimal (n3, n4) combination such that 3*n3 + 4*n4 >= N with minimum waste
function computeOptimalMix(N) {
  let best = null
  const maxN4 = Math.ceil(N / 4)
  for (let n4 = maxN4; n4 >= 0; n4--) {
    const covered4 = 4 * n4
    const n3 = covered4 >= N ? 0 : Math.ceil((N - covered4) / 3)
    const total = covered4 + 3 * n3
    const waste = total - N
    const kits = n4 + n3
    if (!best || waste < best.waste || (waste === best.waste && kits < best.kits)) {
      best = { n3, n4, waste, kits }
    }
  }
  return { n3: best?.n3 ?? 0, n4: best?.n4 ?? Math.ceil(N / 4) }
}

const ISOPLETA_OPTIONS = [30, 35, 40, 45, 50]
const SOLO_REGIOES = ['Região 1', 'Região 2 e 3', 'Região 4 e 5']

function StructureSection({ data, onChange, panelCount }) {
  // Usa lista COMPLETA de produtos (não filtrada por lista ativa) para estruturas
  const { products } = useProducts()
  const wants = data.wantsEstrutura
  const roofType = data.estruturaRoofType || ''
  const isopleta = data.estruturaIsopleta || 30
  const soloRegiao = data.soloRegiao || 'Região 1'
  const set = (k, v) => onChange({ ...data, [k]: v })

  const metalicoPerfil = data.metalicoPerfil || 'padrao'

  // All structure kits for selected roof type / isopleta / profile / region
  const availableKits = useMemo(() => {
    if (!roofType) return []

    // Solo: tratado separadamente para filtro Wp com fallback
    if (roofType === 'Solo') {
      const base = products.filter(p => {
        if (!p.nome) return false
        const nl = (p.nome || '').toLowerCase()
        const tl = (p.tipo || '').toLowerCase()
        if (!tl.includes('solo') && !nl.includes('região')) return false
        if (!nl.startsWith(soloRegiao.toLowerCase())) return false
        if (p.soloTier) {
          const tier = panelCount <= 20 ? 'ate20' : 'acima20'
          if (p.soloTier !== tier) return false
        }
        return true
      })
      // Filtra por Wp do painel — se nenhum bater, exibe todos da região/tier
      // (evita "Nenhum kit encontrado" quando a tabela importada tem painéis com Wp diferente)
      if (data.panel?.potencia && base.length > 0) {
        const wpStr = String(data.panel.potencia) + ' wp'
        const wpFiltered = base.filter(k => (k.nome || '').toLowerCase().includes(wpStr))
        return wpFiltered.length > 0 ? wpFiltered : base
      }
      return base
    }

    return products.filter(p => {
      if (!p.nome) return false
      const n = p.nome
      const nl = n.toLowerCase()
      const tl = (p.tipo || '').toLowerCase()
      const catl = (p.categoria || '').toLowerCase()

      if (roofType === 'Solo') return false // já tratado acima

      // Demais tipos — exige categoria Estruturas Metálicas
      const isEstrutura = p.categoria === CATEGORIES.ESTRUTURAS || p.categoria === CATEGORIES.ESTRUTURAS_AVULSOS
      if (!isEstrutura) return false

      if (roofType === 'Carport') return tl.includes('garagem') || tl.includes('carport') || n.startsWith('Carport')
      if (roofType === 'Laje')    return tl.includes('laje')    || n.startsWith('Laje')
      if (!n.startsWith(roofType)) return false

      // Profile filter for Metálico
      if (roofType === 'Metálico') {
        const perfil = METALICO_PERFIS.find(pf => pf.key === metalicoPerfil)
        return perfil ? perfil.match(nl) : nl.includes('perfil 55cm') && !nl.includes('33mm')
      }

      const rt = ROOF_TYPES.find(r => r.key === roofType)
      if (rt?.hasIsopleta) {
        return n.includes(`(${isopleta}-`) || n.includes(`/${isopleta}-`)
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, roofType, isopleta, metalicoPerfil, soloRegiao, data.panel?.potencia, panelCount])

  // Roof types that always use only 4-module kits (no 3-mod mix)
  const FORCE_4MOD = ['Cerâmico', 'Fibromadeira', 'Fibrometálico']

  // Group by module count
  const kits4 = useMemo(() => availableKits.filter(k => (k.potencia || 4) === 4), [availableKits])
  const kits3 = useMemo(() => availableKits.filter(k => (k.potencia || 4) === 3), [availableKits])
  const kits1 = useMemo(() => availableKits.filter(k => (k.potencia || 1) === 1), [availableKits])
  const hasBothMods = kits4.length > 0 && kits3.length > 0 && !FORCE_4MOD.includes(roofType)

  // Optimal mix quantities (auto-computed, overridable)
  const mix = hasBothMods ? computeOptimalMix(panelCount) : null

  // Currently selected kits (from data, or first available as default)
  const selectedKit4 = data.estruturaKit  ? products.find(p => p.id === data.estruturaKit.id)  : (hasBothMods || kits4.length > 0 ? kits4[0] : null)
  const selectedKit3 = data.estruturaKit3 ? products.find(p => p.id === data.estruturaKit3.id) : (hasBothMods ? kits3[0] : null)
  const selectedKitSingle = (!hasBothMods && !kits4.length && !kits3.length)
    ? (kits1[0] || availableKits[0] || null)
    : (!hasBothMods ? (kits4[0] || kits3[0] || availableKits[0] || null) : null)

  // Quantities — use stored value or compute from mix/single
  const qty4 = data.estruturaQty  ?? (mix ? mix.n4 : (selectedKit4 ? Math.ceil(panelCount / (selectedKit4.potencia || 4)) : 0))
  const qty3 = data.estruturaQty3 ?? (mix ? mix.n3 : 0)
  const qtySingle = data.estruturaQty ?? (selectedKitSingle ? Math.ceil(panelCount / (selectedKitSingle.potencia || 1)) : 0)

  const handleRoofChange = (key) => {
    onChange({ ...data, estruturaRoofType: key, estruturaKit: null, estruturaKit3: null, estruturaQty: null, estruturaQty3: null, metalicoPerfil: null })
  }
  const handleIsoChange = (val) => {
    onChange({ ...data, estruturaIsopleta: val, estruturaKit: null, estruturaKit3: null, estruturaQty: null, estruturaQty3: null })
  }

  // Auto-seleciona primeiro kit disponível quando a lista muda (troca de telhado/isopleta)
  useEffect(() => {
    if (!roofType || !wants || roofType === 'Carport') return
    if (data.estruturaKit) return  // já tem kit selecionado manualmente
    if (availableKits.length === 0) return

    if (hasBothMods) {
      const k4 = kits4[0]
      const k3 = kits3[0]
      if (!k4) return
      onChange({
        ...data,
        estruturaKit:  k4,
        estruturaKit3: k3 || null,
        estruturaQty:  mix?.n4 ?? Math.ceil(panelCount / 4),
        estruturaQty3: mix?.n3 ?? 0,
      })
    } else if (selectedKitSingle) {
      const qty = Math.ceil(panelCount / (selectedKitSingle.potencia || 1))
      onChange({
        ...data,
        estruturaKit: selectedKitSingle,
        estruturaQty: qty,
      })
    }
  }, [availableKits]) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo: o SKU do kit depende do Wp do painel (filtro por "<wp> wp" no nome).
  // Se o cliente trocar de módulo depois de já ter um kit Solo selecionado, o
  // efeito acima não reavalia (só roda quando ainda não há kit escolhido) —
  // sem isto, a estrutura ficava presa no Wp antigo mesmo reabrindo Módulos.
  const prevPanelWp = useRef(data.panel?.potencia)
  useEffect(() => {
    if (roofType === 'Solo' && prevPanelWp.current !== data.panel?.potencia && data.estruturaKit) {
      onChange({ ...data, estruturaKit: null, estruturaQty: null })
    }
    prevPanelWp.current = data.panel?.potencia
  }, [data.panel?.potencia, roofType]) // eslint-disable-line react-hooks/exhaustive-deps

  if (wants === undefined || wants === null) {
    // Unanswered — show the question
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-white flex items-center justify-center shrink-0 text-2xl">
            🏗️
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base mb-0.5">
              O cliente deseja incluir estrutura de fixação?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Kits de estrutura para fixação dos painéis no telhado ou solo — cerâmico, fibrocimento, metálico, laje e outros.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => set('wantsEstrutura', true)}
                className="flex-1 py-3 rounded-xl bg-weg-blue text-white font-bold text-sm hover:bg-weg-blue-mid transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} /> Sim, incluir estrutura
              </button>
              <button
                onClick={() => set('wantsEstrutura', false)}
                className="flex-1 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 transition-colors"
              >
                Não, pular
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!wants) {
    // Declined — show summary with change option
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏗️</span>
          <div>
            <p className="font-semibold text-gray-500 text-sm">Estrutura de fixação</p>
            <p className="text-xs text-gray-400">Não incluída no kit</p>
          </div>
        </div>
        <button
          onClick={() => onChange({ ...data, wantsEstrutura: null })}
          className="text-xs text-weg-blue hover:underline"
        >
          Alterar
        </button>
      </div>
    )
  }

  // Wants structure — show configurator
  return (
    <div className="rounded-2xl border-2 border-weg-blue bg-blue-50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Home size={18} className="text-weg-blue" /> Estrutura de Fixação
        </h3>
        <button
          onClick={() => onChange({ ...data, wantsEstrutura: null, estruturaRoofType: null, estruturaKit: null, estruturaKit3: null })}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
        >
          Remover
        </button>
      </div>

      {/* Roof type grid */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tipo de cobertura</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROOF_TYPES.map(rt => (
            <button
              key={rt.key}
              onClick={() => handleRoofChange(rt.key)}
              className={`rounded-xl p-2.5 text-center border-2 transition-all text-sm font-medium ${
                roofType === rt.key
                  ? 'border-weg-blue bg-white text-weg-blue shadow-sm'
                  : 'border-blue-100 bg-white/60 text-gray-600 hover:border-weg-blue/50'
              }`}
            >
              <span className="text-xl block mb-1">{rt.emoji}</span>
              <span className="text-xs leading-tight block">{rt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Isopleta selector */}
      {roofType && ROOF_TYPES.find(r => r.key === roofType)?.hasIsopleta && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Isopleta de vento (m/s)
          </p>
          <div className="flex gap-2 flex-wrap">
            {ISOPLETA_OPTIONS.map(iso => (
              <button
                key={iso}
                onClick={() => handleIsoChange(iso)}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                  isopleta === iso
                    ? 'border-weg-blue bg-weg-blue text-white'
                    : 'border-blue-200 bg-white text-gray-600 hover:border-weg-blue'
                }`}
              >
                {iso} m/s
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Consulte o mapa de isopletas da ABNT NBR 6123 para sua região.
          </p>
        </div>
      )}

      {/* Solo — seletor de região */}
      {roofType === 'Solo' && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Região do projeto (vento)
          </p>
          <div className="flex gap-2 flex-wrap">
            {SOLO_REGIOES.map(r => (
              <button
                key={r}
                onClick={() => onChange({ ...data, soloRegiao: r, estruturaKit: null, estruturaKit3: null, estruturaQty: null, estruturaQty3: null })}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                  soloRegiao === r
                    ? 'border-weg-blue bg-weg-blue text-white'
                    : 'border-blue-200 bg-white text-gray-600 hover:border-weg-blue'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Consulte o mapa de regiões de vento WEG para definir a ESP correta.
          </p>
        </div>
      )}

      {/* Metálico profile selector */}
      {roofType === 'Metálico' && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Perfil</p>
          <div className="flex gap-2 flex-wrap">
            {METALICO_PERFIS.map(pf => (
              <button
                key={pf.key}
                onClick={() => onChange({ ...data, metalicoPerfil: pf.key, estruturaKit: null, estruturaKit3: null, estruturaQty: null, estruturaQty3: null })}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                  metalicoPerfil === pf.key
                    ? 'border-weg-blue bg-weg-blue text-white'
                    : 'border-blue-200 bg-white text-gray-600 hover:border-weg-blue'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Carport — sob consulta */}
      {roofType === 'Carport' && (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8">
          <span className="text-lg font-semibold text-gray-500">Sob consulta</span>
        </div>
      )}

      {/* Kit selection — MIXED mode (3-mod + 4-mod simultaneous) */}
      {roofType && roofType !== 'Carport' && hasBothMods && (
        <div className="space-y-3">
          {/* Automatic mix summary */}
          {mix && (
            <div className="bg-weg-blue/10 rounded-xl px-4 py-2 flex items-center gap-2 text-xs text-weg-blue font-semibold">
              ✨ Seleção automática: {mix.n4 > 0 ? `${mix.n4}× kit 4 módulos` : ''}{mix.n4 > 0 && mix.n3 > 0 ? ' + ' : ''}{mix.n3 > 0 ? `${mix.n3}× kit 3 módulos` : ''} = {mix.n4*4 + mix.n3*3} módulos cobertos
            </div>
          )}

          {/* 4-mod kits list */}
          {kits4.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">
                Kit 4 módulos/unidade — Qtd: <span className="text-weg-blue font-bold">{qty4}</span>
                <span className="font-normal text-gray-400 ml-2">(ajuste abaixo)</span>
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {kits4.map(kit => {
                  const isSel = (data.estruturaKit?.id ?? selectedKit4?.id) === kit.id
                  return (
                    <button
                      key={kit.id}
                      onClick={() => onChange({ ...data, estruturaKit: kit, estruturaQty: mix?.n4 ?? Math.ceil(panelCount / 4) })}
                      className={`w-full text-left rounded-xl border-2 p-2.5 transition-all ${
                        isSel ? 'border-weg-blue bg-white shadow-sm' : 'border-blue-100 bg-white/70 hover:border-weg-blue/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{kit.nome}</p>
                          <p className="text-xs font-mono text-gray-400">SAP: {kit.codigo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-weg-blue">{kit.preco ? fmt(kit.preco) : 'Sob consulta'}</p>
                          {kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(moneyMul(kit.preco, qty4))}</p> : null}
                        </div>
                        {isSel && <Check size={14} className="text-weg-blue shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* qty4 adjuster */}
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => set('estruturaQty', Math.max(0, qty4 - 1))} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Minus size={12} /></button>
                <input type="number" min="0" value={qty4}
                  onChange={e => set('estruturaQty', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 text-center border border-blue-200 rounded-lg py-0.5 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-weg-blue" />
                <button onClick={() => set('estruturaQty', qty4 + 1)} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Plus size={12} /></button>
                <span className="text-xs text-gray-400">{qty4 * 4} módulos</span>
              </div>
            </div>
          )}

          {/* 3-mod kits list */}
          {kits3.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">
                Kit 3 módulos/unidade — Qtd: <span className="text-weg-blue font-bold">{qty3}</span>
                <span className="font-normal text-gray-400 ml-2">(ajuste abaixo)</span>
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {kits3.map(kit => {
                  const isSel = (data.estruturaKit3?.id ?? selectedKit3?.id) === kit.id
                  return (
                    <button
                      key={kit.id}
                      onClick={() => onChange({ ...data, estruturaKit3: kit, estruturaQty3: mix?.n3 ?? Math.ceil(panelCount / 3) })}
                      className={`w-full text-left rounded-xl border-2 p-2.5 transition-all ${
                        isSel ? 'border-weg-blue bg-white shadow-sm' : 'border-blue-100 bg-white/70 hover:border-weg-blue/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{kit.nome}</p>
                          <p className="text-xs font-mono text-gray-400">SAP: {kit.codigo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-weg-blue">{kit.preco ? fmt(kit.preco) : 'Sob consulta'}</p>
                          {kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(moneyMul(kit.preco, qty3))}</p> : null}
                        </div>
                        {isSel && <Check size={14} className="text-weg-blue shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* qty3 adjuster */}
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => set('estruturaQty3', Math.max(0, qty3 - 1))} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Minus size={12} /></button>
                <input type="number" min="0" value={qty3}
                  onChange={e => set('estruturaQty3', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 text-center border border-blue-200 rounded-lg py-0.5 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-weg-blue" />
                <button onClick={() => set('estruturaQty3', qty3 + 1)} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Plus size={12} /></button>
                <span className="text-xs text-gray-400">{qty3 * 3} módulos</span>
              </div>
            </div>
          )}

          {/* Total coverage indicator */}
          <div className="bg-white rounded-xl p-3 border border-blue-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Total coberto: <strong>{qty4 * 4 + qty3 * 3}</strong> módulos para <strong>{panelCount}</strong> painéis
              {qty4 * 4 + qty3 * 3 < panelCount
                ? <span className="text-red-500 ml-1">⚠ insuficiente</span>
                : <span className="text-green-600 ml-1">✓</span>}
            </span>
            {((selectedKit4 || kits4[0]) && (selectedKit3 || kits3[0])) && (
              <span className="font-bold text-weg-orange text-sm ml-auto">
                {fmt(round2(moneyMul((data.estruturaKit ?? selectedKit4)?.preco, qty4) + moneyMul((data.estruturaKit3 ?? selectedKit3)?.preco, qty3)))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Kit selection — SINGLE mode */}
      {roofType && roofType !== 'Carport' && !hasBothMods && availableKits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            {roofType === 'Solo'
              ? `Estrutura Solo — ${availableKits.length} opção${availableKits.length !== 1 ? 'ões' : ''}`
              : `Selecionar kit (${availableKits.length} opções)`}
          </p>
          {roofType === 'Solo' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium mb-2">
              Mesa dupla — estrutura projetada para número par de módulos. Quantidade ímpar é permitida mas pode requerer adaptação.
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {availableKits.map(kit => {
              const modPerKit = kit.potencia || 1
              const autoQty = Math.ceil(panelCount / modPerKit)
              // Solo: preço sempre usa qtd par (arredonda para cima)
              const soloQtyPar = autoQty % 2 === 0 ? autoQty : autoQty + 1
              const isSel = (data.estruturaKit?.id ?? selectedKitSingle?.id) === kit.id
              // Solo: total = qtyPar × preco_por_Wp × Wp_do_painel
              const panelWp = data.panel?.potencia || null
              const soloTotal = roofType === 'Solo' && kit.preco && panelWp
                ? kit.preco * soloQtyPar * panelWp
                : null
              return (
                <button
                  key={kit.id}
                  onClick={() => onChange({ ...data, estruturaKit: kit, estruturaQty: autoQty })}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                    isSel ? 'border-weg-blue bg-white shadow-sm' : 'border-blue-100 bg-white/70 hover:border-weg-blue/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{kit.nome}</p>
                      <p className="text-xs font-mono text-gray-400">
                        SAP: {kit.codigo}
                        {roofType === 'Solo' ? ' • preço/Wp' : ` • ${modPerKit} módulo${modPerKit > 1 ? 's' : ''}/kit`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {roofType === 'Solo'
                        ? <p className="text-xs text-gray-400">{autoQty} módulos → <span className="font-semibold text-amber-600">{soloQtyPar} un.</span> (mesa dupla)</p>
                        : <p className="text-xs text-gray-400">Qtd: {autoQty} kits</p>}
                      {roofType === 'Solo'
                        ? <p className="text-sm font-bold text-weg-blue">{kit.preco ? `R$${kit.preco.toFixed(2).replace('.',',')}/Wp` : 'Sob consulta'}</p>
                        : <p className="text-sm font-bold text-weg-blue">{kit.preco ? fmt(kit.preco) : 'Sob consulta'}</p>}
                      {roofType === 'Solo'
                        ? soloTotal ? <p className="text-xs text-weg-orange font-semibold">{fmt(soloTotal)} total</p> : <p className="text-xs text-gray-400">{panelWp ? '' : 'Selecione painel'}</p>
                        : kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(moneyMul(kit.preco, autoQty))} total</p> : null}
                    </div>
                    {isSel && <Check size={16} className="text-weg-blue shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Quantity adjuster */}
          {(() => {
            const activeKit = data.estruturaKit ?? selectedKitSingle
            const panelWp = data.panel?.potencia || null
            // Solo: preço sempre pela qtd par
            const soloQtyParAdj = qtySingle % 2 === 0 ? qtySingle : qtySingle + 1
            const soloTotalAdj = roofType === 'Solo' && activeKit?.preco && panelWp
              ? activeKit.preco * soloQtyParAdj * panelWp
              : null
            return (
              <div className="flex items-center gap-2 mt-2 bg-white rounded-xl p-2.5 border border-blue-200 flex-wrap gap-y-1">
                <span className="text-xs text-gray-600 font-medium mr-1">Qtd:</span>
                <button
                  onClick={() => set('estruturaQty', Math.max(1, qtySingle - 1))}
                  className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"
                ><Minus size={12} /></button>
                <input
                  type="number"
                  min={1}
                  value={qtySingle}
                  onChange={e => set('estruturaQty', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center border border-blue-200 rounded-lg py-0.5 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-weg-blue"
                />
                <button
                  onClick={() => set('estruturaQty', qtySingle + 1)}
                  className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"
                ><Plus size={12} /></button>
                {roofType === 'Solo'
                  ? <span className="text-xs ml-1 text-gray-500">
                      {qtySingle % 2 !== 0
                        ? <><span className="text-amber-600 font-medium">{qtySingle} módulos ⚠</span><span className="text-gray-400"> → cobrado: {soloQtyParAdj} un.</span></>
                        : <span className="text-gray-400">{qtySingle} módulos (mesa dupla)</span>}
                    </span>
                  : <span className="text-xs text-gray-400 ml-1">cobre {qtySingle * (activeKit?.potencia || 1)} módulos</span>}
                <span className="ml-auto font-bold text-weg-orange text-sm">
                  {roofType === 'Solo'
                    ? soloTotalAdj ? fmt(soloTotalAdj) : (activeKit?.preco ? 'Selecione painel' : 'Sob consulta')
                    : activeKit?.preco ? fmt(moneyMul(activeKit.preco, qtySingle)) : 'Sob consulta'}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {roofType && availableKits.length === 0 && (
        <p className="text-sm text-yellow-700 bg-yellow-50 rounded-xl p-3">
          ⚠ Nenhum kit encontrado para <strong>{roofType}</strong>. Verifique o catálogo.
        </p>
      )}
    </div>
  )
}

// ─── Histórico de Revisões ────────────────────────────────────────────────────
function RevisionHistory({ revisoes, numeroOrcamento }) {
  const [open, setOpen] = useState(false)
  if (!revisoes || revisoes.length === 0) return null
  return (
    <div className="max-w-3xl mx-auto print:hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-weg-blue hover:text-weg-blue transition-colors"
      >
        <span className="flex items-center gap-2">
          <RefreshCw size={15} /> Histórico de revisões
          <span className="bg-weg-blue/10 text-weg-blue text-xs px-2 py-0.5 rounded-full font-bold">{revisoes.length}</span>
        </span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 bg-white rounded-xl border border-weg-blue/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Rev.</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Frete</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {revisoes.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-bold text-weg-blue">
                    {numeroOrcamento ? `${numeroOrcamento}-R${r.revisao}` : `Rev. ${r.revisao}`}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(r.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-[160px]">{r.frete}</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-800">
                    {r.total_final?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── PDF do Estudo — relatório técnico do dimensionamento (Área de Estudo) ──
// Só exibe números já calculados na página de Estudo (resumo pronto), sem
// recalcular nada aqui — essa é a mesma lógica/dados que o usuário viu lá.
function EstudoPrintContent({ resumo, tableInfo }) {
  const dataGerado = resumo.geradoEm ? new Date(resumo.geradoEm) : new Date()
  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <div className="bg-[#1B3A8A] text-white px-6 py-5 rounded-t-xl flex items-center justify-between print-header">
        <div className="flex items-center gap-4">
          <img src="/logo-ernaniff-branco.png" alt="Ernaniff" style={{ height: 36, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none' }} />
          <div>
            <p className="text-lg font-extrabold">Relatório de Dimensionamento</p>
            <p className="text-white/70 text-xs">Sistema híbrido + bateria — {resumo.famKey}{resumo.famKey === 'SIW200H' ? ` (${resumo.phase === 'split' ? 'Split 127/220V' : 'Mono 220V'})` : ''}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-xs">{dataGerado.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <p className="text-white/60 text-xs">{tableInfo?.nome}</p>
        </div>
      </div>

      <div className="border border-gray-200 border-t-0 rounded-b-xl p-6 space-y-5">
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cargas críticas levantadas</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400">
                <th className="text-left py-1.5">Equipamento</th>
                <th className="text-left py-1.5">Tipo</th>
                <th className="text-right py-1.5">W</th>
                <th className="text-right py-1.5">Qtd</th>
                <th className="text-right py-1.5">h/dia</th>
              </tr>
            </thead>
            <tbody>
              {resumo.itens.map((it, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{it.nome}</td>
                  <td className="py-1.5">{it.tipo}</td>
                  <td className="py-1.5 text-right">{it.watts}</td>
                  <td className="py-1.5 text-right">{it.qty}</td>
                  <td className="py-1.5 text-right">{it.horasAtivas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Energia crítica</p>
            <p className="text-lg font-extrabold text-gray-800">{resumo.energiaCriticaDiaria?.toFixed(2)} kWh/dia</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Consumo mensal total</p>
            <p className="text-lg font-extrabold text-gray-800">{resumo.consumoMensal} kWh/mês</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Pico nominal simultâneo</p>
            <p className="text-lg font-extrabold text-gray-800">{resumo.maxNominal?.toFixed(2)} kW</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Pico de partida simultâneo</p>
            <p className="text-lg font-extrabold text-gray-800">{resumo.maxPartida?.toFixed(2)} kW</p>
          </div>
        </section>

        <section className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-[10px] text-violet-400 uppercase font-semibold text-center">kWh de bateria necessário</p>
          <p className="text-2xl font-extrabold text-violet-700 text-center">{resumo.kwhNecessario?.toFixed(2)} kWh</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="w-12 h-12 rounded-lg bg-white border border-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={getProductImage(resumo.bateria?.prod || { nome: resumo.bateria?.tipo })} alt={resumo.bateria?.tipo}
                className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
            </div>
            <p className="text-xs text-gray-600">
              Autonomia: {resumo.autonomiaHoras}h — Sugestão: {resumo.bateria?.qty}× {resumo.bateria?.tipo} ({resumo.bateria?.kwhTotal?.toFixed(2)} kWh total)
            </p>
          </div>
        </section>

        {resumo.modulo && (
          <section className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={getProductImage(resumo.modulo.prod || { nome: resumo.modulo.nome })} alt={resumo.modulo.nome}
                className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Módulos fotovoltaicos</p>
              <p className="text-sm text-gray-700">
                {resumo.modulo.qty}× {resumo.modulo.nome} ({resumo.modulo.potencia} Wp) —{' '}
                {resumo.modulo.kwpInstalado?.toFixed(2)} kWp instalado (necessário: {resumo.modulo.kwpNecessario?.toFixed(2)} kWp)
              </p>
            </div>
          </section>
        )}

        {resumo.inversor && (
          <section className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={getProductImage(resumo.inversor.prod || { nome: resumo.inversor.modelo })} alt={resumo.inversor.modelo}
                className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Inversor escolhido</p>
              <p className="text-sm text-gray-700">
                {resumo.inversor.qty > 1 ? `${resumo.inversor.qty}× ` : ''}{resumo.inversor.modelo} — EPS {resumo.inversor.epsNom}/{resumo.inversor.epsMax} kVA (nominal/pico 60s){resumo.inversor.qty > 1 ? ` por unidade — ${resumo.inversor.qty} unidades em paralelo` : ''}
              </p>
            </div>
          </section>
        )}

        {resumo.cenario && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Simulação de cenário — falta de rede das {resumo.cenario.outageInicio}h por {resumo.cenario.outageDuracao}h
            </p>
            {resumo.cenario.esgotouEm !== null ? (
              <p className="text-xs text-red-600 font-semibold mb-2">⚠ Banco chega na reserva (DoD) por volta das {resumo.cenario.esgotouEm}h — não cobre a janela toda.</p>
            ) : (
              <p className="text-xs text-green-600 font-semibold mb-2">✓ Banco cobre toda a janela simulada sem chegar na reserva.</p>
            )}
            <div className="flex flex-wrap gap-1">
              {resumo.cenario.linha.map(l => (
                <span key={l.h} className={`text-[9px] font-bold px-1.5 py-1 rounded ${
                  l.estado === 'BATERIA_RESERVA' ? 'bg-red-100 text-red-700' : l.estado === 'FALTA_REDE_DIA' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {l.h}h: {l.soc}%
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="pt-3 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Preço estimado (tabela)</p>
          <p className="text-xl font-extrabold text-[#1B3A8A]">
            {Number(resumo.precoEstimadoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </section>

        <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
          Pré-dimensionamento — estimativa de referência baseada em dados informados e curvas simplificadas
          (não substitui projeto elétrico executivo nem validação de engenharia responsável).
        </p>
      </div>
    </div>
  )
}

// ─── Step 6: Resumo / Orçamento ──────────────────────────────────────────────
function Step5({ data, onChange, products, tableInfo, realKwp, initialSavedId, onGoToQuotes }) {
  const { freteOpcoes, desconto: globalDesconto, condicoes } = useProducts()
  const { session, isAdmin, profile } = useAuth()
  // Desconto individual do perfil tem prioridade sobre o desconto global
  const desconto = profile?.desconto_comercial != null ? profile.desconto_comercial : globalDesconto
  const [freteId, setFreteId] = useState(() => {
    if (data.freteAutoId && freteOpcoes.some(f => f.id === data.freteAutoId)) return data.freteAutoId
    if (data.freteAutoIdByRegiao && freteOpcoes.some(f => f.id === data.freteAutoIdByRegiao)) return data.freteAutoIdByRegiao
    return freteOpcoes[0]?.id ?? 1
  })

  // ── Admin: escolher pra qual cliente é esta cotação ──────────────────────
  const [clienteMode, setClienteMode] = useState(data.targetClientId ? 'cadastrado' : 'novo')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteResults, setClienteResults] = useState([])
  const [clienteSearching, setClienteSearching] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)

  const searchClientes = async (q) => {
    setClienteSearch(q)
    if (!q || q.trim().length < 2) { setClienteResults([]); return }
    setClienteSearching(true)
    const term = `%${q.trim()}%`
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, nome, empresa, cnpj, telefone, email')
      .eq('role', 'cliente')
      .or(`nome.ilike.${term},empresa.ilike.${term},cnpj.ilike.${term},telefone.ilike.${term}`)
      .limit(10)
    setClienteResults(rows || [])
    setClienteSearching(false)
  }

  const pickCliente = (c) => {
    setSelectedCliente(c)
    setClienteResults([])
    setClienteSearch('')
    onChange({ ...data, targetClientId: c.id, clienteNome: c.nome, clienteEmpresa: c.empresa })
  }

  // Sincroniza frete quando painel CD Nordeste é selecionado ou quando região do cliente muda
  useEffect(() => {
    if (data.freteAutoId && freteOpcoes.some(f => f.id === data.freteAutoId)) {
      setFreteId(data.freteAutoId)
    } else if (data.freteAutoIdByRegiao && freteOpcoes.some(f => f.id === data.freteAutoIdByRegiao)) {
      setFreteId(data.freteAutoIdByRegiao)
    }
  }, [data.freteAutoId, data.freteAutoIdByRegiao])

  // Fretes permitidos para módulos CD Nordeste
  const isNordeste = isNordestePanel(data.panel)
  const fretePermitidoNordeste = (f) => /(norte|nordeste|fob)/i.test(f.nome)
  const freteOpcoesVisiveis = isNordeste
    ? freteOpcoes.filter(fretePermitidoNordeste)
    : freteOpcoes

  // Corrige seleção se o frete atual não é permitido para CD Nordeste
  useEffect(() => {
    if (!isNordeste) return
    const atual = freteOpcoes.find(f => f.id === freteId)
    if (atual && !fretePermitidoNordeste(atual)) {
      const primeiro = freteOpcoes.find(fretePermitidoNordeste)
      if (primeiro) setFreteId(primeiro.id)
    }
  }, [isNordeste, freteId])

  // ── Salvar cotação ──
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'ok' | 'error'
  const [saveError,  setSaveError]  = useState(null)
  const [savedId, setSavedId] = useState(initialSavedId || null)

  // ── Solicitar desconto ──
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountMotivo, setDiscountMotivo] = useState('')
  const [discountStatus, setDiscountStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  // ── Escopo original (para detectar mudanças que cancelam desconto) ──
  const [originalScope] = useState({
    panelQty: data.panelQty,
    panelId:  data.panel?.id,
    inversorId: data.inversor?.id,
  })

  // ── Resposta do admin ──
  const [quoteInfo, setQuoteInfo] = useState(null)
  useEffect(() => {
    if (!savedId) return
    supabase.from('quotes').select('status, desconto_pct, desconto_resposta')
      .eq('id', savedId).single()
      .then(({ data: q }) => { if (q) setQuoteInfo(q) })
  }, [savedId])

  // Detecta mudança de escopo em relação ao que foi salvo originalmente
  const scopeChanged = !!initialSavedId && (
    data.panelQty   !== originalScope.panelQty ||
    data.panel?.id  !== originalScope.panelId  ||
    data.inversor?.id !== originalScope.inversorId
  )
  const discountWillBeReset = scopeChanged &&
    ['aguardando_desconto', 'aprovada', 'recusada'].includes(quoteInfo?.status)

  // ── Personalização da proposta ──
  const [showPersonal, setShowPersonal] = useState(false)
  const prop = data.proposta || {}
  const setProp = (patch) => onChange({ ...data, proposta: { ...prop, ...patch } })

  // ── Itens avulsos ──
  const avulsos = data.avulsos || []
  const [showAvulsoPanel, setShowAvulsoPanel] = useState(false)
  const [avulsoSearch, setAvulsoSearch]       = useState('')
  const [avulsoCat, setAvulsoCat]             = useState('')
  const [pickedProduct, setPickedProduct]     = useState(null)
  const [pickedQty, setPickedQty]             = useState(1)
  const [pickedUnit, setPickedUnit]           = useState('un')
  const [editingId, setEditingId]             = useState(null)
  // manual fallback
  const [showManual, setShowManual]           = useState(false)
  const emptyManual = { nome: '', codigo: '', qty: 1, unit: 'un', preco: '' }
  const [manualForm, setManualForm]           = useState(emptyManual)

  const catalogCats = useMemo(() => [...new Set(products.map(p => p.categoria))].sort(), [products])

  const avulsoResults = useMemo(() => {
    if (!avulsoSearch.trim() && !avulsoCat) return []
    const q = avulsoSearch.toLowerCase()
    return products.filter(p => {
      if (avulsoCat && p.categoria !== avulsoCat) return false
      if (!q) return true
      return p.nome.toLowerCase().includes(q) ||
             p.codigo.includes(q) ||
             (p.modelo || '').toLowerCase().includes(q)
    }).slice(0, 60)
  }, [products, avulsoSearch, avulsoCat])

  const addFromCatalog = () => {
    if (!pickedProduct) return
    const item = {
      id: editingId ?? Date.now(),
      nome: pickedProduct.nome,
      codigo: pickedProduct.codigo,
      qty: Number(pickedQty) || 1,
      unit: pickedUnit,
      preco: pickedProduct.preco,
    }
    const updated = editingId
      ? avulsos.map(a => a.id === editingId ? item : a)
      : [...avulsos, item]
    onChange({ ...data, avulsos: updated })
    closePanel()
  }

  const saveManual = () => {
    if (!manualForm.nome.trim()) return
    const item = {
      ...manualForm,
      qty: Number(manualForm.qty) || 1,
      preco: manualForm.preco !== '' ? Number(manualForm.preco) : null,
      id: editingId ?? Date.now(),
    }
    const updated = editingId
      ? avulsos.map(a => a.id === editingId ? item : a)
      : [...avulsos, item]
    onChange({ ...data, avulsos: updated })
    closePanel()
  }

  const closePanel = () => {
    setShowAvulsoPanel(false); setAvulsoSearch(''); setAvulsoCat('')
    setPickedProduct(null); setPickedQty(1); setPickedUnit('un')
    setEditingId(null); setShowManual(false); setManualForm(emptyManual)
  }

  const removeAvulso = (id) => onChange({ ...data, avulsos: avulsos.filter(a => a.id !== id) })

  const editAvulso = (a) => {
    setManualForm({ ...a, preco: a.preco ?? '' })
    setEditingId(a.id)
    setShowManual(true)
    setShowAvulsoPanel(true)
  }

  const kitType    = data.kitType || 'ongrid_mono'
  const kitTypeInfo = KIT_TYPES.find(k => k.key === kitType)
  const isTri    = kitType === 'ongrid_tri'
  const isBomb   = kitType === 'bombeamento'
  const isMicro  = kitType === 'micro'
  // Mix mode: data.inverters array; single mode: data.inverter
  const mixInverters = Array.isArray(data.inverters) ? data.inverters : null
  const inv      = data.inverter || mixInverters?.[0]?.inverter
  const entradas = mixInverters
    ? Math.max(2, mixInverters.reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0))
    : (inv?.entradas || 2)
  const panelCount = data.panelQty || 1

  const microCount = (isMicro && inv)
    ? Math.max(1, Math.ceil(panelCount / (inv.entradas || 2)))
    : 1
  const microMaxSeries2 = isMicro ? (inv?.entradas === 4 ? 2 : 5) : 1
  const microSeries2    = isMicro ? Math.min(data.microSeries || 1, microMaxSeries2) : 1
  const microStrings2   = isMicro ? Math.ceil(microCount / microSeries2) : 1
  const MICRO_BRK_TBL   = isMicro
    ? (inv?.entradas === 4
      ? { 1: 'MDWP-C20-2', 2: 'MDWP-C40-2' }
      : { 1: 'MDWP-C10-2', 2: 'MDWP-C16-2', 3: 'MDWP-C20-2', 4: 'MDWP-C32-2', 5: 'MDWP-C40-2' })
    : {}
  const microBrkCode2    = isMicro ? (MICRO_BRK_TBL[microSeries2] || MICRO_BRK_TBL[1]) : null
  const breakerMicroAutoP = isMicro ? findBreakerProduct(products, microBrkCode2) : null

  const totalInvCount = mixInverters
    ? mixInverters.reduce((s, i) => s + i.qty, 0)
    : 1

  const bySAP  = sap  => products.find(p => p.codigo === sap)
  const byRole = role => products.find(p => p.kitRole === role)

  const mc4P       = bySAP(KIT_SAPS.MC4_6MM)     || byRole(KIT_ROLE.MC4)
  const cablePosP  = bySAP(KIT_SAPS.CABO_CC_VML) || byRole(KIT_ROLE.CABLE_POS)
  const cableNegP  = bySAP(KIT_SAPS.CABO_CC_PTO) || byRole(KIT_ROLE.CABLE_NEG)
  const surgeCAP   = bySAP(KIT_SAPS.SURGE_CA)    || byRole(KIT_ROLE.SURGE_AC)
  const surgeCCBP  = bySAP(KIT_SAPS.SURGE_CC_12) || byRole(KIT_ROLE.SURGE_DC)
  const surgeDCP   = byRole(KIT_ROLE.SURGE_DC)
  const invDis      = inv?.disjuntor
  const autoBreaker = findBreakerProduct(products, invDis)
  const breakerP    = data.selectedBreaker || autoBreaker
  // Grupos de disjuntor por tipo de inversor no mix
  const mixBreakerGroups = mixInverters
    ? buildBreakerGroups(mixInverters, products, data.breakerSelections)
        .map(g => ({
          ...g,
          product: (data.breakerSelections || {})[g.dis] || g.product,
          qty: data[`brkQty_${g.dis}`] ?? g.qty,
        }))
    : null

  const d = (key, def) => data[key] !== undefined ? data[key] : def

  // Monta lista de itens conforme tipo de kit
  const kitItems = [
    data.panel   && { label: 'Módulo Fotovoltaico', product: data.panel, qty: panelCount, unit: 'un' },
    // Inversor(es): mix mode → one row per model; single mode → one row
    ...(mixInverters
      ? mixInverters.map(({ inverter: i, qty }) => ({ label: 'Inversor Solar', product: i, qty, unit: 'un' }))
      : [inv && { label: 'Inversor Solar', product: inv, qty: isMicro ? microCount : (data.inverterQty || 1), unit: 'un' }]
    ).filter(Boolean),

    // Ordem: módulo, inversor, proteção, conector, cabos, disjuntor
    // On-Grid string
    (!isMicro && !isBomb) && d('inclSurgeCA', true) && surgeCAP && {
      label: 'Protetor de Surto CA',
      product: surgeCAP,
      qty: d('surgeACQty', mixInverters
        ? calcSurgeACQty(mixInverters, isTri)
        : (isTri ? 4 : 2) * totalInvCount),
      unit: 'un',
    },

    // Itens comuns (CC cables + MC4) — on-grid e bombeamento
    !isMicro && (d('mc4Qty', entradas) > 0) && mc4P &&
      { label: 'Conector MC4 6mm²', product: mc4P, qty: d('mc4Qty', entradas), unit: 'pares' },
    !isMicro && (d('cablePosMeters', 25*entradas) > 0) && cablePosP &&
      { label: 'Cabo CC Vermelho (+)', product: cablePosP, qty: d('cablePosMeters', 25*entradas), unit: 'm' },
    !isMicro && (d('cableNegMeters', 25*entradas) > 0) && cableNegP &&
      { label: 'Cabo CC Preto (–)', product: cableNegP, qty: d('cableNegMeters', 25*entradas), unit: 'm' },

    // Disjuntor: um item por grupo de disjuntor no mix, ou item único no modo normal
    ...(!isMicro && !isBomb && d('inclBreaker', true)
      ? (mixBreakerGroups
          ? mixBreakerGroups.filter(g => g.product).map(g => ({ label: 'Minidisjuntor CA', product: g.product, qty: g.qty, unit: 'un' }))
          : (breakerP ? [{ label: 'Minidisjuntor CA', product: breakerP, qty: d('breakerQty', totalInvCount), unit: 'un' }] : [])
        )
      : []
    ),

    // Monitoramento (On-Grid + Híbrido) = gateway — obrigatório ou opcional
    // conforme a família do inversor (ver loggerOptions/monitorRequired em Step4);
    // d('inclMonitor', true) é sempre true pra famílias obrigatórias (sem toggle lá)
    !isMicro && !isBomb && d('inclMonitor', true) && data.monitorSAP && bySAP(data.monitorSAP) &&
      { label: 'Monitoramento', product: bySAP(data.monitorSAP), qty: 1, unit: 'un' },

    // Bombeamento
    isBomb && d('inclFusivel', true)     && bySAP(KIT_SAPS.FUSIVEL_CC) &&
      { label: 'Fusível cartucho CC gPV UR 25A', product: bySAP(KIT_SAPS.FUSIVEL_CC), qty: d('fusilvelQty', entradas), unit: 'un' },
    isBomb && d('inclBaseFus', true)     && bySAP(KIT_SAPS.BASE_FUS) &&
      { label: 'Base fusível CC gPV 10X38mm', product: bySAP(KIT_SAPS.BASE_FUS), qty: d('baseFusQty', entradas), unit: 'un' },
    isBomb && d('inclSurgeCCBomb', true) && surgeCCBP &&
      { label: 'Protetor de Surto CC SPW12-1100-40', product: surgeCCBP, qty: 1, unit: 'un' },
    isBomb && d('inclSeccion', true)     && bySAP(KIT_SAPS.SECCION_CC) &&
      { label: 'Chave Seccionadora CC 4P 1000V', product: bySAP(KIT_SAPS.SECCION_CC), qty: 1, unit: 'un' },
    isBomb && d('inclGateway', true)     && bySAP(KIT_SAPS.GATEWAY) &&
      { label: 'Gateway WEG ED100', product: bySAP(KIT_SAPS.GATEWAY), qty: 1, unit: 'un' },
    isBomb && d('inclDetect', true)      && bySAP(KIT_SAPS.KIT_DETECT) &&
      { label: 'Kit Detecção Solar CFW500-KDS', product: bySAP(KIT_SAPS.KIT_DETECT), qty: 1, unit: 'un' },
    isBomb && d('inclSolar5w', true)     && bySAP(KIT_SAPS.KIT_SOLAR5W) &&
      { label: 'Kit Módulo Solar 5W RESUN', product: bySAP(KIT_SAPS.KIT_SOLAR5W), qty: 1, unit: 'un' },
    isBomb && d('inclChaveCA', true) && bySAP(data.bombTensao === '380' ? KIT_SAPS.CHAVE_CA_4P : KIT_SAPS.CHAVE_CA_2P) &&
      { label: `Chave CA ${data.bombTensao === '380' ? 'S6-04002DS0' : 'S6-02002DS0'}`,
        product: bySAP(data.bombTensao === '380' ? KIT_SAPS.CHAVE_CA_4P : KIT_SAPS.CHAVE_CA_2P), qty: 1, unit: 'un' },
    isBomb && data.bombNeedsReactance && d('inclReactancia', true) && (() => {
      const r = products.find(p => /reat[âa]ncia/i.test(p.nome || '') || /reat[âa]ncia/i.test(p.tipo || ''))
      return r ? { label: 'Reatância de saída', product: r, qty: 1, unit: 'un' } : null
    })(),

    // Microinversor — ordem: proteção, conector, cabo, disjuntor
    isMicro && d('inclSurgeCA', true) && surgeCAP &&
      { label: 'Protetor de Surto CA', product: surgeCAP, qty: d('surgeACQty', 2), unit: 'un' },
    isMicro && d('inclKitConnMi', true) && bySAP(KIT_SAPS.KIT_CONN_MI) &&
      { label: 'Kit conector CA SIW100G W10', product: bySAP(KIT_SAPS.KIT_CONN_MI), qty: d('kitConnMiQty', microStrings2), unit: 'un' },
    isMicro && (d('cableCAMeters', 10*microStrings2) > 0) && (() => {
      const caP = bySAP(inv?.entradas === 4 ? KIT_SAPS.CABO_CA_M024 : KIT_SAPS.CABO_CA_M010) || bySAP(KIT_SAPS.CABO_CA_M024)
      return caP ? { label: 'Cabo CA 3×6mm²', product: caP, qty: d('cableCAMeters', 10*microStrings2), unit: 'm' } : null
    })(),
    isMicro && d('inclBreaker', true) && (data.selectedBreaker || breakerMicroAutoP || autoBreaker) &&
      { label: 'Minidisjuntor CA', product: data.selectedBreaker || breakerMicroAutoP || autoBreaker, qty: d('breakerQty', 1), unit: 'un' },

    // Estrutura (todos os tipos) — kit 4-mod
    data.wantsEstrutura && data.estruturaKit && (data.estruturaQty || 0) > 0 && (() => {
      const isSolo = data.estruturaRoofType === 'Solo'
      const panelWp = data.panel?.potencia || 1
      // Solo: qtd cobrada = par (arredonda para cima se ímpar); preço = preco/Wp × Wp_painel
      const rawQty = data.estruturaQty || 1
      const qty = isSolo ? (rawQty % 2 === 0 ? rawQty : rawQty + 1) : rawQty
      const prod = isSolo
        ? { ...data.estruturaKit, preco: round2(data.estruturaKit.preco * panelWp + 3), precoFrete: round2((data.estruturaKit.precoFrete || data.estruturaKit.preco) * panelWp + 3) }
        : data.estruturaKit
      return { label: 'Estrutura de Fixação', product: prod, qty, unit: isSolo ? 'un' : 'kit' }
    })(),
    // Estrutura — kit 3-mod (mixed selection)
    data.wantsEstrutura && data.estruturaKit3 && (data.estruturaQty3 || 0) > 0 &&
      { label: 'Estrutura de Fixação', product: data.estruturaKit3, qty: data.estruturaQty3, unit: 'kit' },

    // Híbrido — bateria CB050 / CB100
    data.wantsBattery && data.batEco === 'CB' && data.batProduct &&
      { label: `Bateria ${data.batType}`, product: data.batProduct, qty: data.batQty || 1, unit: 'un' },

    // Híbrido — sistema SBW300 (módulo de controle + SmartGuard backup + baterias LUNA2000-7-E1)
    data.wantsBattery && data.batEco === 'SBW300' && data.lunaCtrlProduct &&
      { label: 'LUNA2000-10KW (módulo de controle)', product: data.lunaCtrlProduct, qty: 1, unit: 'un' },
    data.wantsBattery && data.batEco === 'SBW300' && data.sgCtrlProduct &&
      { label: `SmartGuard-63A-${data.sgCtrlProduct.nome?.includes('T0') ? 'T0' : 'S0'} (backup)`, product: data.sgCtrlProduct, qty: 1, unit: 'un' },
    data.wantsBattery && data.batEco === 'SBW300' && data.luna2000Product &&
      { label: 'LUNA2000-7-E1 (6,9 kWh)', product: data.luna2000Product, qty: data.sbwGroups || 1, unit: 'un' },

    // Híbrido — sistema SBW400 (SIW400H W30): HV Box (1 por torre) + módulos B160
    data.wantsBattery && data.batEco === 'SBW400' && data.hvBoxProduct &&
      { label: 'HV Box (BMS)', product: data.hvBoxProduct, qty: data.sbw400Towers || 1, unit: 'un' },
    data.wantsBattery && data.batEco === 'SBW400' && data.b160Product &&
      { label: 'SBW400 B160 W00 (16,07 kWh)', product: data.b160Product, qty: data.sbw400ModQty || 4, unit: 'un' },
    data.wantsBattery && data.batEco === 'SBW400' && data.dtsuProduct &&
      { label: 'DTSU666 (controle de exportação)', product: data.dtsuProduct, qty: 1, unit: 'un' },

    // Híbrido — JBW 41DC (qty 1 ou 2 conforme batQty)
    data.wantsBattery && d('inclJBW41DC', false) && data.jbwProduct &&
      { label: 'JBW 41DC 50A (paralelo baterias)', product: data.jbwProduct, qty: data.jbwQty || 1, unit: 'un' },


    // Itens avulsos
    ...avulsos.map(a => ({
      label: a.nome,
      product: { nome: a.nome, codigo: a.codigo || '—', preco: a.preco },
      qty: a.qty,
      unit: a.unit,
      avulso: true,
      avulsoId: a.id,
    })),
  ].filter(Boolean)

  // Fatores de precificação aplicados sobre o preço de tabela
  const F1 = 0.63   // Fator 1
  const F2 = 0.92   // Fator 2
  const F3 = 0.95   // Fator 3
  const F4 = 0.93   // Fator 4

  // Subtotal: sum raw price×qty for all lines, round only the total (Excel: ROUND(SOMARPRODUTO(preços,qtds),2))
  const subtotal    = round2(kitItems.reduce((sum, item) => sum + (item.product.preco || 0) * item.qty, 0))
  const freteOpcao  = freteOpcoes.find(f => f.id === freteId) || freteOpcoes[0] || { nome: 'FOB', acrescimo: 1 }
  const fatorDesc   = 1 - (desconto / 100)
  // Excel: ROUND(subtotal × F1 × F2 × F3 × F4 × fatorDesc, 2) — one multiplication, one round
  const totalAjust  = round2(subtotal * F1 * F2 * F3 * F4 * fatorDesc)
  const ajusteAmt   = round2(subtotal - totalAjust)
  const freteAmt    = round2(totalAjust * (freteOpcao.acrescimo - 1))
  const totalFinal  = round2(totalAjust * freteOpcao.acrescimo)
  // Fator único (ajustes + desconto + frete) pra refletir o preço final também por linha
  const priceRatio  = subtotal ? totalFinal / subtotal : 1

  // ── Monta payload base da cotação ──
  const buildQuotePayload = (extraStatus = 'rascunho', extraFields = {}) => ({
    user_id:      session?.user?.id,
    nome_projeto: data.clienteNome
      ? `Kit ${realKwp.toFixed(2)} kWp — ${data.clienteNome}`
      : `Kit ${realKwp.toFixed(2)} kWp`,
    kit_type:    data.kitType,
    kwp:         realKwp,
    subtotal,
    desconto_pct: desconto,
    frete_nome:  freteOpcao.nome,
    frete_pct:   freteOpcao.acrescimo,
    total_final: totalFinal,
    status:      extraStatus,
    kit_data:    data,   // evita conflito de nome com variável 'data'
    ...extraFields,
  })

  const buildItems = () => kitItems.map(item => ({
    label:      item.label,
    produto:    item.product.nome,
    codigo_sap: item.product.codigo,
    qty:        item.qty,
    unit:       item.unit,
    preco_unit: item.product.preco || 0,
    total:      moneyMul(item.product.preco, item.qty),
  }))

  // ── Save quote to Supabase ──
  // Salva cotação + itens via RPC server-side (save_quote_with_items): o
  // servidor recalcula subtotal/total_final/preco_unit a partir do catálogo
  // de preços publicado (price_catalog_products), ignorando qualquer preço
  // enviado pelo navegador para produtos reconhecidos — fecha o buraco de
  // confiar 100% no cliente para esses valores.
  const saveQuote = async ({ silent = false, statusOverride } = {}) => {
    if (!session) return null
    if (!silent) setSaveStatus('saving')

    const items = buildItems()
    let quoteId = savedId
    let shouldResetDiscount = false

    try {
      let kitDataToSave
      let statusToSend
      let descontoToSend = desconto

      if (!quoteId) {
        // ── Gera número único de referência EFF-YYYY-NNN (global, sem repetição) ──
        // RPC porque RLS só deixa o cliente ver as próprias cotações — a numeração
        // global precisa rodar no banco (SECURITY DEFINER) pra enxergar todas.
        const { data: numeroOrcamento } = await supabase.rpc('next_orcamento_number')
        kitDataToSave = {
          ...data, numero_orcamento: numeroOrcamento, revisao: 0, revisoes: [],
          // Marca que foi o admin quem montou este kit (não o próprio cliente) —
          // mostrado como aviso interno e no rodapé da proposta impressa.
          ...(isAdmin ? {
            criadoPorAdmin: true,
            criadoPorAdminNome: profile?.nome || 'Equipe Ernaniff',
            clienteCadastrado: !!data.targetClientId,
          } : {}),
        }
        statusToSend = statusOverride || 'enviada'
      } else {
        // ── Incrementa revisão a cada atualização ──
        const novaRevisao = (data.revisao || 0) + 1
        const historicoRevisao = {
          revisao: novaRevisao,
          data: new Date().toISOString(),
          total_final: totalFinal,
          frete: freteOpcao.nome,
        }
        kitDataToSave = {
          ...data,
          revisao: novaRevisao,
          revisoes: [...(data.revisoes || []), historicoRevisao],
        }

        shouldResetDiscount =
          ['aguardando_desconto', 'aprovada', 'recusada'].includes(quoteInfo?.status) && scopeChanged
        if (shouldResetDiscount) {
          descontoToSend = 0
          statusToSend = 'enviada'
        } else {
          statusToSend = statusOverride || null
        }
      }

      const basePayload = buildQuotePayload()
      const { data: result, error } = await supabase.rpc('save_quote_with_items', {
        p_quote_id:     quoteId,
        p_nome_projeto: basePayload.nome_projeto,
        p_kit_type:     basePayload.kit_type,
        p_kwp:          basePayload.kwp,
        p_desconto_pct: descontoToSend,
        p_frete_nome:   freteOpcao.nome,
        p_frete_pct:    freteOpcao.acrescimo,
        p_status:       statusToSend,
        p_kit_data:     kitDataToSave,
        p_items:        items,
        p_target_user_id: isAdmin ? (data.targetClientId || null) : null,
      })
      if (error) throw error
      const row = Array.isArray(result) ? result[0] : result
      quoteId = row.quote_id

      if (!savedId) setSavedId(quoteId)
      if (shouldResetDiscount) {
        setQuoteInfo(prev => ({ ...prev, status: 'enviada', desconto_pct: 0, desconto_resposta: null }))
      }
      // Propaga referência/revisão para o estado local
      onChange(kitDataToSave)

      if (!silent) {
        setSaveStatus('ok')
        setTimeout(() => setSaveStatus(null), 3000)
      }
      return quoteId
    } catch (err) {
      console.error('[saveQuote]', err)
      const msg = err?.message || JSON.stringify(err) || 'Erro desconhecido'
      if (!silent) { setSaveStatus('error'); setSaveError(msg) }
      return null
    }
  }

  // Tela pós-impressão
  const [showPrintedScreen, setShowPrintedScreen] = useState(false)
  const [pendingPrint, setPendingPrint] = useState(false)
  const [isPrintingEstudo, setIsPrintingEstudo] = useState(false)

  // Imprime após voltar para a tela do kit (quando success screen some)
  // Dois requestAnimationFrame garantem que o browser pintou o #kit-print antes de imprimir
  // Após o diálogo de impressão fechar (imprimiu ou cancelou) navega para Minhas Cotações
  useEffect(() => {
    if (pendingPrint && !showPrintedScreen) {
      setPendingPrint(false)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.addEventListener('afterprint', () => {
          setShowPrintedScreen(true)
        }, { once: true })
        doPrint()
      }))
    }
  }, [pendingPrint, showPrintedScreen])

  // Move #kit-print para filho direto do body antes de imprimir e restaura depois.
  // Sobrescreve estilos inline para evitar que overflow:hidden/auto e border-radius
  // cortem conteúdo no mobile — mais confiável que depender só de @media print.
  const doPrint = () => {
    const el = document.getElementById('kit-print')
    if (!el) { window.print(); return }
    const parent     = el.parentNode
    const next       = el.nextSibling
    const savedStyle = el.style.cssText

    el.style.cssText = [
      'position:static',
      'inset:auto',
      'width:100%',
      'max-width:none',
      'height:auto',
      'max-height:none',
      'overflow:visible',
      'border-radius:0',
      'box-shadow:none',
      'z-index:auto',
      'background:white',
    ].join(';')

    document.body.appendChild(el)
    document.body.classList.add('is-printing')
    const restore = () => {
      document.body.classList.remove('is-printing')
      el.style.cssText = savedStyle
      if (el.parentNode === document.body) parent.insertBefore(el, next)
    }
    window.addEventListener('afterprint', restore, { once: true })
    setTimeout(() => window.print(), 80)
  }

  // ── PDF do Estudo — reaproveita o mesmo mecanismo de impressão do
  // #kit-print (doPrint), só troca por um instante qual elemento tem esse
  // id, já que os dois nunca precisam imprimir ao mesmo tempo ──
  const handlePrintEstudo = () => {
    setIsPrintingEstudo(true)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const mainEl   = document.getElementById('kit-print')
      const estudoEl = document.getElementById('kit-print-estudo')
      if (!estudoEl) { setIsPrintingEstudo(false); return }
      if (mainEl) mainEl.id = 'kit-print-principal-temp'
      estudoEl.id = 'kit-print'
      const restoreIds = () => {
        estudoEl.id = 'kit-print-estudo'
        if (mainEl) mainEl.id = 'kit-print'
        setIsPrintingEstudo(false)
      }
      window.addEventListener('afterprint', restoreIds, { once: true })
      doPrint()
    }))
  }

  // ── Imprimir (salva automaticamente antes, muda status p/ enviada) ──
  const handlePrint = async () => {
    if (session) {
      // silent:false → mostra "Erro ao salvar" se falhar; retorna null se erro
      const qid = await saveQuote({ silent: false, statusOverride: savedId ? undefined : 'enviada' })
      if (!qid) return   // erro visível na UI, não avança para impressão
    }
    doPrint()
    setShowPrintedScreen(true)
  }

  // ── Request discount (só disponível após a cotação já estar salva) ──
  const requestDiscount = async () => {
    if (!session || !discountMotivo.trim() || !savedId) return
    setDiscountStatus('sending')

    try {
      await supabase.from('quotes').update({
        status: 'aguardando_desconto',
        desconto_motivo: discountMotivo,
      }).eq('id', savedId)
    } catch (err) {
      console.error('[requestDiscount]', err)
      setDiscountStatus('error')
      return
    }

    // Notifica admin sobre solicitação de desconto e confirma envio ao cliente (silencioso)
    notifyDescontoSolicitado({ quoteId: savedId })
    setDiscountStatus('sent')
  }

  // Build structure composition rows: expand each selected kit into its components × kit qty
  const structureComposition = useMemo(() => {
    const kitsToExpand = [
      data.wantsEstrutura && data.estruturaKit  && (data.estruturaQty  || 0) > 0
        ? { kit: data.estruturaKit,  qty: data.estruturaQty  } : null,
      data.wantsEstrutura && data.estruturaKit3 && (data.estruturaQty3 || 0) > 0
        ? { kit: data.estruturaKit3, qty: data.estruturaQty3 } : null,
    ].filter(Boolean)

    if (!kitsToExpand.length) return []

    // Merge components across all selected kits, accumulating qty by SAP code
    const merged = {}
    kitsToExpand.forEach(({ kit, qty }) => {
      const comps = kitCompositions[kit.codigo] || []
      comps.forEach(c => {
        const totalQty = c.qty * qty
        if (merged[c.sap]) {
          merged[c.sap].qty += totalQty
        } else {
          merged[c.sap] = { sap: c.sap, descricao: c.descricao, qty: totalQty }
        }
      })
    })
    return Object.values(merged)
  }, [data.wantsEstrutura, data.estruturaKit, data.estruturaKit3, data.estruturaQty, data.estruturaQty3])

  // ── Tela pós-impressão ──
  if (showPrintedScreen) return (
    <div className="text-center py-12 print:hidden">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 size={40} className="text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Kit salvo!</h2>
      {data.numero_orcamento && (
        <p className="text-weg-blue font-bold text-lg mb-1 font-mono">
          {data.numero_orcamento}{(data.revisao || 0) > 0 ? ` · Rev. ${data.revisao}` : ' · Rev. 0'}
        </p>
      )}
      <p className="text-gray-500 text-sm mb-8">Cotação salva com sucesso.</p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={() => onGoToQuotes?.()}
          className="flex items-center gap-2 bg-weg-blue hover:bg-weg-blue-mid text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <FileText size={18} /> Ver minhas cotações
        </button>
        <button
          onClick={() => { setPendingPrint(true); setShowPrintedScreen(false) }}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <Printer size={18} /> Imprimir cotação
        </button>
        <button
          onClick={() => setShowPrintedScreen(false)}
          className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-6 py-3 rounded-xl hover:border-gray-300 transition-colors"
        >
          Continuar editando
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Resumo do Kit Solar</h2>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <p className="text-gray-500 text-sm">Orçamento gerado em {new Date().toLocaleDateString('pt-BR')}</p>
          {data.numero_orcamento && (
            <span className="text-xs font-bold text-weg-blue bg-weg-blue/10 px-2 py-0.5 rounded-full font-mono">
              {data.numero_orcamento}{(data.revisao || 0) > 0 ? ` · Rev. ${data.revisao}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Freight control — hidden on print */}
      <div className="print:hidden max-w-sm mx-auto">
        <div className={`bg-white rounded-xl border p-4 ${isNordeste ? 'border-amber-300' : 'border-gray-200'}`}>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
            Modalidade de Frete
          </label>
          {isNordeste && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                Módulo <strong>CD Nordeste</strong>: frete restrito a <strong>Nordeste</strong>, <strong>Norte</strong> ou <strong>FOB no CD</strong>.
              </span>
            </div>
          )}
          <select
            value={freteId}
            onChange={e => setFreteId(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-weg-blue"
          >
            {freteOpcoesVisiveis.map(f => (
              <option key={f.id} value={f.id}>
                {f.nome}{isAdmin && f.acrescimo !== 1 ? ` (+${((f.acrescimo-1)*100).toFixed(1)}%)` : ''}
              </option>
            ))}
          </select>
          {freteOpcao.acrescimo !== 1 && (
            <p className="text-xs text-gray-400 mt-1.5">
              Frete: {fmt(freteAmt)} ({((freteOpcao.acrescimo - 1) * 100).toFixed(1)}% sobre o total)
            </p>
          )}
          {freteOpcao.acrescimo === 1 && (
            <p className="text-xs text-green-600 mt-1.5">Sem custo de frete (retirada na fábrica)</p>
          )}
        </div>

      </div>

      {/* ── PDF do Estudo (só pra kits abertos a partir da página de Estudo) ── */}
      {isPrintingEstudo && data.estudoSnapshot?.resumo && (
        <div id="kit-print-estudo" className="fixed inset-0 bg-white z-[9999] overflow-auto">
          <EstudoPrintContent resumo={data.estudoSnapshot.resumo} tableInfo={tableInfo} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden max-w-3xl mx-auto print:shadow-none print:overflow-visible print:rounded-none print:border-0 print:max-w-none" id="kit-print">

        {/* ── Print header: logo + date ── */}
        <div className="print-header hidden print:flex items-center justify-between px-6 py-4" style={{backgroundColor:'#1B3A8A'}}>
          <img src="/logo-ernaniff-branco.png" alt="Ernaniff" style={{height:44, objectFit:'contain'}} />
          <div style={{textAlign:'right', color:'white'}}>
            <p style={{fontSize:10, opacity:0.7}}>Orçamento gerado em {new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})}</p>
            <p style={{fontSize:10, opacity:0.7}}>{tableInfo?.nome}</p>
          </div>
        </div>

        {/* ── Screen header ── */}
        <div className="bg-weg-blue text-white px-6 py-5 print:hidden">
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <img src="/logo-ernaniff-branco.png" alt="Ernaniff" style={{height:30, objectFit:'contain'}} className="mr-1" />
                <p className="text-white/60 text-xs uppercase tracking-wide">Ernaniff Representações</p>
                {data.numero_orcamento && (
                  <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                    {data.numero_orcamento}
                  </span>
                )}
                {(data.revisao || 0) > 0 && (
                  <span className="text-xs font-semibold bg-yellow-400/30 text-yellow-200 px-2 py-0.5 rounded-full">
                    Rev. {data.revisao}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold">
                {kitTypeInfo ? `${kitTypeInfo.icon} Kit ${kitTypeInfo.title}${data.tensaoRede ? ` — ${data.tensaoRede} V` : ''}` : 'Kit Solar Fotovoltaico'}
              </h3>
              {data.clienteNome && <p className="text-white/80 text-sm mt-1">Cliente: {data.clienteNome}</p>}
              {data.clienteLocal && <p className="text-white/60 text-xs">{data.clienteLocal}</p>}
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs">{tableInfo.nome}</p>
              <p className="text-white font-bold text-2xl">{realKwp.toFixed(2)} kWp</p>
              <p className="text-white/60 text-xs">{data.panelQty} painéis × {data.panel?.potencia} Wp</p>
            </div>
          </div>
        </div>

        {/* ── Print: kit info bar ── */}
        <div className="hidden print:block border-b border-gray-200 px-6 py-3" style={{background:'#f8f9fa'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <p style={{fontSize:15, fontWeight:800, color:'#1B3A8A', margin:0}}>
                {kitTypeInfo ? `Kit ${kitTypeInfo.title}${data.tensaoRede ? ` — ${data.tensaoRede} V` : ''}` : 'Kit Solar Fotovoltaico'}
              </p>
              {data.numero_orcamento && (
                <p style={{fontSize:10, color:'#1B3A8A', margin:'2px 0 0', fontWeight:700}}>
                  Ref: {data.numero_orcamento}{(data.revisao || 0) > 0 ? ` — Rev. ${data.revisao}` : ''}
                </p>
              )}
              {data.clienteNome && <p style={{fontSize:11, color:'#555', margin:'4px 0 0'}}>Cliente: <strong>{data.clienteNome}</strong>{data.clienteLocal ? ` — ${data.clienteLocal}` : ''}</p>}
              {prop.cnpjCpf && <p style={{fontSize:10, color:'#777', margin:'2px 0 0'}}>CPF/CNPJ: {prop.cnpjCpf}</p>}
              {prop.email && <p style={{fontSize:10, color:'#777', margin:'1px 0 0'}}>E-mail: {prop.email}</p>}
              {prop.telefone && <p style={{fontSize:10, color:'#777', margin:'1px 0 0'}}>Tel: {prop.telefone}</p>}
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontSize:22, fontWeight:900, color:'#1B3A8A', margin:0}}>{realKwp.toFixed(2)} kWp</p>
              <p style={{fontSize:10, color:'#888', margin:0}}>{data.panelQty} painéis × {data.panel?.potencia} Wp</p>
              {prop.responsavel && <p style={{fontSize:10, color:'#555', margin:'4px 0 0'}}>Resp: {prop.responsavel}</p>}
              {(profile?.numero_usuario || profile?.nome) && (
                <p style={{fontSize:10, color:'#555', margin:'2px 0 0'}}>
                  Usuário: <strong style={{fontFamily: profile?.numero_usuario ? 'monospace' : 'inherit'}}>
                    {profile?.numero_usuario ? `#${profile.numero_usuario}` : profile.nome}
                  </strong>
                </p>
              )}
              {profile?.cnpj && <p style={{fontSize:10, color:'#777', margin:'1px 0 0', fontFamily:'monospace'}}>CNPJ: {profile.cnpj}</p>}
              <p style={{fontSize:10, color:'#555', margin:'2px 0 0'}}>
                🚛 {freteOpcao.nome}
              </p>
              <p style={{fontSize:10, color:'#1B3A8A', margin:'2px 0 0', fontWeight:600}}>
                Validade: {prop.validade || 7} dias
              </p>
            </div>
          </div>
        </div>

        {/* Aviso de disponibilidade — todos os itens com problema */}
        {(() => {
          const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'}) : null
          const problemas = kitItems.filter(it => {
            const s = it.product?.estoque || 'Disponível'
            return s === 'Esgotado' || s === 'Sem estoque' || s === 'Previsão'
          })
          if (problemas.length === 0) return null
          const temEsg = problemas.some(it => { const s = it.product.estoque; return s === 'Esgotado' || s === 'Sem estoque' })
          return (
            <div className={`mx-6 my-3 rounded-xl border-2 px-4 py-3 flex items-start gap-2 ${
              temEsg ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
            }`}>
              <AlertTriangle size={15} className={`shrink-0 mt-1 ${temEsg ? 'text-red-500' : 'text-yellow-600'}`} />
              <div className="space-y-1">
                {problemas.map((it, i) => {
                  const s = it.product.estoque
                  const isEsg = s === 'Esgotado' || s === 'Sem estoque'
                  const prev = it.product.estoque_previsao
                  const prevFmt = fmtDate(prev)
                  return (
                    <p key={i} className={`text-xs font-semibold ${isEsg ? 'text-red-800' : 'text-yellow-800'}`}>
                      {isEsg ? '✕' : '⏱'} <strong>{it.label}</strong>
                      {isEsg ? ' — Esgotado' : prevFmt ? ` — Previsão de entrega: ${prevFmt}` : ' — Previsão de entrega (data a confirmar)'}
                    </p>
                  )
                })}
                <p className={`text-[10px] ${temEsg ? 'text-red-600' : 'text-yellow-700'}`}>
                  Confirme a disponibilidade com o fornecedor antes de emitir o pedido.
                </p>
              </div>
            </div>
          )
        })()}

        {/* Items table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-14"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto / Código SAP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unit.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 print:hidden w-4" />
              </tr>
            </thead>
            <tbody>
              {kitItems.map((item, idx) => {
                const itemEstoque = item.product?.estoque || 'Disponível'
                const itemIsEsg   = itemEstoque === 'Esgotado' || itemEstoque === 'Sem estoque'
                const itemIsPrev  = itemEstoque === 'Previsão'
                const itemPrev    = itemIsPrev ? item.product?.estoque_previsao : null
                const itemPrevFmt = itemPrev ? new Date(itemPrev + 'T12:00:00').toLocaleDateString('pt-BR') : null
                return (
                <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${
                  item.avulso ? 'bg-amber-50/40' : itemIsEsg ? 'bg-red-50/30' : itemIsPrev ? 'bg-yellow-50/20' : ''
                }`}>
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <ItemThumb product={item.product} alt={item.label} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      {item.avulso && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium print:hidden">avulso</span>}
                      {itemIsEsg && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full leading-none">Esgotado</span>
                      )}
                      {itemIsPrev && (
                        <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full leading-none">
                          {itemPrevFmt ? `Prev. ${itemPrevFmt}` : 'Previsão'}
                        </span>
                      )}
                    </div>
                    {!item.avulso && <p className="text-xs text-gray-500">{item.product.nome}</p>}
                    <p className="text-xs font-mono text-gray-400">{item.product.codigo !== '—' ? `SAP: ${item.product.codigo}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-weg-gray rounded-lg px-2 py-1 text-sm font-bold text-weg-blue">
                      {item.qty} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 whitespace-nowrap">
                    {item.product.preco ? fmt(item.product.preco * priceRatio) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 whitespace-nowrap">
                    {item.product.preco ? fmt(moneyMul(item.product.preco, item.qty) * priceRatio) : '—'}
                  </td>
                  <td className="px-4 py-3 print:hidden">
                    {item.avulso && (
                      <div className="flex gap-1">
                        <button onClick={() => editAvulso(avulsos.find(a => a.id === item.avulsoId))}
                          className="text-xs text-weg-blue hover:underline">✏️</button>
                        <button onClick={() => removeAvulso(item.avulsoId)}
                          className="text-xs text-red-400 hover:underline ml-1">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
              })}
            </tbody>
            <tfoot>
              {/* Subtotal e Ajuste — só pra revisão interna do admin na tela;
                  print:hidden garante que nunca saem no PDF/impressão, mesmo
                  quando é o próprio admin quem gera o documento pro cliente. */}
              {isAdmin && (
                <tr className="print:hidden border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan="5" className="px-4 py-2.5 text-right text-sm font-semibold text-gray-500">
                    Subtotal (preço de tabela)
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">
                    {fmt(subtotal)}
                  </td>
                </tr>
              )}
              {isAdmin && (
                <tr className="print:hidden bg-green-50">
                  <td colSpan="5" className="px-4 py-2 text-right text-sm font-semibold text-green-700">
                    Ajuste
                    <span className="font-normal text-green-600 ml-1">
                      (×{F1} × {F2} × {F3} × {F4}{desconto > 0 ? ` × ${fatorDesc.toFixed(4)}` : ''})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-bold text-green-700">
                    − {fmt(ajusteAmt)}
                  </td>
                </tr>
              )}
              {/* Freight row — valor só admin */}
              {isAdmin && freteOpcao.acrescimo !== 1 && (
                <tr className="bg-gray-50 border-t border-gray-100">
                  <td colSpan="5" className="px-4 py-2 text-right text-sm font-semibold text-gray-600">
                    🚛 {freteOpcao.nome}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-bold text-gray-700">
                    + {fmt(freteAmt)}
                  </td>
                </tr>
              )}
              {/* Grand total */}
              <tr className="bg-weg-blue text-white">
                <td colSpan="5" className="px-4 py-4 text-right font-bold uppercase tracking-wide">
                  Total do Kit
                </td>
                <td className="px-4 py-4 text-right text-xl font-extrabold whitespace-nowrap">
                  {fmt(totalFinal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Adicionar item avulso ── */}
        <div className="print:hidden border-t border-dashed border-gray-200">
          {/* trigger */}
          {!showAvulsoPanel && (
            <div className="px-4 py-3">
              <button
                onClick={() => setShowAvulsoPanel(true)}
                className="flex items-center gap-2 text-sm font-semibold text-weg-blue hover:opacity-80 transition-opacity"
              >
                <Plus size={15} className="bg-weg-blue text-white rounded-full p-0.5" />
                Adicionar item avulso
              </button>
            </div>
          )}

          {showAvulsoPanel && (
            <div className="border-t border-amber-200 bg-amber-50/60">
              {/* panel header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  {editingId ? 'Editar item' : 'Adicionar item avulso'}
                </p>
                <button onClick={closePanel} className="text-gray-400 hover:text-gray-600"><Plus size={14} className="rotate-45" /></button>
              </div>

              {/* ── Catálogo ── */}
              <div className="p-3 space-y-2">
                  {/* filters */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        type="text"
                        value={avulsoSearch}
                        onChange={e => setAvulsoSearch(e.target.value)}
                        placeholder="Buscar por nome, SAP ou modelo..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-weg-blue"
                      />
                    </div>
                    <select
                      value={avulsoCat}
                      onChange={e => setAvulsoCat(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-weg-blue"
                    >
                      <option value="">Todas categorias</option>
                      {catalogCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* results list */}
                  {avulsoResults.length > 0 ? (
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                      {avulsoResults.map(p => {
                        const sel = pickedProduct?.id === p.id
                        return (
                          <button
                            key={p.id}
                            onClick={() => { setPickedProduct(p); setPickedUnit('un') }}
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${sel ? 'bg-weg-blue/10' : 'hover:bg-gray-50'}`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${sel ? 'text-weg-blue' : 'text-gray-800'}`}>{p.nome}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.codigo} · {p.categoria}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-weg-orange">{p.preco ? fmt(p.preco) : 'S/C'}</p>
                              {sel && <Check size={14} className="text-weg-blue ml-auto" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (avulsoSearch || avulsoCat) ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado</p>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">Digite para buscar produtos do catálogo</p>
                  )}

                  {/* qty + add row */}
                  {pickedProduct && (
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                      <p className="text-xs text-gray-600 flex-1 truncate"><strong>{pickedProduct.nome}</strong></p>
                      <input
                        type="number" min="1" value={pickedQty}
                        onChange={e => setPickedQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:border-weg-blue"
                      />
                      <select
                        value={pickedUnit}
                        onChange={e => setPickedUnit(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                      >
                        {['un','kit','m','pares','cx','vb'].map(u => <option key={u}>{u}</option>)}
                      </select>
                      <button onClick={addFromCatalog} className="px-3 py-1.5 text-sm font-semibold bg-weg-blue text-white rounded-lg whitespace-nowrap">
                        + Adicionar
                      </button>
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>

        {/* Structure composition section */}
        {structureComposition.length > 0 && (
          <div className="border-t-2 border-dashed border-gray-200 print-new-page">
            {/* Section header */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                Composição da Estrutura de Fixação
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.estruturaKit && <span className="mr-3">Kit 4 mod: {data.estruturaKit.nome}</span>}
                {data.estruturaKit3 && <span>Kit 3 mod: {data.estruturaKit3.nome}</span>}
              </p>
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase w-8">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Componente</th>
                  <th className="px-4 py-2 text-left text-xs font-mono font-semibold text-gray-400 uppercase">SAP</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {structureComposition.map((comp, idx) => (
                  <tr key={comp.sap} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-gray-800">{comp.descricao}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{comp.sap}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="bg-blue-50 text-weg-blue rounded-lg px-3 py-1 text-sm font-bold">
                        {comp.qty} un
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observações da proposta (screen + print) */}
        {prop.obs && (
          <div className="px-5 py-3 border-t border-dashed border-gray-200 bg-blue-50/40">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Observações</p>
            <p className="text-xs text-gray-600 whitespace-pre-line">{prop.obs}</p>
          </div>
        )}

        {/* Rodapé informativo — conteúdo editável pelo admin */}
        <div className="mx-5 mt-4 mb-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 space-y-1">
          <p className="text-[11px] text-gray-600 font-medium">📋 Condições Comerciais</p>
          <p className="text-[10px] text-gray-500 whitespace-pre-line">{condicoes}</p>
          {isAdmin && (
            <p className="print:hidden text-[10px] text-gray-400">
              Fator de precificação: {F1} × {F2} × {F3} × {F4}{desconto > 0 ? ` × (1 − ${desconto}%)` : ''}.
            </p>
          )}
          {data.criadoPorAdmin && (
            <p className="text-[10px] text-gray-500 pt-1 border-t border-gray-200 mt-1">
              Proposta elaborada por {data.criadoPorAdminNome || 'equipe Ernaniff'}, Ernaniff Representações.
            </p>
          )}
        </div>

        {/* Print-only blue footer bar */}
        <div className="hidden print:flex items-center justify-between px-6 py-2 border-t border-gray-300" style={{background:'#1B3A8A'}}>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.7)'}}>{tableInfo?.nome} — Validade: {prop.validade || 7} dias</span>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.7)'}}>94 9209-0380 · vendas@ernaniff.com.br</span>
        </div>
      </div>

      {/* ── Personalização da Proposta ── */}
      <div className="print:hidden max-w-3xl mx-auto">
        <button
          onClick={() => setShowPersonal(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-weg-blue hover:text-weg-blue transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={16} /> Personalizar proposta
          </span>
          <ChevronDown size={16} className={`transition-transform ${showPersonal ? 'rotate-180' : ''}`} />
        </button>

        {showPersonal && (
          <div className="mt-2 bg-white rounded-xl border border-weg-blue/30 p-5 space-y-4">
            {isAdmin && !savedId && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Esta cotação é para qual cliente?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClienteMode('cadastrado')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                      clienteMode === 'cadastrado' ? 'border-weg-blue bg-white text-weg-blue' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Cliente já cadastrado
                  </button>
                  <button
                    onClick={() => { setClienteMode('novo'); setSelectedCliente(null); onChange({ ...data, targetClientId: null }) }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                      clienteMode === 'novo' ? 'border-weg-blue bg-white text-weg-blue' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Cliente novo (sem cadastro)
                  </button>
                </div>

                {clienteMode === 'cadastrado' && (
                  selectedCliente ? (
                    <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {selectedCliente.nome}{selectedCliente.empresa ? ` — ${selectedCliente.empresa}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{selectedCliente.cnpj || selectedCliente.telefone || selectedCliente.email || '—'}</p>
                      </div>
                      <button onClick={() => { setSelectedCliente(null); onChange({ ...data, targetClientId: null }) }} className="shrink-0 text-xs text-red-500 hover:underline ml-2">
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={clienteSearch}
                        onChange={e => searchClientes(e.target.value)}
                        placeholder="Buscar por nome, empresa, CNPJ ou telefone…"
                        className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue bg-white"
                      />
                      {clienteSearching && <p className="text-xs text-gray-400">Buscando…</p>}
                      {clienteResults.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                          {clienteResults.map(c => (
                            <button key={c.id} onClick={() => pickCliente(c)} className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</p>
                              <p className="text-xs text-gray-400 truncate">{c.cnpj || c.telefone || c.email || '—'}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {!clienteSearching && clienteSearch.trim().length >= 2 && clienteResults.length === 0 && (
                        <p className="text-xs text-gray-400">Nenhum cliente encontrado.</p>
                      )}
                    </div>
                  )
                )}

                {clienteMode === 'novo' && (
                  <p className="text-xs text-amber-700">
                    A cotação fica salva na sua conta (admin), identificada com o nome do cliente abaixo. Se ele se cadastrar depois, dá pra associar a conta real em "Minhas Cotações".
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Dados do Cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome do cliente</label>
                <input
                  type="text" value={data.clienteNome || ''}
                  onChange={e => onChange({ ...data, clienteNome: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Localidade</label>
                <input
                  type="text"
                  value={data.clienteLocal || ''}
                  onChange={e => onChange({ ...data, clienteLocal: e.target.value })}
                  placeholder={data.clienteUF ? `${data.clienteCidade || ''}${data.clienteCidade && data.clienteUF ? ' / ' : ''}${data.clienteUF || ''}` : 'Ex: Florianópolis / SC'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
                {data.clienteUF && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Selecionado: {[data.clienteCidade, data.clienteUF].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail do cliente</label>
                <input
                  type="email" value={prop.email || ''}
                  onChange={e => setProp({ email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone do cliente</label>
                <input
                  type="text" value={prop.telefone || ''}
                  onChange={e => setProp({ telefone: e.target.value })}
                  placeholder="(48) 99999-9999"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CPF / CNPJ</label>
                <input
                  type="text" value={prop.cnpjCpf || ''}
                  onChange={e => setProp({ cnpjCpf: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Responsável técnico</label>
                <input
                  type="text" value={prop.responsavel || ''}
                  onChange={e => setProp({ responsavel: e.target.value })}
                  placeholder="Nome do responsável"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Validade da proposta (dias)</label>
              <input
                type="number" min="1" max="90" value={prop.validade || 7}
                onChange={e => setProp({ validade: parseInt(e.target.value) || 7 })}
                className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações / Condições comerciais</label>
              <textarea
                rows={3} value={prop.obs || ''}
                onChange={e => setProp({ obs: e.target.value })}
                placeholder="Ex: Prazo de entrega: 15 dias úteis. Instalação não inclusa. Garantia conforme fabricante."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-weg-blue"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Histórico de revisões ── */}
      {data.revisoes && data.revisoes.length > 0 && (
        <RevisionHistory revisoes={data.revisoes} numeroOrcamento={data.numero_orcamento} />
      )}

      {/* ── Aviso: escopo alterado, desconto será cancelado ao salvar ── */}
      {!isAdmin && discountWillBeReset && (
        <div className="max-w-3xl mx-auto bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 print:hidden flex items-start gap-2 text-sm text-orange-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            O escopo do kit foi alterado. Ao salvar, o pedido de desconto atual será{' '}
            <strong>cancelado</strong> e uma nova solicitação poderá ser feita sobre o escopo atualizado.
          </span>
        </div>
      )}

      {/* ── Resposta do admin ao desconto ── */}
      {!isAdmin && quoteInfo?.desconto_resposta && !discountWillBeReset && (
        <div className={`max-w-3xl mx-auto rounded-xl border px-5 py-4 print:hidden ${
          quoteInfo.status === 'aprovada'
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <p className={`text-sm font-bold mb-1 flex items-center gap-2 ${
            quoteInfo.status === 'aprovada' ? 'text-green-700' : 'text-gray-600'
          }`}>
            {quoteInfo.status === 'aprovada'
              ? <><CheckCircle2 size={16} /> Desconto aprovado</>
              : <><XCircle size={16} /> Resposta do administrador</>}
          </p>
          <p className="text-sm text-gray-700">{quoteInfo.desconto_resposta}</p>
          {quoteInfo.desconto_pct > 0 && (
            <p className="text-sm text-green-700 font-semibold mt-1">
              Desconto concedido: {quoteInfo.desconto_pct}%
            </p>
          )}
        </div>
      )}

      {/* ── Aguardando resposta ── */}
      {!isAdmin && quoteInfo?.status === 'aguardando_desconto' && !discountWillBeReset && (
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 print:hidden flex items-center gap-2 text-sm text-yellow-800">
          <Clock size={16} className="shrink-0" />
          <span>Solicitação de desconto enviada — aguardando resposta do administrador.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center print:hidden">
        {session && (
          <button
            onClick={async () => {
              const qid = await saveQuote()
              if (qid) setShowPrintedScreen(true)
            }}
            disabled={saveStatus === 'saving'}
            className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-70"
          >
            {saveStatus === 'saving'
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando…</>
              : <><Save size={16} /> {savedId ? 'Atualizar cotação' : 'Salvar cotação'}</>}
          </button>
        )}

        {isAdmin && data.origemEstudo && data.estudoSnapshot?.resumo && (
          <button
            onClick={handlePrintEstudo}
            className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-violet-300 text-violet-700 font-semibold hover:bg-violet-50 transition-colors"
          >
            <Printer size={16} /> PDF do Estudo
          </button>
        )}

        {session && !isAdmin && savedId && (
          <button
            onClick={() => setShowDiscountModal(true)}
            disabled={quoteInfo?.status === 'aguardando_desconto'}
            className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-amber-500 text-amber-600 font-semibold hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BadgePercent size={16} /> Solicitar desconto
          </button>
        )}
      </div>

      {saveStatus === 'error' && (
        <div className="mt-2 print:hidden bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center max-w-xl mx-auto">
          <p className="text-sm text-red-600 font-semibold">Erro ao salvar cotação</p>
          {saveError && <p className="text-xs text-red-500 mt-1 font-mono break-all">{saveError}</p>}
        </div>
      )}

      {/* Discount Request Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <BadgePercent size={20} className="text-amber-500" /> Solicitar Desconto
              </h3>
              <button onClick={() => { setShowDiscountModal(false); setDiscountStatus(null); setDiscountMotivo('') }}
                className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {discountStatus === 'sent' ? (
              <div className="text-center py-6">
                <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 mb-2">Solicitação enviada!</h4>
                <p className="text-gray-500 text-sm mb-4">
                  Sua solicitação de desconto foi registrada. O administrador irá analisar e responder em breve.
                </p>
                <button
                  onClick={() => { setShowDiscountModal(false); setDiscountStatus(null); setDiscountMotivo('') }}
                  className="btn-primary px-6 py-2.5"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
                  <p><strong>Valor total atual:</strong> {fmt(totalFinal)}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo / justificativa para o desconto *
                  </label>
                  <textarea
                    rows={4}
                    value={discountMotivo}
                    onChange={e => setDiscountMotivo(e.target.value)}
                    placeholder="Descreva o motivo da solicitação de desconto (ex: volume de compra, projeto específico, concorrência)..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>
                {discountStatus === 'error' && (
                  <p className="text-red-500 text-sm mb-3">Erro ao enviar. Tente novamente.</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={requestDiscount}
                    disabled={discountStatus === 'sending' || !discountMotivo.trim()}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {discountStatus === 'sending'
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <BadgePercent size={16} />}
                    Enviar solicitação
                  </button>
                  <button
                    onClick={() => { setShowDiscountModal(false); setDiscountStatus(null); setDiscountMotivo('') }}
                    className="btn-outline px-5 py-2.5"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main KitBuilder ─────────────────────────────────────────────────────────
export default function KitBuilder({ initialData, initialSavedId, onGoToQuotes, onBackToEstudo } = {}) {
  const { catalogProducts: products, tableInfo } = useProducts()
  const { isAdmin: isAdminTop } = useAuth()
  // Se carregado a partir de uma cotação salva, começa no step resumo; se
  // veio da página de Estudo (dimensionamento de bateria — só admin) e quem
  // está vendo agora também é admin, começa direto em Acessórios (os passos
  // anteriores já vêm pré-preenchidos). Um cliente reabrindo esse mesmo kit
  // não tem acesso à página de Estudo, então sempre cai no Resumo normal.
  const initIsHybrid = initialData ? isHybridInv(initialData.inverter || initialData.inverters?.[0]?.inverter) : false
  const initStep = initialData
    ? (initialData.origemEstudo && isAdminTop ? (initIsHybrid ? 6 : 5) : (initIsHybrid ? 7 : 6))
    : 1
  const [step, setStep] = useState(initStep)
  const [data, setData] = useState(initialData || { mode: 'potencia', hsp: SUN_HOURS })

  const hsp = data.hsp || SUN_HOURS
  const targetKwp = data.mode === 'consumo'
    ? data.consumoDiario > 0 ? (data.consumoDiario / hsp) * 1.2 : 0
    : (data.kwpDesejado || 0)

  const realKwp = data.panel
    ? ((data.panelQty || 1) * data.panel.potencia / 1000)
    : targetKwp

  const selectedInv  = data.inverter || data.inverters?.[0]?.inverter
  const isHybrid     = isHybridInv(selectedInv)
  const STEPS        = isHybrid ? STEPS_HYBRID : STEPS_BASE
  const maxStep      = STEPS.length

  // Clamp step when switching from hybrid to non-hybrid
  useEffect(() => {
    if (!isHybrid && step > 6) setStep(6)
  }, [isHybrid])

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!data.kitType) return false
      if (data.kitType === 'ongrid_tri' && !data.tensaoRede) return false
      return true
    }
    if (step === 2) {
      if (data.kitType === 'bombeamento') return !!data.bombDimDone
      return (data.kwpDesejado || 0) > 0
    }
    if (step === 3) return !!data.panel
    if (step === 4) return !!data.inverter || (Array.isArray(data.inverters) && data.inverters.length > 0)
    if (step === 5 && isHybrid) return !!data.batteryDone
    if (step === 5 || step === 6) return true
    return false
  }, [step, targetKwp, data, isHybrid])

  const reset = () => {
    setData({ mode: 'potencia', hsp: SUN_HOURS })
    setStep(1)
  }

  const kitTypeInfo = KIT_TYPES.find(k => k.key === data.kitType)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">⚡ Monte seu Kit Solar</h1>
          <p className="text-gray-400 text-sm flex items-center gap-2 flex-wrap">
            Siga os passos para gerar seu orçamento completo
            {kitTypeInfo && step > 1 && (
              <span className="inline-flex items-center gap-1 bg-weg-blue/10 text-weg-blue text-xs font-semibold px-2 py-0.5 rounded-full">
                {kitTypeInfo.icon} {kitTypeInfo.title}{data.tensaoRede ? ` ${data.tensaoRede}V` : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={14} /> Recomeçar
        </button>
      </div>

      {/* Steps */}
      <StepIndicator current={step} onNavigate={setStep} steps={STEPS} />

      {/* Step content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        {step === 1 && <StepKitType data={data} onChange={setData} />}
        {step === 2 && data.kitType === 'bombeamento' && <BombDimStep data={data} onChange={setData} products={products} />}
        {step === 2 && data.kitType !== 'bombeamento' && <Step1 data={data} onChange={setData} />}
        {step === 3 && <Step2 data={data} onChange={setData} products={products} targetKwp={targetKwp} />}
        {step === 4 && <Step3 data={data} onChange={setData} products={products} realKwp={realKwp} />}
        {step === 5 && isHybrid && <BatteryStep data={data} onChange={setData} products={products} />}
        {step === (isHybrid ? 6 : 5) && <Step4 data={data} onChange={setData} products={products} />}
        {step === (isHybrid ? 7 : 6) && <Step5 data={data} onChange={setData} products={products} tableInfo={tableInfo} realKwp={realKwp} initialSavedId={initialSavedId} onGoToQuotes={onGoToQuotes} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (step === 1 && data.origemEstudo && isAdminTop) { onBackToEstudo?.(data.estudoSnapshot?.raw); return }
            setStep(s => s - 1)
          }}
          disabled={step === 1 && !(data.origemEstudo && isAdminTop)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={18} /> {step === 1 && data.origemEstudo && isAdminTop ? 'Voltar ao Estudo' : 'Voltar'}
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {STEPS.map(s => (
            <div key={s.id} className={`rounded-full transition-all ${
              s.id === step ? 'w-6 h-2.5 bg-weg-blue' : s.id < step ? 'w-2.5 h-2.5 bg-green-400' : 'w-2.5 h-2.5 bg-gray-200'
            }`} />
          ))}
        </div>

        {step < maxStep ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-weg-blue text-white font-semibold hover:bg-weg-blue-mid disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Próximo <ChevronRight size={18} />
          </button>
        ) : (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-weg-orange text-white font-semibold hover:bg-weg-orange-dark transition-all"
          >
            <RefreshCw size={16} /> Novo kit
          </button>
        )}
      </div>
    </div>
  )
}
