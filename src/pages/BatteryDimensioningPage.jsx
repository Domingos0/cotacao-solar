import { useState, useMemo } from 'react'
import { useProducts } from '../context/ProductsContext'
import { Battery, Calculator, Info, Plus, X, AlertTriangle, Check, Sun, ArrowRight, Search, HelpCircle } from 'lucide-react'
import { getProductImage } from '../data/productImages'
import { KIT_ROLE } from '../data/products'
import { ESTADOS } from '../data/cidadesPorEstado'

const HSP_PADRAO = 4.5   // fallback quando nenhum estado é selecionado
const EFICIENCIA = 0.75  // perdas do sistema (metodologia WEG, p.59 do portfólio)

// Média de HSP (horas de sol pico, kWh/m²/dia) por estado — valores
// aproximados do Atlas Brasileiro de Energia Solar (CRESESB/INPE). É uma
// média estadual, não o valor exato da cidade — por isso o campo continua
// editável manualmente depois de selecionar o estado.
const HSP_BY_UF = {
  AC: 4.7, AL: 5.5, AM: 4.4, AP: 4.9, BA: 5.5, CE: 5.8, DF: 5.3, ES: 4.9,
  GO: 5.3, MA: 5.3, MG: 5.1, MS: 5.1, MT: 5.0, PA: 4.6, PB: 5.6, PE: 5.6,
  PI: 5.7, PR: 4.5, RJ: 4.7, RN: 5.8, RO: 4.6, RR: 4.8, RS: 4.5, SC: 4.3,
  SE: 5.5, SP: 4.8, TO: 5.2,
}

// Mesma linha de baterias CB (SIW200H/SIW400H) usada no Monte seu Kit —
// CB050/CB100 = geração original; SBW200 CB057/CB115 = geração nova.
const BAT_CB_MODELS = [
  { type: 'CB050',        desc: '5,02 kWh / 192V DC',  kwh: 5.02 },
  { type: 'CB100',        desc: '10,07 kWh / 384V DC', kwh: 10.07 },
  { type: 'SBW200 CB057', desc: '5,76 kWh / 192V DC',  kwh: 5.76 },
  { type: 'SBW200 CB115', desc: '11,52 kWh / 384V DC', kwh: 11.52 },
]
const LUNA_KWH = 6.9
const DOD = 0.9 // profundidade de descarga padrão WEG (LiFePO4), aplicada a todas as linhas

const INVERTER_FAMILIES = [
  { key: 'SIW200H', label: 'SIW200H', eco: 'CB',  maxBat: 4,  maxGroups: null },
  { key: 'SIW400H', label: 'SIW400H', eco: 'CB',  maxBat: 8,  maxGroups: null },
  { key: 'SIW300H', label: 'SIW300H', eco: 'SBW', maxBat: null, maxGroups: 6 },
  { key: 'SIW500H', label: 'SIW500H', eco: 'SBW', maxBat: null, maxGroups: 12 },
  { key: 'SIW400H_W30', label: 'SIW400H W30 (alta potência)', eco: 'SBW400', maxBat: null, maxGroups: null },
]

// SBW400 (SIW400H W30, T050/T075/T125) — 1 BMS (HV Box) por torre + 4 a 15
// módulos SBW400 B160 W00 (16,07 kWh cada) por BMS, até 3 torres (720 kWh).
// Nenhum SKU desta linha está cadastrado no catálogo ainda — a regra fica
// pronta aqui pra quando os produtos forem incluídos (inversor + B160 + HV Box).
const SBW400_B160_KWH = 16.07
const SBW400_MIN_PER_BMS = 4
const SBW400_MAX_PER_BMS = 15
const SBW400_MAX_TOWERS = 3

// Saída EPS (backup) nominal/máxima por potência CA do inversor — modelos
// SIW200H Mono/SIW400H (ficha técnica WEG). Chave = potência (kW) do produto.
const EPS_BY_POTENCIA = {
  5:    { nom: 5,    max: 6 },
  7.5:  { nom: 7.5,  max: 10 },
  10.5: { nom: 10.5, max: 12 },
  15:   { nom: 15,   max: 18 },
  30:   { nom: 30,   max: 36 },
}

// Saída EPS (backup) da linha Split-phase SIW200H S038-S114 W20 — ficha
// técnica DATASHEET_SIW200H_S075_S114_W20_PT_web.pdf. nom = "Potência
// Aparente Máxima de Saída" (EPS contínua); max = "Potência de Pico (60s)".
// Chave = código do modelo (S038/S057/S075/S096/S114), não a potência em kW,
// porque o valor de kW colide com SKUs da linha Mono (ex: S075 e M075 têm os
// dois 7,5 kW de rede, mas EPS diferente).
const EPS_SPLIT_BY_CODE = {
  S038: { nom: 4.18,  max: 5.13 },
  S057: { nom: 6.27,  max: 7.70 },
  S075: { nom: 8.25,  max: 10.13 },
  S096: { nom: 10.56, max: 12.96 },
  S114: { nom: 12.54, max: 15.39 },
}
// Split-phase 127/220V permite até 100% de desequilíbrio entre as fases —
// ou seja, dá pra concentrar toda a carga crítica numa única fase de 110V,
// dentro do limite total de potência do inversor (mesma ficha técnica).
const SPLIT_PHASE_DESEQUILIBRIO_PCT = 100

function getEpsFor(p) {
  const n = (p.modelo || p.nome || '').toUpperCase()
  const codeMatch = n.match(/\bS(038|057|075|096|114)\b/)
  if (codeMatch) return EPS_SPLIT_BY_CODE[`S${codeMatch[1]}`]
  return EPS_BY_POTENCIA[p.potencia]
}

// Capacidades paralelas máximas por família (ficha técnica WEG, p.29-34):
// "Capacidades Paralelas Máximas: 04 unidades no OFF GRID" — SIW200H e
// SIW400H permitem até 4 inversores em paralelo no modo híbrido/off-grid.
const MAX_PARALELO_BY_FAMILY = { SIW200H: 4, SIW400H: 4 }

function paraleloInfoFor(p, maxNominal, maxPartida) {
  const fam = /^SIW200H/i.test(p.modelo || p.nome || '') ? 'SIW200H'
    : /^SIW400H/i.test(p.modelo || p.nome || '') ? 'SIW400H' : null
  const maxParalelo = MAX_PARALELO_BY_FAMILY[fam] || 1
  const unidades = Math.max(1, Math.ceil(maxNominal / p.eps.nom), Math.ceil(maxPartida / p.eps.max))
  return { unidades, maxParalelo, viavel: unidades <= maxParalelo, fam }
}

// Tipo de carga (percepção do inversor) — multiplicadores sobre a potência
// nominal de etiqueta pra achar a potência "vista" pelo inversor (nominal
// operando e de partida/pico), conforme metodologia WEG.
const TIPO_CARGA = {
  resistiva:  { label: 'Resistiva',  nominal: 1.0, partida: 1.0, cls: 'bg-sky-100 text-sky-700 border-sky-300' },
  capacitiva: { label: 'Capacitiva', nominal: 1.5, partida: 2.0, cls: 'bg-violet-100 text-violet-700 border-violet-300' },
  indutiva:   { label: 'Indutiva',   nominal: 2.0, partida: 5.0, cls: 'bg-orange-100 text-orange-700 border-orange-300' },
}

