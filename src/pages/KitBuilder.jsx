import { useState, useMemo, useEffect } from 'react'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { notifyDescontoSolicitado } from '../lib/notify'
import { KIT_ROLE, CATEGORIES } from '../data/products'
import { getProductImage, KIT_TYPE_IMG } from '../data/productImages'
import kitCompositions from '../data/kitCompositions.json'
import {
  Sun, Zap, Link2, Shield, Cable, ToggleLeft, ChevronRight, ChevronLeft,
  Printer, Plus, Minus, Check, Info, AlertTriangle, Calculator, RefreshCw,
  Package, User, FileText, Home, ChevronDown, Search, Save, BadgePercent,
  CheckCircle2, XCircle, Clock, X
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

const STEPS = [
  { id: 1, label: 'Tipo de Kit',     icon: Home },
  { id: 2, label: 'Dimensionamento', icon: Calculator },
  { id: 3, label: 'Módulos',         icon: Sun },
  { id: 4, label: 'Inversor',        icon: Zap },
  { id: 5, label: 'Acessórios',      icon: Shield },
  { id: 6, label: 'Resumo',          icon: FileText },
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
  KIT_CONN_MI: '18460783',  // Kit conector CA SIW100G W10
  CABO_CA_3F:  '18512552',  // Cabo CA MP Flex HEPR/NH 3X6mm² 90°C PT 1kV
}

const SUN_HOURS = 4.5 // HSP médio Brasil

// Map inverter disjuntor model → breaker product model
const BREAKER_MAP = {
  'MDWP-C16-2': 'MDWP-C16-2',
  'MDWP-C20-2': 'MDWP-C20-2',
  'MDWP-C25-2': 'MDWP-C25-2',
  'MDWP-C32-2': 'MDWP-C32-2',
  'MDWP-C40-2': 'MDWP-C40-2',
  'MDWP-C50-2': 'MDWP-C50-2',
  'MDWH-C80-2': 'MDWH-C80-2',
  'MDWP-C32-3': 'MDWP-C32-3',
  'MDWP-C40-3': 'MDWP-C40-3',
  'MDWP-C50-3': null,
  'MDWP-C63-3': 'MDWP-C63-3',
  'MDWH-C80-3': null,
  'MDWH-C100-3': 'MDWH-C100-3',
  'MDWH-C125-3': null,
}

// Round to 2 decimal places — matches Excel ROUND(x, 2) behaviour
function round2(v) { return Math.round(v * 100) / 100 }

function fmt(v) {
  if (!v && v !== 0) return 'Sob consulta'
  return round2(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtInt(v) {
  if (!v && v !== 0) return 'Sob consulta'
  return Math.round(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const Icon = step.icon
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex flex-col items-center gap-1 min-w-[64px]`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                done ? 'bg-green-500 text-white' :
                active ? 'bg-weg-blue text-white ring-4 ring-blue-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight ${
                active ? 'text-weg-blue' : done ? 'text-green-600' : 'text-gray-400'
              }`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
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

// ─── Step 2: Dimensionamento (somente kWp) ───────────────────────────────────
function Step1({ data, onChange }) {
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
            <input
              value={data.clienteLocal || ''}
              onChange={e => onChange({ ...data, clienteLocal: e.target.value })}
              placeholder="Cidade / Estado"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            />
          </div>
        </div>
      </div>
    </div>
  )
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

  const panels = products.filter(p => p.kitRole === KIT_ROLE.PANEL && p.preco)

  const nordesteFreteId = freteOpcoes.find(f => /nordeste/i.test(f.nome))?.id

  const confirmSelectPanel = (panel, qty, freteAutoId) => {
    onChange({ ...data, panel, panelQty: qty, freteAutoId })
    setNordesteWarning(null)
  }

  const selectPanel = (panel) => {
    const qty = Math.ceil((targetKwp * 1000) / panel.potencia)
    const wasNordeste = isNordestePanel(data.panel)
    const willBeNordeste = isNordestePanel(panel)

    // Switching FROM nordeste TO non-nordeste → ask for confirmation
    if (wasNordeste && !willBeNordeste) {
      setNordesteWarning({ panel, qty })
      return
    }

    const freteAutoId = willBeNordeste ? nordesteFreteId : undefined
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

      {/* Aviso de frete auto-selecionado quando painel Nordeste */}
      {isNordestePanel(data.panel) && (
        <div className="max-w-3xl mx-auto bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-orange-800">
          <AlertTriangle size={15} className="shrink-0 text-orange-500" />
          <span>Painel <strong>CD Nordeste</strong> selecionado — o frete <strong>Nordeste</strong> foi pré-selecionado automaticamente no resumo.</span>
        </div>
      )}

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
        {panels.map(panel => {
          const qty = Math.ceil((targetKwp * 1000) / panel.potencia)
          const realKwp = (qty * panel.potencia / 1000).toFixed(2)
          const selected = data.panel?.id === panel.id

          return (
            <button
              key={panel.id}
              onClick={() => selectPanel(panel)}
              className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
                selected ? 'border-weg-blue bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-weg-blue/50 hover:shadow-md'
              }`}
            >
              {/* Panel image */}
              <div className="relative h-32 bg-gradient-to-br from-amber-50 to-amber-100 overflow-hidden flex items-center justify-center">
                <ProductImg
                  src={getProductImage(panel)}
                  alt={panel.nome}
                  fallback="☀️"
                  className="w-full h-full object-contain p-3 transition-transform duration-500 hover:scale-105"
                />
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
                  <span className="font-bold text-weg-orange">{fmt(panel.preco * qty)}</span>
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

  const [showAll, setShowAll] = useState(false)
  const usePowerFilter = data.kitType === 'ongrid_mono' || data.kitType === 'ongrid_tri'
  const suggested = usePowerFilter
    ? allInverters.filter(p => p.potencia >= realKwp * 0.8 && p.potencia <= realKwp * 1.5)
    : allInverters
  const displayList = showAll ? allInverters : (suggested.length > 0 ? suggested : allInverters)

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
      </div>

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

      {usePowerFilter && suggested.length === 0 && !showAll && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-start gap-2 max-w-xl mx-auto">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Nenhum inversor na faixa ideal. Mostrando todos os {kitTypeInfo?.catLabel}.
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
          {mixList.length > 0 && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
              combinedKw >= realKwp * 0.85 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {combinedKw >= realKwp * 0.85 ? '✓ OK' : `falta ${(realKwp - combinedKw).toFixed(1)} kW`}
            </span>
          )}
        </div>
      )}

      {/* Inverter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayList.map(inv => {
          const badge = catBadge(inv)
          const ratio = inv.potencia / realKwp

          // ── SINGLE MODE ──
          if (!mixMode) {
            const selected = data.inverter?.id === inv.id
            return (
              <button
                key={inv.id}
                onClick={() => onChange({ ...data, inverter: inv })}
                className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
                  selected ? 'border-weg-blue bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-weg-blue/50 hover:shadow-md'
                }`}
              >
                <div className="relative h-28 bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden flex items-center justify-center">
                  <ProductImg src={getProductImage(inv)} alt={inv.nome} fallback="⚡"
                    className="w-full h-full object-contain p-2 transition-transform duration-500 hover:scale-105" />
                  <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-weg-blue flex items-center justify-center shadow-md">
                      <Check size={13} className="text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white/70 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{inv.nome}</h3>
                  <div className="space-y-1 text-sm mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Potência:</span>
                      <span className="font-bold text-weg-blue">{inv.potencia} kW</span>
                    </div>
                    {inv.tensao && <div className="flex justify-between"><span className="text-gray-500">Tensão CA:</span><span className="font-semibold">{inv.tensao} {inv.fase}</span></div>}
                    {inv.entradas && <div className="flex justify-between"><span className="text-gray-500">Entradas MPPT:</span><span className="font-semibold">{inv.entradas}</span></div>}
                    {inv.disjuntor && <div className="flex justify-between"><span className="text-gray-500">Disjuntor req.:</span><span className="font-mono text-xs font-semibold">{inv.disjuntor}</span></div>}
                    <div className="border-t border-gray-100 pt-2 flex justify-between">
                      <span className="text-gray-500">Preço:</span>
                      <span className="font-bold text-gray-900">{fmt(inv.preco)}</span>
                    </div>
                  </div>
                  <div className={`mt-3 text-[11px] font-medium px-2 py-1 rounded-full text-center ${
                    ratio >= 0.9 && ratio <= 1.2 ? 'bg-green-100 text-green-700' :
                    ratio >= 0.7 && ratio <= 1.5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {ratio >= 0.9 && ratio <= 1.2 ? '✓ Dimensionamento ideal' :
                     ratio >= 0.7 && ratio <= 1.5 ? '~ Dimensionamento aceitável' :
                     '⚠ Fora da faixa recomendada'}
                  </div>
                </div>
              </button>
            )
          }

          // ── MIX MODE ──
          const entry = getMixEntry(inv.id)
          const qty = entry?.qty || 0
          const inMix = qty > 0
          return (
            <div
              key={inv.id}
              className={`rounded-xl border-2 overflow-hidden transition-all ${
                inMix ? 'border-weg-blue bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="relative h-28 bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden flex items-center justify-center">
                <ProductImg src={getProductImage(inv)} alt={inv.nome} fallback="⚡"
                  className="w-full h-full object-contain p-2" />
                <div className="absolute top-2 left-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${badge.cls}`}>{badge.label}</span>
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
                    <span>Potência:</span>
                    <span className="font-bold text-weg-blue">{inv.potencia} kW</span>
                  </div>
                  {inv.entradas && <div className="flex justify-between"><span>Entradas MPPT:</span><span className="font-semibold text-gray-700">{inv.entradas}</span></div>}
                  <div className="flex justify-between">
                    <span>Preço unit.:</span>
                    <span className="font-bold text-gray-900">{fmt(inv.preco)}</span>
                  </div>
                </div>
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
                    {(qty * inv.potencia).toFixed(1)} kW — {fmt(inv.preco * qty)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {usePowerFilter && !showAll && suggested.length > 0 && (
        <div className="text-center">
          <button onClick={() => setShowAll(true)} className="text-sm text-weg-blue hover:underline">
            Ver todos os {kitTypeInfo?.catLabel} ({allInverters.length} modelos)
          </button>
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
  }
  const c = colors[color] || colors.blue
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${included ? c.border : 'border-gray-200 bg-white opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${included ? c.icon + ' text-white' : 'bg-gray-100 text-gray-400'}`}>
            <Icon size={18} />
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
          {product?.preco && <span className="ml-auto text-sm font-bold text-weg-orange">{fmt(product.preco * qty)}</span>}
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
        <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 ${isRed ? 'bg-red-500' : 'bg-gray-800'}`}>
          <Cable size={15} />
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
          <span className={`ml-auto text-sm font-bold ${isRed ? 'text-red-600' : 'text-gray-700'}`}>{fmt(product.preco * meters)}</span>
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
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${included ? 'bg-weg-blue text-white' : 'bg-gray-100 text-gray-400'}`}>
          <ToggleLeft size={18} />
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
          {current?.preco && <span className="ml-auto text-sm font-bold text-weg-orange">{fmt(current.preco * qty)}</span>}
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
  const panelCount = data.panelQty || 1
  // In mix mode, first inverter is used for breaker detection; entradas is the sum
  const inv      = data.inverter || data.inverters?.[0]?.inverter
  const entradas = Array.isArray(data.inverters)
    ? Math.max(2, data.inverters.reduce((s, i) => s + (i.inverter?.entradas || 2) * i.qty, 0))
    : (inv?.entradas || 2)

  // Microinversores: quantidade de inversores = ceil(potência total / potência do micro)
  const microCount = (isMicro && inv && data.panel)
    ? Math.max(1, Math.ceil((panelCount * data.panel.potencia) / (inv.potencia * 1000)))
    : 1

  const set  = (k, v) => onChange({ ...data, [k]: v })
  const bySAP = sap => products.find(p => p.codigo === sap)
  const byRole = role => products.find(p => p.kitRole === role)

  // ── Produtos comuns ──────────────────────────────────────────────────────
  const mc4P        = bySAP(KIT_SAPS.MC4_6MM)     || byRole(KIT_ROLE.MC4)
  const cablePosP   = bySAP(KIT_SAPS.CABO_CC_VML) || byRole(KIT_ROLE.CABLE_POS)
  const cableNegP   = bySAP(KIT_SAPS.CABO_CC_PTO) || byRole(KIT_ROLE.CABLE_NEG)

  // ── Produtos On-Grid string ──────────────────────────────────────────────
  const surgeCAP    = bySAP(KIT_SAPS.SURGE_CA)    || byRole(KIT_ROLE.SURGE_AC)
  const surgeDCP    = byRole(KIT_ROLE.SURGE_DC)
  const invDis      = inv?.disjuntor
  const breakerP    = (invDis && BREAKER_MAP[invDis])
    ? products.find(p => p.modelo === BREAKER_MAP[invDis] || p.nome?.includes(BREAKER_MAP[invDis]))
    : byRole(KIT_ROLE.BREAKER)

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
  const cableCAP    = bySAP(KIT_SAPS.CABO_CA_3F)

  // Total de inversores no kit (1 para modo único, soma das qtds no modo mix)
  const totalInvCount = Array.isArray(data.inverters)
    ? data.inverters.reduce((s, i) => s + i.qty, 0)
    : 1

  // ── Defaults por tipo de kit ─────────────────────────────────────────────
  const defaults = isMicro ? {
    inclKitConnMi: true,  cableCAMeters: 10 * microCount,
    inclSurgeCA:   true,  surgeACQty: 2 * totalInvCount,
    inclBreaker:   true,  breakerQty: totalInvCount,
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
    surgeACQty:    (isTri ? 4 : 2) * totalInvCount,
    inclSurgeCA:   true,
    inclSurgeDC:   true,   surgeDCQty: 1,
    inclBreaker:   true,   breakerQty: totalInvCount,
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
      <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto">
        <AccessoryRow icon={Link2}    label="Kit conector CA (microinversor)"
          product={kitConnMiP} included={d('inclKitConnMi')} onToggle={() => set('inclKitConnMi', !d('inclKitConnMi'))}
          qty={d('kitConnMiQty') ?? microCount} onQtyChange={v => set('kitConnMiQty', v)} />

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
            {cableCAP?.preco && d('cableCAMeters') > 0 && <span className="ml-auto text-sm font-bold text-green-700">{fmt(cableCAP.preco * d('cableCAMeters'))}</span>}
          </div>
        </div>

        <AccessoryRow icon={Shield}   label="Protetor de Surto CA (SPW02-275-20)"
          product={surgeCAP} included={d('inclSurgeCA')} onToggle={() => set('inclSurgeCA', !d('inclSurgeCA'))}
          qty={d('surgeACQty') ?? 2} onQtyChange={v => set('surgeACQty', v)} />

        <BreakerRow
          products={products}
          selectedBreaker={d('selectedBreaker') ?? breakerP}
          onSelect={brk => set('selectedBreaker', brk)}
          included={d('inclBreaker') ?? true}
          onToggle={() => set('inclBreaker', !d('inclBreaker'))}
          isTri={false}
          qty={d('breakerQty') ?? totalInvCount}
          onQtyChange={v => set('breakerQty', v)}
        />

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} products={products} panelCount={panelCount} />
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

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} products={products} panelCount={panelCount} />
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

        <AccessoryRow icon={Shield} label={`Protetor de Surto CA — ${isTri ? '4 un. (Trifásico)' : '2 un. (Monofásico)'}`}
          product={surgeCAP} included={d('inclSurgeCA') ?? true}
          onToggle={() => set('inclSurgeCA', !d('inclSurgeCA'))}
          qty={d('surgeACQty') ?? (isTri ? 4 : 2)} onQtyChange={v => set('surgeACQty', v)} />

        <BreakerRow
          products={products}
          selectedBreaker={d('selectedBreaker') ?? breakerP}
          onSelect={brk => set('selectedBreaker', brk)}
          included={d('inclBreaker') ?? true}
          onToggle={() => set('inclBreaker', !d('inclBreaker'))}
          isTri={isTri}
          qty={d('breakerQty') ?? totalInvCount}
          onQtyChange={v => set('breakerQty', v)}
        />

        {estruturaSep}
        <StructureSection data={data} onChange={onChange} products={products} panelCount={panelCount} />
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

function StructureSection({ data, onChange, products, panelCount }) {
  const wants = data.wantsEstrutura
  const roofType = data.estruturaRoofType || ''
  const isopleta = data.estruturaIsopleta || 30
  const set = (k, v) => onChange({ ...data, [k]: v })

  const metalicoPerfil = data.metalicoPerfil || 'padrao'

  // All structure kits for selected roof type / isopleta / profile
  const availableKits = useMemo(() => {
    if (!roofType) return []
    return products.filter(p => {
      if (p.categoria !== CATEGORIES.ESTRUTURAS) return false
      if (!p.nome) return false
      const n = p.nome
      const nl = n.toLowerCase()

      if (roofType === 'Carport') return p.tipo === 'Estrutura para garagem solar' || n.startsWith('Carport') || nl.includes('garagem')
      if (roofType === 'Laje')    return p.tipo === 'Estrutura para laje'    || n.startsWith('Laje')
      if (roofType === 'Solo')    return p.tipo === 'Estrutura para solo fixo' || n.startsWith('Solo') || nl.includes('solo')
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
  }, [products, roofType, isopleta, metalicoPerfil])

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
      onChange({
        ...data,
        estruturaKit: selectedKitSingle,
        estruturaQty: Math.ceil(panelCount / (selectedKitSingle.potencia || 1)),
      })
    }
  }, [availableKits]) // eslint-disable-line react-hooks/exhaustive-deps

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
                          {kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(kit.preco * qty4)}</p> : null}
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
                          {kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(kit.preco * qty3)}</p> : null}
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
                {fmt(round2(((data.estruturaKit ?? selectedKit4)?.preco || 0) * qty4) + round2(((data.estruturaKit3 ?? selectedKit3)?.preco || 0) * qty3))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Kit selection — SINGLE mode */}
      {roofType && roofType !== 'Carport' && !hasBothMods && availableKits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Selecionar kit ({availableKits.length} opções)
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {availableKits.map(kit => {
              const modPerKit = kit.potencia || 1
              const qty = qtySingle
              const isSel = (data.estruturaKit?.id ?? selectedKitSingle?.id) === kit.id
              return (
                <button
                  key={kit.id}
                  onClick={() => onChange({ ...data, estruturaKit: kit, estruturaQty: Math.ceil(panelCount / modPerKit) })}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                    isSel ? 'border-weg-blue bg-white shadow-sm' : 'border-blue-100 bg-white/70 hover:border-weg-blue/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{kit.nome}</p>
                      <p className="text-xs font-mono text-gray-400">SAP: {kit.codigo} • {modPerKit} módulo{modPerKit > 1 ? 's' : ''}/kit</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Qtd: {Math.ceil(panelCount / modPerKit)}</p>
                      <p className="text-sm font-bold text-weg-blue">{kit.preco ? fmt(kit.preco) : 'Sob consulta'}</p>
                      {kit.preco ? <p className="text-xs text-weg-orange font-semibold">{fmt(kit.preco * Math.ceil(panelCount / modPerKit))} total</p> : null}
                    </div>
                    {isSel && <Check size={16} className="text-weg-blue shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Quantity adjuster */}
          <div className="flex items-center gap-2 mt-2 bg-white rounded-xl p-2.5 border border-blue-200">
            <span className="text-xs text-gray-600 font-medium mr-1">Qtd:</span>
            <button onClick={() => set('estruturaQty', Math.max(1, qtySingle - 1))} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Minus size={12} /></button>
            <input type="number" min="1" value={qtySingle}
              onChange={e => set('estruturaQty', Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 text-center border border-blue-200 rounded-lg py-0.5 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            <button onClick={() => set('estruturaQty', qtySingle + 1)} className="w-7 h-7 rounded-lg border border-blue-200 flex items-center justify-center hover:bg-blue-50"><Plus size={12} /></button>
            <span className="text-xs text-gray-400 ml-1">
              cobre {qtySingle * ((data.estruturaKit ?? selectedKitSingle)?.potencia || 1)} módulos
            </span>
            <span className="ml-auto font-bold text-weg-orange text-sm">
              {((data.estruturaKit ?? selectedKitSingle)?.preco)
                ? fmt((data.estruturaKit ?? selectedKitSingle).preco * qtySingle)
                : 'Sob consulta'}
            </span>
          </div>
        </div>
      )}

      {roofType && availableKits.length === 0 && (
        <div className="text-sm text-yellow-700 bg-yellow-50 rounded-xl p-3 space-y-2">
          <p>⚠ Nenhum kit encontrado para <strong>{roofType}</strong>.</p>
          <p className="text-xs text-yellow-600">Produtos na categoria Estruturas:</p>
          <ul className="text-xs text-yellow-800 space-y-0.5 max-h-40 overflow-y-auto">
            {products.filter(p => p.categoria === 'Estruturas Metálicas').map(p => (
              <li key={p.id} className="font-mono">nome: "{p.nome}" | tipo: "{p.tipo}"</li>
            ))}
          </ul>
        </div>
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

// ─── Step 6: Resumo / Orçamento ──────────────────────────────────────────────
function Step5({ data, onChange, products, tableInfo, realKwp, initialSavedId, onGoToQuotes }) {
  const { freteOpcoes, desconto } = useProducts()
  const { session, isAdmin } = useAuth()
  const [freteId, setFreteId] = useState(() => {
    if (data.freteAutoId && freteOpcoes.some(f => f.id === data.freteAutoId)) return data.freteAutoId
    return freteOpcoes[0]?.id ?? 1
  })

  // Sincroniza frete quando painel CD Nordeste é selecionado em outra step
  useEffect(() => {
    if (data.freteAutoId && freteOpcoes.some(f => f.id === data.freteAutoId)) {
      setFreteId(data.freteAutoId)
    }
  }, [data.freteAutoId])

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
    supabaseAdmin.from('quotes').select('status, desconto_pct, desconto_resposta')
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

  const microCount = (isMicro && inv && data.panel)
    ? Math.max(1, Math.ceil((panelCount * data.panel.potencia) / (inv.potencia * 1000)))
    : 1

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
  const invDis     = inv?.disjuntor
  const autoBreaker = (invDis && BREAKER_MAP[invDis])
    ? products.find(p => p.modelo === BREAKER_MAP[invDis] || p.nome?.includes(BREAKER_MAP[invDis]))
    : byRole(KIT_ROLE.BREAKER)
  const breakerP   = data.selectedBreaker || autoBreaker

  const d = (key, def) => data[key] !== undefined ? data[key] : def

  // Monta lista de itens conforme tipo de kit
  const kitItems = [
    data.panel   && { label: 'Módulo Fotovoltaico', product: data.panel, qty: panelCount, unit: 'un' },
    // Inversor(es): mix mode → one row per model; single mode → one row
    ...(mixInverters
      ? mixInverters.map(({ inverter: i, qty }) => ({ label: 'Inversor Solar', product: i, qty, unit: 'un' }))
      : [inv && { label: 'Inversor Solar', product: inv, qty: isMicro ? microCount : (data.inverterQty || 1), unit: 'un' }]
    ).filter(Boolean),

    // Itens comuns (CC cables + MC4) — on-grid e bombeamento
    !isMicro && (d('mc4Qty', entradas) > 0) && mc4P &&
      { label: 'Conector MC4 6mm²', product: mc4P, qty: d('mc4Qty', entradas), unit: 'pares' },
    !isMicro && (d('cablePosMeters', 25*entradas) > 0) && cablePosP &&
      { label: 'Cabo CC Vermelho (+)', product: cablePosP, qty: d('cablePosMeters', 25*entradas), unit: 'm' },
    !isMicro && (d('cableNegMeters', 25*entradas) > 0) && cableNegP &&
      { label: 'Cabo CC Preto (–)', product: cableNegP, qty: d('cableNegMeters', 25*entradas), unit: 'm' },

    // On-Grid string
    (!isMicro && !isBomb) && d('inclSurgeCA', true) && surgeCAP &&
      { label: 'Protetor de Surto CA', product: surgeCAP, qty: d('surgeACQty', (isTri ? 4 : 2) * totalInvCount), unit: 'un' },
    (!isMicro && !isBomb) && d('inclBreaker', true) && breakerP &&
      { label: 'Minidisjuntor CA', product: breakerP, qty: d('breakerQty', totalInvCount), unit: 'un' },

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

    // Microinversor
    isMicro && d('inclKitConnMi', true) && bySAP(KIT_SAPS.KIT_CONN_MI) &&
      { label: 'Kit conector CA SIW100G W10', product: bySAP(KIT_SAPS.KIT_CONN_MI), qty: d('kitConnMiQty', microCount), unit: 'un' },
    isMicro && (d('cableCAMeters', 10*microCount) > 0) && bySAP(KIT_SAPS.CABO_CA_3F) &&
      { label: 'Cabo CA 3×6mm²', product: bySAP(KIT_SAPS.CABO_CA_3F), qty: d('cableCAMeters', 10*microCount), unit: 'm' },
    isMicro && d('inclSurgeCA', true) && surgeCAP &&
      { label: 'Protetor de Surto CA', product: surgeCAP, qty: d('surgeACQty', 2 * totalInvCount), unit: 'un' },
    isMicro && d('inclBreaker', true) && breakerP &&
      { label: 'Minidisjuntor CA', product: breakerP, qty: d('breakerQty', totalInvCount), unit: 'un' },

    // Estrutura (todos os tipos) — kit 4-mod
    data.wantsEstrutura && data.estruturaKit && (data.estruturaQty || 0) > 0 &&
      { label: 'Estrutura de Fixação', product: data.estruturaKit, qty: data.estruturaQty || 1, unit: 'kit' },
    // Estrutura — kit 3-mod (mixed selection)
    data.wantsEstrutura && data.estruturaKit3 && (data.estruturaQty3 || 0) > 0 &&
      { label: 'Estrutura de Fixação', product: data.estruturaKit3, qty: data.estruturaQty3, unit: 'kit' },

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
  const fatorBase = F1 * F2 * F3 * F4  // ≈ 0.5121

  // Subtotal: round each line total to 2 dp before summing (matches Excel ROUND(unit*qty,2) per line)
  const subtotal    = kitItems.reduce((sum, item) => round2(sum + round2((item.product.preco || 0) * item.qty)), 0)
  const freteOpcao  = freteOpcoes.find(f => f.id === freteId) || freteOpcoes[0] || { nome: 'FOB', acrescimo: 1 }
  const fatorDesc   = round2(1 - (desconto / 100))
  const totalAjust  = round2(subtotal * fatorBase * fatorDesc)
  const ajusteAmt   = round2(subtotal - totalAjust)
  const freteAmt    = round2(totalAjust * (freteOpcao.acrescimo - 1))
  const totalFinal  = round2(totalAjust * freteOpcao.acrescimo)

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
    total:      round2((item.product.preco || 0) * item.qty),
  }))

  // ── Save quote to Supabase (usa supabaseAdmin para bypassar RLS recursivo) ──
  const saveQuote = async ({ silent = false, statusOverride } = {}) => {
    if (!session) return null
    if (!silent) setSaveStatus('saving')

    const items = buildItems()
    let quoteId = savedId

    try {
      if (!quoteId) {
        // ── Gera número único de referência EFF-YYYY-NNN (global, sem repetição) ──
        const year = new Date().getFullYear()
        const prefix = `EFF-${year}-`
        const { data: allRows } = await supabaseAdmin
          .from('quotes')
          .select('data')
        let maxSeq = 0
        for (const row of allRows || []) {
          const num = (row.data?.numero_orcamento) || ''
          if (num.startsWith(prefix)) {
            const n = parseInt(num.slice(prefix.length), 10)
            if (!isNaN(n) && n > maxSeq) maxSeq = n
          }
        }
        const numeroOrcamento = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`

        const kitDataWithRef = { ...data, numero_orcamento: numeroOrcamento, revisao: 0, revisoes: [] }
        const payload = { ...buildQuotePayload(statusOverride || 'rascunho') }
        payload.data = kitDataWithRef
        delete payload.kit_data
        const { data: q, error } = await supabaseAdmin.from('quotes').insert(payload).select('id').single()
        if (error) throw error
        quoteId = q.id
        setSavedId(quoteId)
        // Propaga referência e revisão para o estado local
        onChange(kitDataWithRef)
      } else {
        // ── Incrementa revisão a cada atualização ──
        const novaRevisao = (data.revisao || 0) + 1
        const historicoRevisao = {
          revisao: novaRevisao,
          data: new Date().toISOString(),
          total_final: totalFinal,
          frete: freteOpcao.nome,
        }
        const kitDataAtualizado = {
          ...data,
          revisao: novaRevisao,
          revisoes: [...(data.revisoes || []), historicoRevisao],
        }

        const shouldResetDiscount =
          ['aguardando_desconto', 'aprovada', 'recusada'].includes(quoteInfo?.status) && scopeChanged
        const { error } = await supabaseAdmin.from('quotes').update({
          subtotal,
          desconto_pct: shouldResetDiscount ? 0 : desconto,
          frete_nome:   freteOpcao.nome,
          frete_pct:    freteOpcao.acrescimo,
          total_final:  totalFinal,
          data: kitDataAtualizado,
          ...(statusOverride ? { status: statusOverride } : {}),
          ...(shouldResetDiscount ? { status: 'rascunho', desconto_pct: 0, desconto_resposta: null } : {}),
        }).eq('id', quoteId)
        if (error) throw error
        if (shouldResetDiscount) {
          setQuoteInfo(prev => ({ ...prev, status: 'rascunho', desconto_pct: 0, desconto_resposta: null }))
        }
        // Propaga revisão para o estado local
        onChange(kitDataAtualizado)
      }

      if (items.length > 0) {
        await supabaseAdmin.from('quote_items').delete().eq('quote_id', quoteId)
        await supabaseAdmin.from('quote_items').insert(items.map(i => ({ ...i, quote_id: quoteId })))
      }

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
        window.print()
      }))
    }
  }, [pendingPrint, showPrintedScreen])

  // ── Imprimir (salva automaticamente antes, muda status p/ em_analise) ──
  const handlePrint = async () => {
    if (session) {
      // silent:false → mostra "Erro ao salvar" se falhar; retorna null se erro
      const qid = await saveQuote({ silent: false, statusOverride: savedId ? undefined : 'em_analise' })
      if (!qid) return   // erro visível na UI, não avança para impressão
    }
    window.print()
    setShowPrintedScreen(true)
  }

  // ── Request discount ──
  const requestDiscount = async () => {
    if (!session || !discountMotivo.trim()) return
    setDiscountStatus('sending')

    let quoteId = savedId
    try {
      if (!quoteId) {
        const payload = {
          user_id:     session.user.id,
          nome_projeto: data.clienteNome
            ? `Kit ${realKwp.toFixed(2)} kWp — ${data.clienteNome}`
            : `Kit ${realKwp.toFixed(2)} kWp`,
          kit_type:    data.kitType,
          kwp:         realKwp,
          subtotal,
          desconto_pct: 0,
          frete_nome:  freteOpcao.nome,
          frete_pct:   freteOpcao.acrescimo,
          total_final: totalFinal,
          status:      'aguardando_desconto',
          desconto_motivo: discountMotivo,
          data,
        }
        const { data: q, error } = await supabaseAdmin.from('quotes').insert(payload).select('id').single()
        if (error) throw error
        quoteId = q.id
        setSavedId(quoteId)
      } else {
        await supabaseAdmin.from('quotes').update({
          status: 'aguardando_desconto',
          desconto_motivo: discountMotivo,
        }).eq('id', quoteId)
      }
    } catch (err) {
      console.error('[requestDiscount]', err)
      setDiscountStatus('error')
      return
    }

    // Notifica admin sobre solicitação de desconto (silencioso)
    notifyDescontoSolicitado({
      clienteNome: data.clienteNome || 'Cliente',
      kitNome: `Kit ${realKwp.toFixed(2)} kWp`,
      totalFinal,
      motivo: discountMotivo,
    })
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

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden max-w-3xl mx-auto print:shadow-none" id="kit-print">

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
              <p style={{fontSize:10, color:'#1B3A8A', margin:'2px 0 0', fontWeight:600}}>
                Validade: {prop.validade || 7} dias
              </p>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto / Código SAP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unit.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 print:hidden w-4" />
              </tr>
            </thead>
            <tbody>
              {kitItems.map((item, idx) => (
                <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${item.avulso ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      {item.avulso && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium print:hidden">avulso</span>}
                    </div>
                    {!item.avulso && <p className="text-xs text-gray-500">{item.product.nome}</p>}
                    <p className="text-xs font-mono text-gray-400">{item.product.codigo !== '—' ? `SAP: ${item.product.codigo}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-weg-gray rounded-lg px-2 py-1 text-sm font-bold text-weg-blue">
                      {item.qty} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 print:hidden">
                    {isAdmin
                      ? (item.product.preco ? fmt(item.product.preco) : 'S/C')
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {item.product.preco ? fmt(round2(item.product.preco * item.qty)) : '—'}
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
              ))}
            </tbody>
            <tfoot>
              {/* Subtotal tabela */}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan="4" className="px-4 py-2.5 text-right text-sm font-semibold text-gray-500">
                  Subtotal (preço de tabela)
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">
                  {fmt(subtotal)}
                </td>
              </tr>
              {/* Ajuste de preço — fatores + desconto */}
              <tr className="bg-green-50">
                <td colSpan="4" className="px-4 py-2 text-right text-sm font-semibold text-green-700">
                  Ajuste
                  {isAdmin && (
                    <span className="font-normal text-green-600 ml-1">
                      (×{F1} × {F2} × {F3} × {F4}{desconto > 0 ? ` × ${fatorDesc.toFixed(4)}` : ''})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-sm font-bold text-green-700">
                  − {fmt(ajusteAmt)}
                </td>
              </tr>
              {/* Freight row */}
              {freteOpcao.acrescimo !== 1 && (
                <tr className="bg-gray-50">
                  <td colSpan="4" className="px-4 py-2 text-right text-sm font-semibold text-gray-600">
                    {freteOpcao.nome}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-bold text-gray-700">
                    + {fmt(freteAmt)}
                  </td>
                </tr>
              )}
              {/* Grand total */}
              <tr className="bg-weg-blue text-white">
                <td colSpan="4" className="px-4 py-4 text-right font-bold uppercase tracking-wide">
                  Total {freteOpcao.acrescimo === 1 ? 'do Kit' : 'com Frete'}
                </td>
                <td className="px-4 py-4 text-right text-xl font-extrabold">
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
          <div className="border-t-2 border-dashed border-gray-200">
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

        {/* Footer note */}
        <div className="px-5 py-3 bg-gray-50 text-xs text-gray-400 border-t border-gray-200 space-y-0.5">
          <p>Preços {freteOpcao.acrescimo === 1 ? 'FOB Itajaí-SC' : freteOpcao.nome}. Válidos conforme {tableInfo.nome}. Sujeitos a alteração sem aviso prévio.</p>
          {isAdmin && <p>Fator de precificação: {F1} × {F2} × {F3} × {F4}{desconto > 0 ? ` × (1 − ${desconto}%)` : ''}.</p>}
          <p>Validade desta proposta: <strong>{prop.validade || 7} dias</strong> a partir da data de emissão.</p>
        </div>

        {/* Print-only footer */}
        <div className="hidden print:flex items-center justify-between px-6 py-2 border-t border-gray-300" style={{background:'#1B3A8A'}}>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.7)'}}>{tableInfo?.nome} — Validade: {prop.validade || 7} dias</span>
          <span style={{fontSize:9, color:'rgba(255,255,255,0.7)'}}>0800 727 0800 · energia.solar@weg.net</span>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Localidade / Cidade</label>
                <input
                  type="text" value={data.clienteLocal || ''}
                  onChange={e => onChange({ ...data, clienteLocal: e.target.value })}
                  placeholder="Ex: Florianópolis - SC"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue"
                />
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

        {session && !isAdmin && (
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
export default function KitBuilder({ initialData, initialSavedId, onGoToQuotes } = {}) {
  const { catalogProducts: products, tableInfo } = useProducts()
  // Se carregado a partir de uma cotação salva, começa no step 6 (resumo)
  const [step, setStep] = useState(initialData ? 6 : 1)
  const [data, setData] = useState(initialData || { mode: 'potencia', hsp: SUN_HOURS })

  const hsp = data.hsp || SUN_HOURS
  const targetKwp = data.mode === 'consumo'
    ? data.consumoDiario > 0 ? (data.consumoDiario / hsp) * 1.2 : 0
    : (data.kwpDesejado || 0)

  const realKwp = data.panel
    ? ((data.panelQty || 1) * data.panel.potencia / 1000)
    : targetKwp

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!data.kitType) return false
      if (data.kitType === 'ongrid_tri' && !data.tensaoRede) return false
      return true
    }
    if (step === 2) return (data.kwpDesejado || 0) > 0
    if (step === 3) return !!data.panel
    if (step === 4) return !!data.inverter || (Array.isArray(data.inverters) && data.inverters.length > 0)
    if (step === 5) return true
    return false
  }, [step, targetKwp, data])

  const reset = () => {
    setData({ mode: 'potencia', hsp: SUN_HOURS })
    setStep(1)
  }

  const kitTypeInfo = KIT_TYPES.find(k => k.key === data.kitType)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">⚡ Monte seu Kit Solar</h1>
          <p className="text-gray-400 text-sm flex items-center gap-2">
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
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        {step === 1 && <StepKitType data={data} onChange={setData} />}
        {step === 2 && <Step1 data={data} onChange={setData} />}
        {step === 3 && <Step2 data={data} onChange={setData} products={products} targetKwp={targetKwp} />}
        {step === 4 && <Step3 data={data} onChange={setData} products={products} realKwp={realKwp} />}
        {step === 5 && <Step4 data={data} onChange={setData} products={products} />}
        {step === 6 && <Step5 data={data} onChange={setData} products={products} tableInfo={tableInfo} realKwp={realKwp} initialSavedId={initialSavedId} onGoToQuotes={onGoToQuotes} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={18} /> Voltar
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {STEPS.map(s => (
            <div key={s.id} className={`rounded-full transition-all ${
              s.id === step ? 'w-6 h-2.5 bg-weg-blue' : s.id < step ? 'w-2.5 h-2.5 bg-green-400' : 'w-2.5 h-2.5 bg-gray-200'
            }`} />
          ))}
        </div>

        {step < 6 ? (
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