// Presets de equipamentos críticos comuns, agrupados por categoria — tipo,
// watts e horas/dia de uso típicos (tabelas WEG "Perfil de Carga
// Residencial/Comercial" p.55-56 + faixas de referência Procel/INMETRO),
// só pra agilizar o preenchimento. Watts são valores típicos de mercado —
// a etiqueta do aparelho real é sempre a fonte mais confiável.
const CATEGORIA_STYLE = {
  'Cozinha':              { icon: '🍳', cls: 'border-orange-200 bg-orange-50/60',  chip: 'bg-white text-orange-700 border-orange-200 hover:border-orange-400' },
  'Climatização':         { icon: '❄️', cls: 'border-sky-200 bg-sky-50/60',        chip: 'bg-white text-sky-700 border-sky-200 hover:border-sky-400' },
  'Limpeza & Banho':      { icon: '🧼', cls: 'border-cyan-200 bg-cyan-50/60',      chip: 'bg-white text-cyan-700 border-cyan-200 hover:border-cyan-400' },
  'Eletrônicos':          { icon: '🔌', cls: 'border-indigo-200 bg-indigo-50/60',  chip: 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400' },
  'Áreas externas':       { icon: '🌳', cls: 'border-emerald-200 bg-emerald-50/60',chip: 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400' },
  'Comercial/Escritório': { icon: '🏢', cls: 'border-slate-300 bg-slate-50/60',    chip: 'bg-white text-slate-700 border-slate-300 hover:border-slate-500' },
}
const CATEGORIAS_EQUIP = Object.keys(CATEGORIA_STYLE)

const EQUIP_PRESETS = [
  // Cozinha
  { nome: 'Geladeira',          emoji: '🧊', categoria: 'Cozinha',  tipo: 'indutiva',   watts: 250,  inicio: 0,  duracao: 24 },
  { nome: 'Freezer',            emoji: '🧊', categoria: 'Cozinha',  tipo: 'indutiva',   watts: 200,  inicio: 0,  duracao: 24 },
  { nome: 'Micro-ondas',        emoji: '🍲', categoria: 'Cozinha',  tipo: 'indutiva',   watts: 1000, inicio: 12, duracao: 1 },
  { nome: 'Forno elétrico',     emoji: '🔥', categoria: 'Cozinha',  tipo: 'resistiva',  watts: 1500, inicio: 18, duracao: 1 },
  { nome: 'Fogão por indução',  emoji: '🍳', categoria: 'Cozinha',  tipo: 'resistiva',  watts: 2000, inicio: 18, duracao: 0.5 },
  { nome: 'Liquidificador',     emoji: '🥤', categoria: 'Cozinha',  tipo: 'indutiva',   watts: 500,  inicio: 7,  duracao: 1 },
  { nome: 'Cafeteira elétrica', emoji: '☕', categoria: 'Cozinha',  tipo: 'resistiva',  watts: 800,  inicio: 7,  duracao: 0.5 },
  { nome: 'Air fryer',          emoji: '🍟', categoria: 'Cozinha',  tipo: 'resistiva',  watts: 1500, inicio: 12, duracao: 0.5 },
  { nome: 'Torneira elétrica',  emoji: '🚰', categoria: 'Cozinha',  tipo: 'resistiva',  watts: 3500, inicio: 7,  duracao: 0.5 },
  // Climatização
  { nome: 'Ar-condicionado',    emoji: '❄️', categoria: 'Climatização', tipo: 'indutiva', watts: 1200, inicio: 13, duracao: 6 },
  { nome: 'Ventilador',         emoji: '🌀', categoria: 'Climatização', tipo: 'indutiva', watts: 50,   inicio: 13, duracao: 8 },
  { nome: 'Ventilador de teto', emoji: '🪭', categoria: 'Climatização', tipo: 'indutiva', watts: 100,  inicio: 13, duracao: 8 },
  { nome: 'Exaustor',           emoji: '♨️', categoria: 'Climatização', tipo: 'indutiva', watts: 150,  inicio: 12, duracao: 2 },
  // Limpeza & Banho
  { nome: 'Chuveiro elétrico',  emoji: '🚿', categoria: 'Limpeza & Banho', tipo: 'resistiva', watts: 5500, inicio: 7,  duracao: 1 },
  { nome: 'Máquina de lavar',   emoji: '🧺', categoria: 'Limpeza & Banho', tipo: 'indutiva',  watts: 500,  inicio: 10, duracao: 1 },
  { nome: 'Secadora de roupas', emoji: '🌬️', categoria: 'Limpeza & Banho', tipo: 'resistiva', watts: 2500, inicio: 11, duracao: 1 },
  { nome: 'Ferro de passar',    emoji: '👔', categoria: 'Limpeza & Banho', tipo: 'resistiva', watts: 1200, inicio: 19, duracao: 1 },
  { nome: 'Aspirador de pó',    emoji: '🧹', categoria: 'Limpeza & Banho', tipo: 'indutiva',  watts: 1200, inicio: 9,  duracao: 0.5 },
  { nome: 'Secador de cabelo',  emoji: '💇', categoria: 'Limpeza & Banho', tipo: 'resistiva', watts: 1800, inicio: 7,  duracao: 0.2 },
  // Eletrônicos
  { nome: 'TV',                 emoji: '📺', categoria: 'Eletrônicos', tipo: 'capacitiva', watts: 100, inicio: 18, duracao: 4 },
  { nome: 'Roteador/Modem',     emoji: '📶', categoria: 'Eletrônicos', tipo: 'capacitiva', watts: 10,  inicio: 0,  duracao: 24 },
  { nome: 'Iluminação (LED)',   emoji: '💡', categoria: 'Eletrônicos', tipo: 'capacitiva', watts: 60,  inicio: 18, duracao: 6 },
  { nome: 'Notebook/PC',        emoji: '💻', categoria: 'Eletrônicos', tipo: 'capacitiva', watts: 80,  inicio: 8,  duracao: 8 },
  { nome: 'Som/Caixa de som',   emoji: '🔊', categoria: 'Eletrônicos', tipo: 'capacitiva', watts: 100, inicio: 18, duracao: 4 },
  // Áreas externas
  { nome: 'Portão eletrônico',  emoji: '🚪', categoria: 'Áreas externas', tipo: 'indutiva', watts: 200, inicio: 18, duracao: 1 },
  { nome: 'Bomba d’água',      emoji: '🚰', categoria: 'Áreas externas', tipo: 'indutiva', watts: 750, inicio: 8,  duracao: 3 },
  { nome: 'Bomba de piscina',   emoji: '🏊', categoria: 'Áreas externas', tipo: 'indutiva', watts: 750, inicio: 9,  duracao: 4 },
  // Comercial/Escritório
  { nome: 'Workstation/PC',     emoji: '🖥️', categoria: 'Comercial/Escritório', tipo: 'capacitiva', watts: 150,  inicio: 8, duracao: 8 },
  { nome: 'Servidor',           emoji: '🗄️', categoria: 'Comercial/Escritório', tipo: 'capacitiva', watts: 600,  inicio: 0, duracao: 24 },
  { nome: 'Impressora',         emoji: '🖨️', categoria: 'Comercial/Escritório', tipo: 'capacitiva', watts: 300,  inicio: 9, duracao: 2 },
  { nome: 'Câmeras + DVR',      emoji: '🎥', categoria: 'Comercial/Escritório', tipo: 'capacitiva', watts: 40,   inicio: 0, duracao: 24 },
  { nome: 'Caixa registradora', emoji: '🧾', categoria: 'Comercial/Escritório', tipo: 'capacitiva', watts: 60,   inicio: 8, duracao: 10 },
  { nome: 'Elevador',           emoji: '🛗', categoria: 'Comercial/Escritório', tipo: 'indutiva',   watts: 5000, inicio: 8, duracao: 2 },
  { nome: 'Pressurizador',      emoji: '🚿', categoria: 'Comercial/Escritório', tipo: 'indutiva',   watts: 2000, inicio: 7, duracao: 4 },
  { nome: 'Balcão frigorífico', emoji: '🧊', categoria: 'Comercial/Escritório', tipo: 'indutiva',   watts: 600,  inicio: 0, duracao: 24 },
]

// Kits padrão — estimativas aproximadas por porte de residência/comércio.
// Além do consumo mensal típico, já vêm com uma lista pronta de cargas
// críticas comuns pra esse porte (editável depois, como qualquer item).
const KITS_PADRAO = [
  {
    nome: 'Casa pequena', desc: '1-2 pessoas', kwh: 250,
    itens: [
      { nome: 'Geladeira', qty: 1 },
      { nome: 'Roteador/Modem', qty: 1 },
      { nome: 'Iluminação (LED)', qty: 1 },
      { nome: 'TV', qty: 1 },
      { nome: 'Notebook/PC', qty: 1 },
    ],
  },
  {
    nome: 'Casa média', desc: '3-4 pessoas', kwh: 500,
    itens: [
      { nome: 'Geladeira', qty: 1 },
      { nome: 'Roteador/Modem', qty: 1 },
      { nome: 'Iluminação (LED)', qty: 1 },
      { nome: 'TV', qty: 1 },
      { nome: 'Notebook/PC', qty: 1 },
      { nome: 'Ar-condicionado', qty: 1 },
      { nome: 'Bomba d’água', qty: 1 },
      { nome: 'Micro-ondas', qty: 1 },
      { nome: 'Portão eletrônico', qty: 1 },
      { nome: 'Máquina de lavar', qty: 1 },
    ],
  },
  {
    nome: 'Casa grande', desc: '5+ pessoas', kwh: 1000,
    itens: [
      { nome: 'Geladeira', qty: 1 },
      { nome: 'Freezer', qty: 1 },
      { nome: 'Roteador/Modem', qty: 1 },
      { nome: 'Iluminação (LED)', qty: 1 },
      { nome: 'TV', qty: 2 },
      { nome: 'Notebook/PC', qty: 2 },
      { nome: 'Ar-condicionado', qty: 2 },
      { nome: 'Bomba d’água', qty: 1 },
      { nome: 'Micro-ondas', qty: 1 },
      { nome: 'Portão eletrônico', qty: 1 },
      { nome: 'Máquina de lavar', qty: 1 },
      { nome: 'Chuveiro elétrico', qty: 1 },
      { nome: 'Ferro de passar', qty: 1 },
      { nome: 'Torneira elétrica', qty: 1 },
      { nome: 'Ventilador', qty: 2 },
    ],
  },
  {
    nome: 'Comércio pequeno', desc: 'loja/sala', kwh: 800,
    itens: [
      { nome: 'Workstation/PC', qty: 2 },
      { nome: 'Servidor', qty: 1 },
      { nome: 'Impressora', qty: 1 },
      { nome: 'Câmeras + DVR', qty: 1 },
      { nome: 'Iluminação (LED)', qty: 1 },
      { nome: 'Ar-condicionado', qty: 1 },
      { nome: 'Roteador/Modem', qty: 1 },
    ],
  },
  {
    nome: 'Comércio médio', desc: 'várias salas', kwh: 2000,
    itens: [
      { nome: 'Workstation/PC', qty: 5 },
      { nome: 'Servidor', qty: 1 },
      { nome: 'Impressora', qty: 2 },
      { nome: 'Câmeras + DVR', qty: 1 },
      { nome: 'Elevador', qty: 1 },
      { nome: 'Pressurizador', qty: 1 },
      { nome: 'Ar-condicionado', qty: 2 },
      { nome: 'Iluminação (LED)', qty: 2 },
      { nome: 'Roteador/Modem', qty: 1 },
    ],
  },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function makeHoras(inicio, duracao) {
  const arr = Array(24).fill(false)
  const n = Math.min(24, Math.max(0, Math.round(duracao)))
  for (let i = 0; i < n; i++) arr[(inicio + i) % 24] = true
  return arr
}

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtKw = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100
const formatHorasMin = h => {
  if (!isFinite(h) || h <= 0) return '—'
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return hh > 0 ? `${hh}h${mm > 0 ? ` ${mm}min` : ''}` : `${mm}min`
}
let nextId = 1

function newItem(preset) {
  const inicio = preset?.inicio ?? 8
  const duracao = preset?.duracao ?? 4
  return {
    id: nextId++,
    nome: preset?.nome || '',
    emoji: preset?.emoji || '🔌',
    tipo: preset?.tipo || 'resistiva',
    watts: preset?.watts || 0,
    qty: preset?.qty || 1,
    inicio, duracao,
    horas: makeHoras(inicio, duracao),
    gradeAberta: false,
  }
}

export default function BatteryDimensioningPage({ onUseInKit, initialState }) {
  const { catalogProducts: products } = useProducts()

  const [famKey, setFamKey] = useState(initialState?.famKey || 'SIW200H')
  const [phase, setPhase]   = useState(initialState?.phase || 'mono') // SIW200H: 'mono' (220V) ou 'split' (127/220V)
  const [items, setItems]   = useState(initialState?.items || [newItem(EQUIP_PRESETS[0])])
  const [consumoMensal, setConsumoMensal] = useState(initialState?.consumoMensal ?? 1100)
  const [autonomiaHoras, setAutonomiaHoras] = useState(initialState?.autonomiaHoras ?? 24)
  const [panelId, setPanelId] = useState(initialState?.panelId ?? null)
  const [invSelectedId, setInvSelectedId] = useState(initialState?.invSelectedId ?? null)
  const [uf, setUf] = useState(initialState?.uf || '')
  const [hsp, setHsp] = useState(initialState?.hsp ?? HSP_PADRAO)
  const [outageInicio, setOutageInicio] = useState(initialState?.outageInicio ?? 18)
  const [outageDuracao, setOutageDuracao] = useState(initialState?.outageDuracao ?? 12)

  const handleUfChange = (novaUf) => {
    setUf(novaUf)
    if (novaUf && HSP_BY_UF[novaUf]) setHsp(HSP_BY_UF[novaUf])
  }

  const fam = INVERTER_FAMILIES.find(f => f.key === famKey)
  const isCBEco  = fam.eco === 'CB'
  const isSBWEco = fam.eco === 'SBW'
  const isSBW400Eco = fam.eco === 'SBW400'
  const isSplitPhase = famKey === 'SIW200H' && phase === 'split'

  const addItem = (preset) => setItems(list => [...list, newItem(preset)])
  const [kitPadraoAtivo, setKitPadraoAtivo] = useState(null)
  const [equipBusca, setEquipBusca] = useState('')
  const [cRate, setCRate] = useState(0.5)
  const applyKitPadrao = (kit) => {
    setKitPadraoAtivo(kit.nome)
    setConsumoMensal(kit.kwh)
    setItems(kit.itens.map(it => {
      const base = EQUIP_PRESETS.find(p => p.nome === it.nome)
      return newItem({ ...base, qty: it.qty })
    }))
  }
  const removeItem = (id) => setItems(list => list.filter(it => it.id !== id))
  const updateItem = (id, patch) => setItems(list => list.map(it => {
    if (it.id !== id) return it
    const next = { ...it, ...patch }
    // Início/duração regeneram a grade automaticamente — editar a grade manualmente
    // (clique numa hora) não mexe mais em início/duração, só nas horas marcadas.
    if (patch.inicio !== undefined || patch.duracao !== undefined) {
      next.horas = makeHoras(next.inicio, next.duracao)
    }
    return next
  }))
  const toggleHora = (id, h) => setItems(list => list.map(it =>
    it.id === id ? { ...it, horas: it.horas.map((v, i) => i === h ? !v : v) } : it
  ))
  const toggleGrade = (id) => setItems(list => list.map(it => it.id === id ? { ...it, gradeAberta: !it.gradeAberta } : it))

  // ── Energia diária crítica (kWh/dia) — soma direta de W × horas/dia, sem
  // multiplicador de tipo (o multiplicador só vale pra potência instantânea) ──
  const energiaCriticaDiaria = round2(items.reduce((s, it) => {
    const horasAtivas = it.horas.filter(Boolean).length
    return s + (it.watts / 1000) * it.qty * horasAtivas
  }, 0))
  const energiaDiariaTotal = round2((consumoMensal || 0) / 30)
  const energiaNormalDiaria = Math.max(0, round2(energiaDiariaTotal - energiaCriticaDiaria))

  // ── Simultaneidade: soma por hora (0-23) a potência "vista" pelo inversor
  // (nominal e de partida), aplicando o multiplicador do tipo de carga ──
  const { maxNominal, maxPartida, perHora } = useMemo(() => {
    const nomArr = HOURS.map(h => round2(items.reduce((s, it) => {
      if (!it.horas[h]) return s
      const mult = TIPO_CARGA[it.tipo].nominal
      return s + (it.watts / 1000) * it.qty * mult
    }, 0)))
    const parArr = HOURS.map(h => round2(items.reduce((s, it) => {
      if (!it.horas[h]) return s
      const mult = TIPO_CARGA[it.tipo].partida
      return s + (it.watts / 1000) * it.qty * mult
    }, 0)))
    return { maxNominal: Math.max(0, ...nomArr), maxPartida: Math.max(0, ...parArr), perHora: nomArr.map((n, i) => ({ h: i, nom: n, par: parArr[i] })) }
  }, [items])

  // ── Cenários específicos por hábito de uso — além do pico real (conforme
  // horário informado), mostra o pico só no período diurno, só no noturno
  // (quando a bateria carrega sozinha, sem ajuda do FV) e o pico absoluto
  // teórico (todos os equipamentos ligados ao mesmo tempo, pior caso) ──
  const cenariosUso = useMemo(() => {
    const diaHoras = perHora.filter(p => p.h >= 6 && p.h < 18)
    const noiteHoras = perHora.filter(p => p.h < 6 || p.h >= 18)
    const abs = items.reduce((s, it) => ({
      nom: s.nom + (it.watts / 1000) * it.qty * TIPO_CARGA[it.tipo].nominal,
      par: s.par + (it.watts / 1000) * it.qty * TIPO_CARGA[it.tipo].partida,
    }), { nom: 0, par: 0 })
    return {
      diurno:   { nom: round2(Math.max(0, ...diaHoras.map(p => p.nom), 0)),   par: round2(Math.max(0, ...diaHoras.map(p => p.par), 0)) },
      noturno:  { nom: round2(Math.max(0, ...noiteHoras.map(p => p.nom), 0)), par: round2(Math.max(0, ...noiteHoras.map(p => p.par), 0)) },
      absoluto: { nom: round2(abs.nom), par: round2(abs.par) },
    }
  }, [perHora, items])

  const kwhNecessario = round2(energiaCriticaDiaria * (autonomiaHoras / 24) / DOD)

  // ── Compatibilidade de inversor por potência EPS — todos os modelos da
  // linha CB (SIW200H e SIW400H) com EPS conhecido, usando os modelos REAIS
  // cadastrados no catálogo ativo ──
  const invCandidates = useMemo(() => {
    return products
      .filter(p => p.preco && /^SIW200H|^SIW400H/i.test(p.modelo || p.nome || ''))
      .map(p => ({ ...p, eps: getEpsFor(p) }))
      .filter(p => p.eps)
      .sort((a, b) => (a.potencia || 0) - (b.potencia || 0))
  }, [products])

  // Filtrado pela família + fase escolhidas lá em cima — muda sozinho
  // conforme o clique (SIW200H Mono só mostra M-series, Split só S-series,
  // SIW400H mostra a família inteira, etc.).
  const invCandidatesFiltradas = useMemo(() => {
    if (!isCBEco) return []
    let lista = invCandidates.filter(p => new RegExp(`^${famKey}`, 'i').test(p.modelo || p.nome || ''))
    if (famKey === 'SIW200H') {
      lista = lista.filter(p => new RegExp(`^SIW200H\\s*${phase === 'split' ? 'S' : 'M'}`, 'i').test(p.modelo || p.nome || ''))
    }
    return lista
  }, [isCBEco, invCandidates, famKey, phase])

  // Primeiro modelo da seleção atual cuja EPS cobre o pico sozinho — se
  // nenhum cobrir sozinho, prefere o que precisar de menos unidades em
  // paralelo (dentro do limite de 4), senão cai no maior modelo disponível.
  const invSuggested = useMemo(() => {
    if (!isCBEco) return null
    const direto = invCandidatesFiltradas.find(p => maxNominal <= p.eps.nom && maxPartida <= p.eps.max)
    if (direto) return direto
    const viaveis = invCandidatesFiltradas
      .map(p => ({ p, info: paraleloInfoFor(p, maxNominal, maxPartida) }))
      .filter(x => x.info.viavel)
      .sort((a, b) => a.info.unidades - b.info.unidades)
    return viaveis[0]?.p || invCandidatesFiltradas[invCandidatesFiltradas.length - 1] || null
  }, [isCBEco, invCandidatesFiltradas, maxNominal, maxPartida])

  // Inversor escolhido manualmente na tabela de compatibilidade, se houver —
  // senão cai na sugestão automática.
  const invChosen = invCandidatesFiltradas.find(p => p.id === invSelectedId) || invSuggested
  const invChosenParalelo = invChosen && !(maxNominal <= invChosen.eps?.nom && maxPartida <= invChosen.eps?.max)
    ? paraleloInfoFor(invChosen, maxNominal, maxPartida)
    : null
  const invChosenQty = invChosenParalelo?.viavel ? invChosenParalelo.unidades : 1
  // Se nem com o paralelismo máximo permitido (4 unidades) o pico couber,
  // o sistema está além do que essa linha de inversor suporta.
  const invAlemDoLimite = !!invChosenParalelo && !invChosenParalelo.viavel

  // Melhor custo-benefício entre os modelos viáveis (direto ou em paralelo
  // dentro do limite) — menor custo total (preço × unidades necessárias).
  const invMelhorId = useMemo(() => {
    if (!isCBEco) return null
    const viaveis = invCandidatesFiltradas
      .map(p => {
        const ok = maxNominal <= p.eps.nom && maxPartida <= p.eps.max
        const paralelo = !ok ? paraleloInfoFor(p, maxNominal, maxPartida) : null
        const unidades = ok ? 1 : (paralelo?.unidades ?? Infinity)
        const viavel = ok || !!paralelo?.viavel
        return { p, unidades, viavel, custoTotal: viavel && p.preco ? p.preco * unidades : Infinity }
      })
      .filter(x => x.viavel)
      .sort((a, b) => a.custoTotal - b.custoTotal)
    return viaveis[0]?.p.id ?? null
  }, [isCBEco, invCandidatesFiltradas, maxNominal, maxPartida])

  // Com N inversores em paralelo, o limite de baterias escala junto — cada
  // unidade aceita o mesmo máximo de baterias (ficha técnica WEG), então N
  // inversores suportam N× mais baterias combinadas.
  const maxBatEfetivo = fam.maxBat != null ? fam.maxBat * invChosenQty : null
  const maxGroupsEfetivo = fam.maxGroups != null ? fam.maxGroups * invChosenQty : null

  const bestCbFit = useMemo(() => {
    if (!isCBEco) return null
    let best = null
    for (const model of BAT_CB_MODELS) {
      const qty = Math.min(maxBatEfetivo, Math.max(1, Math.ceil(kwhNecessario / model.kwh)))
      const kwhTotal = round2(qty * model.kwh)
      const atende = kwhTotal >= kwhNecessario
      const prod = products.find(p => {
        const n = (p.modelo || p.nome || '')
        return model.type === 'CB050' ? /\bCB.?050\b/i.test(n)
          : model.type === 'CB100' ? /\bCB.?100\b/i.test(n)
          : model.type === 'SBW200 CB057' ? /SBW200/i.test(n) && /057/.test(n)
          : /SBW200/i.test(n) && /115/.test(n)
      })
      const cand = { ...model, qty, kwhTotal, atende, prod }
      if (!best) { best = cand; continue }
      if (cand.atende && !best.atende) best = cand
      else if (cand.atende === best.atende && cand.qty < best.qty) best = cand
    }
    return best
  }, [isCBEco, kwhNecessario, maxBatEfetivo, products])

  const sbwQty = isSBWEco ? Math.min(maxGroupsEfetivo, Math.max(1, Math.ceil(kwhNecessario / LUNA_KWH))) : null
  const sbwKwhTotal = isSBWEco ? round2(sbwQty * LUNA_KWH) : null
  const lunaProd = isSBWEco ? products.find(p => /LUNA2000/i.test(p.modelo || p.nome || '') && /bateria/i.test(p.tipo || '')) : null
  const lunaCtrlProd = isSBWEco ? products.find(p => /LUNA2000/i.test(p.modelo || p.nome || '') && /controle/i.test(p.tipo || '')) : null
  const sgSProd = products.find(p => /SmartGuard/i.test(p.nome || p.modelo || '') && /\bS0\b/i.test(p.nome || p.modelo || ''))
  const sgTProd = products.find(p => /SmartGuard/i.test(p.nome || p.modelo || '') && /\bT0\b/i.test(p.nome || p.modelo || ''))
  const sgCtrlProd = famKey === 'SIW300H' ? sgSProd : sgTProd

  // SBW400 (SIW400H W30) — min 4 / máx 15 módulos B160 por BMS, até 3 torres
  const sbw400ModTotal = isSBW400Eco
    ? Math.min(SBW400_MAX_PER_BMS * SBW400_MAX_TOWERS, Math.max(SBW400_MIN_PER_BMS, Math.ceil(kwhNecessario / SBW400_B160_KWH)))
    : null
  const sbw400Towers = isSBW400Eco ? Math.max(1, Math.ceil(sbw400ModTotal / SBW400_MAX_PER_BMS)) : null
  const sbw400KwhTotal = isSBW400Eco ? round2(sbw400ModTotal * SBW400_B160_KWH) : null
  // Nenhum SKU cadastrado ainda — fica null até os produtos entrarem no catálogo
  const b160Prod = isSBW400Eco ? products.find(p => /^SBW400/i.test(p.modelo || p.nome || '') && /bateria/i.test(p.tipo || '')) : null
  const hvBoxProd = isSBW400Eco ? products.find(p => /^SBW400/i.test(p.modelo || p.nome || '') && /controle/i.test(p.tipo || '')) : null

  // ── Dimensionamento dos módulos FV (metodologia WEG, p.59): Pfv (kWp) =
  // consumo mensal ÷ (HSP × 30 dias × eficiência do sistema) ──
  const kwpNecessario = round2(consumoMensal / (hsp * 30 * EFICIENCIA))
  const panelOptions = useMemo(() => products.filter(p => p.kitRole === KIT_ROLE.PANEL && p.preco), [products])
  const panelProduct = panelOptions.find(p => p.id === panelId) || panelOptions[0] || null
  const panelQty = panelProduct ? Math.ceil((kwpNecessario * 1000) / panelProduct.potencia) : 0
  const panelPrecoTotal = panelProduct ? round2(panelQty * panelProduct.preco) : 0

  const batPrecoTotal = isCBEco
    ? round2((bestCbFit?.qty || 0) * (bestCbFit?.prod?.preco || 0))
    : isSBW400Eco
    ? round2((sbw400ModTotal || 0) * (b160Prod?.preco || 0) + (sbw400Towers || 0) * (hvBoxProd?.preco || 0))
    : round2((sbwQty || 0) * (lunaProd?.preco || 0) + (sgCtrlProd?.preco || 0) + (lunaCtrlProd?.preco || 0))
  const invPrecoTotal = isCBEco ? (invChosen?.preco || 0) * invChosenQty : 0
  const precoEstimadoTotal = round2(panelPrecoTotal + batPrecoTotal + invPrecoTotal)

  // ── Simulador de cenário: falta de rede ──────────────────────────────────
  // Cruza a geração solar estimada (curva simplificada 6h-18h) com o consumo
  // real das cargas críticas, hora a hora, e acompanha o SOC da bateria
  // durante a janela de falta de rede simulada — não é medição real, é uma
  // estimativa de pré-dimensionamento (ver README da metodologia).
  const bankKwh = isCBEco ? (bestCbFit?.kwhTotal || 0) : isSBW400Eco ? (sbw400KwhTotal || 0) : (sbwKwhTotal || 0)
  const kwpInstalado = panelProduct ? round2(panelQty * panelProduct.potencia / 1000) : 0
  const pvDiarioKwh = round2(kwpInstalado * hsp * EFICIENCIA)

  const energiaCriticaPorHora = useMemo(() => HOURS.map(h => round2(items.reduce((s, it) => {
    if (!it.horas[h]) return s
    return s + (it.watts / 1000) * it.qty
  }, 0))), [items])

  const pvPorHora = useMemo(() => {
    const pesos = HOURS.map(h => (h >= 6 && h < 18) ? Math.sin(Math.PI * (h - 6) / 12) : 0)
    const somaPesos = pesos.reduce((s, w) => s + w, 0) || 1
    return pesos.map(w => round2((w / somaPesos) * pvDiarioKwh))
  }, [pvDiarioKwh])

  const cenario = useMemo(() => {
    if (bankKwh <= 0) return null
    const socMin = 1 - DOD
    let soc = 1
    let esgotouEm = null
    const linha = []
    for (let i = 0; i < outageDuracao; i++) {
      const h = (outageInicio + i) % 24
      const pv = pvPorHora[h]
      const carga = energiaCriticaPorHora[h]
      const netKwh = pv - carga
      soc = Math.min(1, soc + netKwh / bankKwh)
      const isDia = h >= 6 && h < 18
      let estado = isDia ? 'FALTA_REDE_DIA' : 'FALTA_REDE_NOITE'
      if (soc <= socMin) {
        soc = socMin
        estado = 'BATERIA_RESERVA'
        if (esgotouEm === null) esgotouEm = h
      }
      linha.push({ h, soc, pv, carga, estado })
    }
    return { linha, esgotouEm, socFinal: soc }
  }, [bankKwh, outageInicio, outageDuracao, pvPorHora, energiaCriticaPorHora])

  const handleUseInKit = () => {
    const invModeloEscolhido = invChosen?.modelo || invChosen?.nome || ''
    const isTri = isCBEco
      ? /^SIW400H/i.test(invModeloEscolhido) || (!invChosen && famKey === 'SIW400H')
      : isSBW400Eco || famKey === 'SIW500H'
    const tensaoRede = isTri ? (/\bK\d/i.test(invModeloEscolhido) ? '220' : '380') : undefined

    // Mesma regra de JBW 41DC do BatteryStep (Monte seu Kit): SIW200H ≥2
    // baterias → 1 JBW; SIW400H ≥3 baterias → 1 JBW, ≥6 → 2 JBW.
    const isSIW200H = famKey === 'SIW200H'
    const isSIW400H = famKey === 'SIW400H'
    const jbwThreshold = isSIW200H ? 2 : (isSIW400H ? 3 : null)
    const batQty = bestCbFit?.qty || 0
    const jbwNeeded = isCBEco && jbwThreshold !== null && batQty >= jbwThreshold
    const jbwQty = !jbwNeeded ? 0 : (isSIW400H && batQty >= 6 ? 2 : 1)
    const jbwProd = jbwNeeded ? products.find(p => /JBW.*41DC|41DC.*JBW/i.test(p.modelo || p.nome || '')) : null

    onUseInKit?.({
      mode: 'potencia', hsp,
      clienteUF: uf || undefined,
      kitType: isTri ? 'ongrid_tri' : 'ongrid_mono',
      ...(isTri ? { tensaoRede } : {}),
      kwpDesejado: kwpNecessario,
      panel: panelProduct || undefined,
      panelQty: panelQty || undefined,
      // Se precisar de paralelismo (pico > 1 unidade), monta o mix de
      // inversores (mesmo formato do "Monte seu Kit"); senão, inversor único.
      inverter: (isCBEco && invChosenQty === 1) ? (invChosen || undefined) : undefined,
      inverters: (isCBEco && invChosenQty > 1 && invChosen) ? [{ inverter: invChosen, qty: invChosenQty }] : undefined,
      wantsBattery: true, batteryDone: true,
      batEco: isCBEco ? 'CB' : isSBW400Eco ? 'SBW400' : 'SBW300',
      batType: isCBEco ? bestCbFit?.type : isSBW400Eco ? 'SBW400' : 'SBW300',
      batQty: isCBEco ? batQty : null,
      batProduct: isCBEco ? bestCbFit?.prod : null,
      sbwGroups: isSBWEco ? sbwQty : null,
      sbwModType: null,
      sgCtrlProduct: isSBWEco ? sgCtrlProd : null,
      lunaCtrlProduct: isSBWEco ? lunaCtrlProd : null,
      luna2000Product: isSBWEco ? lunaProd : null,
      batB070Product: null,
      batCModProduct: null,
      // SBW400 (SIW400H W30) — sem SKU cadastrado ainda; campos ficam prontos
      // pra quando o inversor e a bateria B160/HV Box entrarem no catálogo.
      sbw400ModQty: isSBW400Eco ? sbw400ModTotal : null,
      sbw400Towers: isSBW400Eco ? sbw400Towers : null,
      b160Product: isSBW400Eco ? b160Prod : null,
      hvBoxProduct: isSBW400Eco ? hvBoxProd : null,
      inclJBW41DC: jbwNeeded,
      jbwQty,
      jbwProduct: jbwProd || null,
      inclBatBackup: false,
      batBackupType: null,
      sgProduct: null,
      backupBoxProduct: null,

      // Marca que esse kit veio do Estudo — guarda os dados brutos (pra
      // voltar e continuar editando o estudo) e um resumo pronto (pro PDF
      // do estudo no Resumo do Monte seu Kit, sem recalcular nada lá).
      origemEstudo: true,
      estudoSnapshot: {
        raw: { famKey, phase, items, consumoMensal, autonomiaHoras, uf, hsp, panelId, invSelectedId, outageInicio, outageDuracao },
        resumo: {
          famKey, phase, uf, hsp,
          itens: items.map(it => ({ nome: it.nome, tipo: TIPO_CARGA[it.tipo].label, watts: it.watts, qty: it.qty, horasAtivas: it.horas.filter(Boolean).length })),
          consumoMensal, energiaCriticaDiaria, energiaNormalDiaria, autonomiaHoras,
          maxNominal, maxPartida, kwhNecessario,
          bateria: isCBEco
            ? { tipo: bestCbFit?.type, qty: batQty, kwhTotal: bestCbFit?.kwhTotal, preco: batPrecoTotal, prod: bestCbFit?.prod || null }
            : { tipo: 'LUNA2000-7-E1 + Módulo de Controle + SmartGuard', qty: sbwQty, kwhTotal: sbwKwhTotal, preco: batPrecoTotal, prod: lunaProd || null },
          inversor: invChosen ? { modelo: invChosen.modelo || invChosen.nome, epsNom: invChosen.eps?.nom, epsMax: invChosen.eps?.max, preco: invChosen.preco, qty: invChosenQty, prod: invChosen } : null,
          modulo: panelProduct ? { nome: panelProduct.nome, potencia: panelProduct.potencia, qty: panelQty, kwpInstalado, kwpNecessario, preco: panelPrecoTotal, prod: panelProduct } : null,
          cenario: cenario ? {
            outageInicio, outageDuracao, esgotouEm: cenario.esgotouEm,
            linha: cenario.linha.map(l => ({ h: l.h, soc: Math.round(l.soc * 100), estado: l.estado })),
          } : null,
          precoEstimadoTotal,
          geradoEm: new Date().toISOString(),
        },
      },
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
          <Calculator size={13} /> Área de estudo
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Dimensionamento de Bateria</h1>
        <p className="text-gray-500 text-sm mt-1">
          Metodologia WEG: tipo de carga, simultaneidade horária e autonomia por dias —
          ferramenta de referência, independente do Monte seu Kit.
        </p>
      </div>

      {/* Kits padrão — porte da residência/comércio */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Kit padrão (opcional)</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {KITS_PADRAO.map(kit => (
            <button
              key={kit.nome}
              onClick={() => applyKitPadrao(kit)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                kitPadraoAtivo === kit.nome ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-bold text-gray-900">{kit.nome}</p>
              <p className="text-[11px] text-gray-400">{kit.desc}</p>
              <p className="text-[11px] text-violet-600 font-semibold mt-0.5">{kit.kwh} kWh/mês · {kit.itens.length} itens</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Preenche o consumo mensal e já monta a lista de cargas críticas típica pra esse porte — tudo
          continua editável normalmente depois (adicionar, remover, trocar watts/horário).
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Localização → HSP (horas de sol pico) — vem primeiro porque dimensiona os módulos */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estado do cliente</label>
            <select
              value={uf}
              onChange={e => handleUfChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-400"
            >
              <option value="">Selecione o estado…</option>
              {ESTADOS.map(e => <option key={e.uf} value={e.uf}>{e.uf} — {e.nome}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Preenche o HSP com a média do estado — ajuste ao lado se souber o valor exato da cidade</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">HSP — horas de sol pico (kWh/m²/dia)</label>
            <input
              type="number" min="0" step="0.1" value={hsp}
              onChange={e => setHsp(Math.max(0, Number(e.target.value) || 0))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
            />
            <p className="text-xs text-gray-400 mt-1">Padrão Brasil: {HSP_PADRAO} h — média aproximada por estado (Atlas CRESESB/INPE)</p>
          </div>
        </div>

        {/* Família do inversor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Família do inversor híbrido</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {INVERTER_FAMILIES.map(f => (
              <button
                key={f.key}
                onClick={() => setFamKey(f.key)}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                  famKey === f.key ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* SIW200H: variante de fase */}
        {famKey === 'SIW200H' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Configuração do SIW200H</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPhase('mono')}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                  phase === 'mono' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Mono 220V
              </button>
              <button
                onClick={() => setPhase('split')}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                  phase === 'split' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Split-phase 127/220V
              </button>
            </div>
            {isSplitPhase && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  Split-phase 127/220V (linha SIW200H S038-S114 W20): o inversor permite até{' '}
                  <strong>{SPLIT_PHASE_DESEQUILIBRIO_PCT}% de desequilíbrio</strong> entre as duas fases de 110V —
                  ou seja, dá pra concentrar toda a carga crítica numa única fase, desde que a soma total
                  caiba na saída EPS do modelo escolhido (ver tabela de compatibilidade abaixo).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Lista de cargas críticas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-700">Cargas críticas (backup)</label>
            <span className="text-xs text-gray-400">{energiaCriticaDiaria.toFixed(2)} kWh/dia</span>
          </div>

          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={equipBusca} onChange={e => setEquipBusca(e.target.value)}
              placeholder="Buscar equipamento…"
              className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 mb-3">
            {CATEGORIAS_EQUIP.map(cat => {
              const presetsCat = EQUIP_PRESETS.filter(p => p.categoria === cat &&
                (!equipBusca.trim() || p.nome.toLowerCase().includes(equipBusca.trim().toLowerCase())))
              if (presetsCat.length === 0) return null
              const style = CATEGORIA_STYLE[cat]
              return (
                <div key={cat} className={`group rounded-xl border p-3 transition-shadow hover:shadow-md ${style.cls}`}>
                  <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5 cursor-default">
                    <span>{style.icon}</span> {cat}
                    <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-white/70 rounded-full px-1.5 py-0.5">{presetsCat.length}</span>
                  </p>
                  <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
                    <div className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {presetsCat.map(p => (
                          <button
                            key={p.nome}
                            onClick={() => addItem(p)}
                            className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${style.chip}`}
                          >
                            {p.emoji} {p.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {equipBusca.trim() && !EQUIP_PRESETS.some(p => p.nome.toLowerCase().includes(equipBusca.trim().toLowerCase())) && (
              <p className="text-xs text-gray-400 italic sm:col-span-2">Nenhum atalho encontrado — clique em "Adicionar equipamento" abaixo pra criar um item livre.</p>
            )}
          </div>

          <div className="space-y-2">
            {items.map(it => {
              const tc = TIPO_CARGA[it.tipo]
              const horasAtivas = it.horas.filter(Boolean).length
              return (
              <div key={it.id} className={`rounded-xl border-2 ${tc.cls.split(' ').find(c => c.startsWith('border-'))} bg-white overflow-hidden`}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="text-lg shrink-0">{it.emoji}</span>
                  <input
                    type="text" value={it.nome} placeholder="Equipamento"
                    onChange={e => updateItem(it.id, { nome: e.target.value })}
                    className="flex-1 min-w-[120px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400"
                  />
                  <select
                    value={it.tipo}
                    onChange={e => updateItem(it.id, { tipo: e.target.value })}
                    className={`text-xs font-semibold rounded-lg px-2 py-1.5 border ${tc.cls}`}
                  >
                    {Object.entries(TIPO_CARGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input
                    type="number" min="0" step="10" value={it.watts} placeholder="W"
                    onChange={e => updateItem(it.id, { watts: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-xs text-gray-400">W ×</span>
                  <input
                    type="number" min="1" step="1" value={it.qty}
                    onChange={e => updateItem(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-12 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-xs text-gray-400">início</span>
                  <input
                    type="number" min="0" max="23" value={it.inicio}
                    onChange={e => updateItem(it.id, { inicio: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                    className="w-14 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-xs text-gray-400">h, dura</span>
                  <input
                    type="number" min="0" max="24" step="0.5" value={it.duracao}
                    onChange={e => updateItem(it.id, { duracao: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
                    className="w-14 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-xs text-gray-400">h ({horasAtivas}h/dia)</span>
                  <button onClick={() => toggleGrade(it.id)} className="text-[11px] font-semibold text-violet-600 hover:underline shrink-0">
                    {it.gradeAberta ? 'Ocultar grade' : 'Ajustar grade horária'}
                  </button>
                  <button onClick={() => removeItem(it.id)} className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors ml-auto">
                    <X size={14} />
                  </button>
                </div>
                {it.gradeAberta && (
                  <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-12 gap-1">
                      {HOURS.map(h => (
                        <button
                          key={h}
                          onClick={() => toggleHora(it.id, h)}
                          title={`${h}h`}
                          className={`h-6 rounded text-[9px] font-bold flex items-center justify-center transition-colors ${
                            it.horas[h] ? 'bg-violet-500 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:border-violet-300'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">Clique nas horas pra ligar/desligar manualmente (ex: ar-condicionado que liga e desliga ao longo do dia).</p>
                  </div>
                )}
              </div>
              )
            })}
          </div>

          <button
            onClick={() => addItem()}
            className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700"
          >
            <Plus size={14} /> Adicionar equipamento
          </button>
        </div>

        {/* Dimensionamento dos módulos FV — consumo mensal só influencia isto,
            não afeta bateria/inversor (que dependem só das cargas críticas) */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Sun size={14} className="text-yellow-500" /> Dimensionamento dos módulos (FV)
          </p>
          <p className="text-[11px] text-gray-400 mb-3">Afeta só a quantidade de módulos — não influencia a bateria nem o inversor, que dependem só das cargas críticas acima.</p>

          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Consumo mensal total (kWh/mês)</label>
          <input
            type="number" min="0" step="10" value={consumoMensal}
            onChange={e => setConsumoMensal(Math.max(0, Number(e.target.value) || 0))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
          />

          {consumoMensal > 0 && (
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-center">
                <p className="text-[9px] text-gray-400 uppercase font-semibold">Consumo/dia</p>
                <p className="text-sm font-bold text-gray-700">{energiaDiariaTotal.toFixed(2)} kWh</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-center">
                <p className="text-[9px] text-gray-400 uppercase font-semibold">Potência média</p>
                <p className="text-sm font-bold text-gray-700">{(energiaDiariaTotal / 24).toFixed(2)} kW</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-center">
                <p className="text-[9px] text-gray-400 uppercase font-semibold">Normais (não backup)</p>
                <p className="text-sm font-bold text-gray-700">{energiaNormalDiaria.toFixed(2)} kWh</p>
              </div>
            </div>
          )}

          {kwpNecessario > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <Sun size={16} className="text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-yellow-900">{kwpNecessario.toFixed(2)} kWp necessário{panelProduct && ` — ${panelQty}× ${panelProduct.nome}`}</p>
                  <p className="text-[10px] text-yellow-700">HSP {hsp}h/dia × 30 dias × {(EFICIENCIA*100).toFixed(0)}% eficiência{panelProduct?.preco ? ` · ${fmt(panelPrecoTotal)}` : ''}</p>
                </div>
              </div>
              {panelOptions.length > 0 && (
                <select
                  value={panelProduct?.id ?? ''}
                  onChange={e => setPanelId(Number(e.target.value))}
                  className="w-full text-xs border border-yellow-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-500"
                >
                  {panelOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} — {p.potencia} Wp{p.preco ? ` · ${fmt(p.preco)}/un` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Autonomia da bateria — essa sim influencia direto o dimensionamento da bateria/inversor */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Battery size={14} className="text-violet-500" /> Autonomia da bateria
          </p>
          <p className="text-[11px] text-gray-400 mb-3">Essa sim entra direto na conta de kWh de bateria e na escolha do inversor, mais abaixo.</p>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Autonomia desejada (horas)</label>
          <input
            type="number" min="0" step="1" value={autonomiaHoras}
            onChange={e => setAutonomiaHoras(Math.max(0, Number(e.target.value) || 0))}
            className="w-full sm:w-48 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400"
          />
          <p className="text-xs text-gray-400 mt-1">Por quantas horas sem rede a bateria deve suprir as cargas críticas</p>
        </div>

        {/* Pico simultâneo */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pico nominal simultâneo</p>
            <p className="text-2xl font-extrabold text-gray-800">{fmtKw(maxNominal)} kW</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pico de partida simultâneo</p>
            <p className="text-2xl font-extrabold text-gray-800">{fmtKw(maxPartida)} kW</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2">
          Soma, hora a hora, a potência "percebida" pelo inversor (nominal × e partida ×, conforme o
          tipo de carga) de todos os equipamentos ligados naquele horário — o maior valor entre as 24h
          é o que precisa caber na saída EPS do inversor, não a soma total de todos os equipamentos.
        </p>

        {/* Cenários específicos por hábito de uso */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Cenários por hábito de uso</p>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">☀️ Diurno (6h-18h)</p>
              <p className="text-lg font-extrabold text-gray-800 mt-0.5">{fmtKw(cenariosUso.diurno.nom)} kW</p>
              <p className="text-[10px] text-gray-500">partida {fmtKw(cenariosUso.diurno.par)} kW</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1">🌙 Noturno (18h-6h)</p>
              <p className="text-lg font-extrabold text-gray-800 mt-0.5">{fmtKw(cenariosUso.noturno.nom)} kW</p>
              <p className="text-[10px] text-gray-500">partida {fmtKw(cenariosUso.noturno.par)} kW</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide flex items-center gap-1">⚠️ Pico absoluto (tudo ligado)</p>
              <p className="text-lg font-extrabold text-gray-800 mt-0.5">{fmtKw(cenariosUso.absoluto.nom)} kW</p>
              <p className="text-[10px] text-gray-500">partida {fmtKw(cenariosUso.absoluto.par)} kW</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            <strong>Diurno/Noturno</strong>: pico real dentro de cada período, pelos horários informados — útil pra saber o
            quanto a bateria precisa segurar sozinha à noite, sem ajuda do FV. <strong>Pico absoluto</strong>: soma de todos os
            equipamentos cadastrados como se ligassem ao mesmo tempo — cenário hipotético de pior caso, ignora os horários.
          </p>
        </div>

        <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-5 text-center space-y-1">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide">kWh de bateria necessário</p>
          <p className="text-3xl font-extrabold text-violet-700">{kwhNecessario.toFixed(2)} kWh</p>
          <p className="text-xs text-gray-400">{energiaCriticaDiaria.toFixed(2)} kWh/dia × {autonomiaHoras}h/24h ÷ {(DOD*100).toFixed(0)}% DoD</p>
        </div>

        {kwhNecessario > 0 && (
          <div className="bg-white border border-violet-200 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-sm text-violet-900 flex items-center gap-1.5">
              <Battery size={15} /> Sugestão para {fam.label}{famKey === 'SIW200H' ? ` (${phase === 'split' ? 'Split 127/220V' : 'Mono 220V'})` : ''}
              {isCBEco && invChosenQty > 1 && <span className="text-xs font-normal text-violet-500">— {invChosenQty}× em paralelo</span>}
            </p>

            {isCBEco && bestCbFit && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={getProductImage(bestCbFit.prod || { nome: bestCbFit.type })} alt={bestCbFit.type}
                    className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{bestCbFit.qty}× {bestCbFit.type}</p>
                  <p className="text-xs text-gray-500">{bestCbFit.kwhTotal.toFixed(2)} kWh total{bestCbFit.prod?.preco ? ` · ${fmt(bestCbFit.prod.preco)}/un` : ''}</p>
                  {invChosenQty > 1 && (
                    <p className="text-[10px] text-violet-500">Capacidade escalada pra {invChosenQty} inversores em paralelo (máx. {maxBatEfetivo} baterias combinadas)</p>
                  )}
                </div>
                {!bestCbFit.atende && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 shrink-0">
                    máx. {maxBatEfetivo} baterias — não cobre 100%
                  </span>
                )}
              </div>
            )}

            {isSBWEco && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={getProductImage(lunaProd || { nome: 'LUNA2000' })} alt="LUNA2000"
                      className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{sbwQty}× LUNA2000-7-E1</p>
                    <p className="text-xs text-gray-500">{sbwKwhTotal.toFixed(2)} kWh total{lunaProd?.preco ? ` · ${fmt(lunaProd.preco)}/módulo` : ''}</p>
                  </div>
                  {sbwKwhTotal < kwhNecessario && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 shrink-0">
                      máx. {maxGroupsEfetivo} módulos — não cobre 100%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Info size={11} className="shrink-0" />
                  Controlador obrigatório: SmartGuard-63A-{famKey === 'SIW300H' ? 'S0' : 'T0'}{sgCtrlProd?.preco ? ` (${fmt(sgCtrlProd.preco)})` : ''}
                </p>
              </div>
            )}

            {isSBW400Eco && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={getProductImage(b160Prod || { nome: 'SBW400 B160' })} alt="SBW400 B160"
                      className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{sbw400ModTotal}× SBW400 B160 W00</p>
                    <p className="text-xs text-gray-500">
                      {sbw400KwhTotal.toFixed(2)} kWh total em {sbw400Towers} torre{sbw400Towers > 1 ? 's' : ''}
                      {b160Prod?.preco ? ` · ${fmt(b160Prod.preco)}/módulo` : ''}
                    </p>
                  </div>
                  {sbw400KwhTotal < kwhNecessario && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 shrink-0">
                      máx. 3 torres (45 módulos) — não cobre 100%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Info size={11} className="shrink-0" />
                  {sbw400Towers}× HV Box (BMS) obrigatório — 1 por torre, 4 a 15 módulos cada{hvBoxProd?.preco ? ` (${fmt(hvBoxProd.preco)}/un)` : ''}
                </p>
                {(!b160Prod || !hvBoxProd) && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    SIW400H W30, SBW400 B160 W00 e HV Box ainda não estão cadastrados no catálogo — preço estimado indisponível até lançar os produtos.
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
              Essa sugestão é só de referência — ao montar o kit em "Monte seu Kit", o modelo e a quantidade de bateria continuam sendo escolhidos manualmente no passo Bateria.
            </p>
          </div>
        )}

        {/* Sistema além do limite da linha — nem com paralelismo/baterias no máximo permitido cobre */}
        {(invAlemDoLimite || (bestCbFit && !bestCbFit.atende) || (isSBWEco && sbwQty !== null && sbwKwhTotal < kwhNecessario) || (isSBW400Eco && sbw400KwhTotal < kwhNecessario)) && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Sistema além do planejado para esta linha</p>
              <p className="text-xs text-red-700 mt-1">
                {invAlemDoLimite && `Nem com o máximo de 4 inversores em paralelo o pico calculado (${fmtKw(maxNominal)}/${fmtKw(maxPartida)} kW) cabe na saída EPS desta família. `}
                {bestCbFit && !bestCbFit.atende && `O kWh necessário (${kwhNecessario.toFixed(2)} kWh) excede a capacidade máxima combinada de baterias desta linha. `}
                {isSBWEco && sbwQty !== null && sbwKwhTotal < kwhNecessario && `O kWh necessário (${kwhNecessario.toFixed(2)} kWh) excede o máximo de módulos LUNA2000 permitido para esta família. `}
                {isSBW400Eco && sbw400KwhTotal < kwhNecessario && `O kWh necessário (${kwhNecessario.toFixed(2)} kWh) excede o máximo de 3 torres SBW400 (720 kWh) desta família. `}
                <strong>Consulte seu representante técnico WEG</strong> para avaliar uma solução sob medida — ex: dividir em
                quadros EPS independentes, outra linha de inversor (SIW400G/SIW610) ou projeto especial.
              </p>
            </div>
          </div>
        )}

        {/* Simulador de C-rate (didático) — nunca sobrescreve a sugestão de bateria acima */}
        {bankKwh > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="font-semibold text-sm text-gray-800 mb-1 flex items-center gap-1.5">
              Simulador de C-rate
              <span className="relative inline-flex group">
                <HelpCircle size={14} className="text-gray-300 cursor-help shrink-0" />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  C-rate é a taxa relativa de carga/descarga de uma bateria em relação à sua capacidade nominal.
                  Ex: 1C descarrega 100% da energia em 1h; 0,5C em 2h; 0,3C em ~3h20. Potência teórica (kW) =
                  Energia nominal (kWh) × C-rate. Não é fator de potência nem tensão — é só a relação energia/tempo.
                </span>
              </span>
            </p>
            <p className="text-[11px] text-gray-400 mb-3">
              Mostra a potência contínua teórica do banco sugerido ({bankKwh.toFixed(2)} kWh) em diferentes taxas C — não muda a quantidade de bateria sugerida acima.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[0.3, 0.5, 1].map(c => (
                <button
                  key={c}
                  onClick={() => setCRate(c)}
                  className={`rounded-xl border-2 py-2 text-sm font-bold transition-all ${
                    cRate === c ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {c}C
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Potência teórica CC</p>
                <p className="text-lg font-extrabold text-gray-800">{(bankKwh * cRate).toFixed(2)} kW</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Tempo ideal (100%)</p>
                <p className="text-lg font-extrabold text-gray-800">{formatHorasMin(1 / cRate)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Tempo ideal ({(DOD * 100).toFixed(0)}% DoD)</p>
                <p className="text-lg font-extrabold text-gray-800">{formatHorasMin(DOD / cRate)}</p>
              </div>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                <strong>Simulação teórica</strong>, sem perdas e sem limite de SoC/temperatura. A taxa C escolhida aqui <strong>não é uma
                especificação operacional confirmada</strong> deste modelo — verifique datasheet, BMS, topologia e limites de conexão
                antes de emitir proposta técnica. O 0,3C que aparece na ficha WEG (SBW CB050/CB100, p.64) é a condição do{' '}
                <strong>ensaio de vida útil</strong> (&gt;6000 ciclos, 70% SoH, 90% DoD) — não é a taxa máxima de descarga.
              </p>
            </div>
          </div>
        )}

        {/* Compatibilidade de inversor por potência EPS — reage à família/fase escolhidas acima */}
        {isCBEco && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="font-semibold text-sm text-gray-800 mb-1">
              Compatibilidade de EPS — {famKey}{famKey === 'SIW200H' ? ` ${phase === 'split' ? 'Split 127/220V' : 'Mono 220V'}` : ''} ativos no catálogo
            </p>
            <p className="text-[11px] text-gray-400 mb-3">Clique num modelo pra escolher qual usar no "Usar esse dimensionamento" — por padrão, o primeiro ✓ já vem selecionado.</p>
            {invCandidatesFiltradas.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum modelo {famKey}{famKey === 'SIW200H' ? ` ${phase === 'split' ? 'Split-phase' : 'Mono'}` : ''} publicado na lista de preços ativa.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              {invCandidatesFiltradas.map(p => {
                const ok = maxNominal <= p.eps.nom && maxPartida <= p.eps.max
                const selected = invChosen?.id === p.id
                const paralelo = !ok ? paraleloInfoFor(p, maxNominal, maxPartida) : null
                const unidades = ok ? 1 : (paralelo?.unidades || 0)
                const custoTotal = p.preco ? p.preco * unidades : 0
                const isMelhor = p.id === invMelhorId
                return (
                  <button
                    key={p.id}
                    onClick={() => setInvSelectedId(p.id)}
                    className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      selected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                        : isMelhor ? 'border-green-400 bg-green-50 hover:border-green-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isMelhor && (
                      <span className="absolute -top-2 left-3 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                        ✓ Melhor custo-benefício
                      </span>
                    )}
                    <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={getProductImage(p)} alt={p.modelo || p.nome}
                        className="max-w-full max-h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{p.modelo || p.nome}</p>
                      <p className="text-xs text-gray-500">EPS {p.eps.nom}/{p.eps.max} kVA{p.preco ? ` · ${fmt(p.preco)}/un` : ''}</p>
                      {paralelo && (
                        paralelo.viavel
                          ? <p className="text-[10px] text-blue-600 font-semibold mt-0.5">⚡ {paralelo.unidades}× em paralelo (máx. {paralelo.maxParalelo})</p>
                          : <p className="text-[10px] text-red-500 font-semibold mt-0.5">Precisaria de {paralelo.unidades}× — excede paralelismo máx. ({paralelo.maxParalelo})</p>
                      )}
                      {custoTotal > 0 && (unidades > 1 || isMelhor) && (
                        <p className={`text-[10px] font-bold mt-0.5 ${isMelhor ? 'text-green-700' : 'text-gray-500'}`}>Total: {fmt(custoTotal)}{unidades > 1 ? ` (${unidades} un.)` : ''}</p>
                      )}
                    </div>
                    {ok
                      ? <Check size={16} className="text-green-600 shrink-0" />
                      : (paralelo?.viavel
                          ? <Info size={16} className="text-blue-500 shrink-0" />
                          : <X size={16} className="text-red-500 shrink-0" />)}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              ✓/✗ compara o pico nominal/partida simultâneo das cargas críticas contra a saída EPS de cada modelo
              realmente publicado na lista de preços ativa. Quando uma unidade não cobre sozinha, sugere quantas em
              paralelo seriam necessárias — até o limite de 4 unidades no modo híbrido/off-grid (ficha técnica WEG).
              O selo verde <strong>"Melhor custo-benefício"</strong> marca o modelo com o menor custo total (preço ×
              unidades necessárias) entre os que atendem o pico, técnico e financeiro ao mesmo tempo.
            </p>
          </div>
        )}

        {/* Simulador de cenário: falta de rede */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="font-semibold text-sm text-gray-800 mb-1">Simulador de cenário — falta de rede</p>
          <p className="text-[11px] text-gray-400 mb-3">
            Cruza a geração solar estimada (curva simplificada 6h–18h) com o consumo das cargas críticas, hora a
            hora, e acompanha o SOC (estado de carga) da bateria — é uma estimativa de pré-dimensionamento, não uma medição real.
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Falta de rede a partir de</label>
              <input
                type="number" min="0" max="23" value={outageInicio}
                onChange={e => setOutageInicio(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-violet-400"
              />
              <span className="text-xs text-gray-400 ml-1">h</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duração</label>
              <input
                type="number" min="1" max="48" value={outageDuracao}
                onChange={e => setOutageDuracao(Math.min(48, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-violet-400"
              />
              <span className="text-xs text-gray-400 ml-1">h</span>
            </div>
            {kwpInstalado > 0 && (
              <p className="text-[11px] text-gray-400">FV instalado: {kwpInstalado.toFixed(2)} kWp · {pvDiarioKwh.toFixed(2)} kWh/dia estimado</p>
            )}
          </div>

          {!cenario && (
            <p className="text-xs text-gray-400 italic">Adicione cargas críticas e escolha uma família com bateria sugerida pra ver a simulação.</p>
          )}

          {cenario && (
            <>
              {cenario.esgotouEm !== null && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    O banco de baterias chega na reserva (DoD) por volta das <strong>{cenario.esgotouEm}h</strong> —
                    não cobre as {outageDuracao}h de falta de rede simuladas com essa quantidade de bateria.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <div className="flex gap-1 min-w-max pb-1">
                  {cenario.linha.map(({ h, soc, estado }) => {
                    const cls = estado === 'BATERIA_RESERVA'
                      ? 'bg-red-500'
                      : estado === 'FALTA_REDE_DIA' ? 'bg-amber-400' : 'bg-indigo-500'
                    return (
                      <div key={h} className="flex flex-col items-center gap-1 w-10 shrink-0">
                        <div className="w-full h-16 bg-gray-100 rounded-md relative overflow-hidden flex items-end">
                          <div className={`w-full ${cls} transition-all`} style={{ height: `${Math.round(soc * 100)}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-400">{h}h</span>
                        <span className="text-[9px] font-bold text-gray-600">{Math.round(soc * 100)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Dia (PV ativo)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Noite (só bateria)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Reserva (DoD) atingida</span>
              </div>
            </>
          )}
        </div>

        {/* Preço estimado + ação final */}
        <div className="bg-[#1B3A8A] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">Preço estimado (tabela)</p>
            <p className="text-white text-2xl font-extrabold">{fmt(precoEstimadoTotal)}</p>
            <p className="text-white/50 text-[11px] mt-0.5">
              Módulos {fmt(panelPrecoTotal)} + Bateria {fmt(batPrecoTotal)}{isCBEco && invChosen ? ` + Inversor ${fmt(invPrecoTotal)}` : ''}
            </p>
          </div>
          <button
            onClick={handleUseInKit}
            className="btn-primary bg-weg-orange hover:bg-weg-orange/90 px-6 py-3 flex items-center gap-2 font-bold shrink-0"
          >
            Usar esse dimensionamento <ArrowRight size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center -mt-3">
          Abre o Monte seu Kit com módulo, inversor e bateria já pré-selecionados — você continua podendo ajustar tudo normalmente nos próximos passos.
        </p>
      </div>
    </div>
  )
}
