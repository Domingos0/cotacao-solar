import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { CATEGORIES, KIT_ROLE, assignKitRole, products as defaultProducts, fixedProducts } from '../data/products'
import {
  getNotifySettings, saveNotifySettings, sendWhatsApp, sendEmail,
  notifyClienteApproved, notifyDescontoAprovado, notifyDescontoRecusado,
} from '../lib/notify'
import {
  LogOut, Plus, Trash2, Edit3, Check, X, RefreshCw,
  Printer, Search, ChevronDown, ChevronUp, AlertTriangle, Save,
  FileText, Shield, Download, ArrowUpFromLine, Info, Truck,
  Users, Package, LayoutList, Clock, CheckCircle2, XCircle,
  BadgePercent, Bell, MessageCircle, Mail, Eye, EyeOff,
  TrendingUp, Zap, Sun, DollarSign, Activity,
  Lock, UserCheck, UserX, Building2, Phone, AtSign, CalendarDays,
} from 'lucide-react'

const ALL_CATEGORIES = Object.values(CATEGORIES)

const EMPTY_PRODUCT = {
  nome: '', codigo: '', modelo: '', categoria: CATEGORIES.MODULOS,
  tipo: '', fabricante: 'WEG', potencia: '', unidadePotencia: 'kW',
  tensao: '', fase: '', preco: '', estoque: 'Disponível', descricao: '',
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (onLogin(pw)) {
      setError(false)
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPw('')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-8 ${shake ? 'animate-bounce' : ''}`}>
        <div className="flex flex-col items-center mb-6">
          <div className="bg-weg-blue rounded-full w-16 h-16 flex items-center justify-center mb-3">
            <Shield size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Área Administrativa</h2>
          <p className="text-gray-400 text-sm mt-1">WEG Solar — Gestão de Catálogo</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha de acesso</label>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false) }}
              placeholder="••••••••"
              autoFocus
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                error ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-weg-blue'
              }`}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Senha incorreta
              </p>
            )}
          </div>
          <button type="submit" className="w-full btn-primary py-3 flex items-center justify-center gap-2">
            <Lock size={16} /> Entrar
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-4">Senha padrão: WEG@2025</p>
      </div>
    </div>
  )
}

// ─── Excel Parser ─────────────────────────────────────────────────────────────
// Planilha "Composição Preços" — estrutura de colunas (0-indexado):
//   A[0] = Nome do produto        B[1] = Tipo/Descrição
//   C[2] = Item SAP               D[3] = Preço Unitário (R$)
//   E[4] = Unitário c/ Frete      F[5] = Potência (Wp ou kW)
//   G[6] = R$/Wp ou Disjuntor     H[7] = Fabricante ou Entradas
//   I[8] = Área ou Garantia
// Linha de cabeçalho de seção: row[0]=nome da seção, row[2]="Item SAP" (texto)
// Linha de produto: row[2]=código SAP numérico (7-8 dígitos)

function mapSectionToCategory(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('módulo') || n.includes('modulo'))    return CATEGORIES.MODULOS
  if (n.includes('bombeamento'))                        return CATEGORIES.INVERSORES_BOMBEAMENTO
  if (n.includes('inversor') || n.includes('acessório') || n.includes('acessorio')) return '__INV__'
  if (n.includes('smart home'))                         return CATEGORIES.SMART_HOME
  if (n.includes('bater'))                              return CATEGORIES.BATERIAS
  if (n.includes('recarga') || n.includes('elétrico'))  return CATEGORIES.ESTACOES_RECARGA
  if (n.includes('mc4') || n.includes('cabo cc') || n.includes('conector')) return CATEGORIES.CABOS_CONECTORES
  if (n.includes('avulso'))                             return CATEGORIES.ESTRUTURAS_AVULSOS
  if (n.includes('estrutura'))                          return CATEGORIES.ESTRUTURAS
  if (n.includes('proteç') || n.includes('protec'))     return CATEGORIES.PROTECAO
  if (n.includes('monitor'))                            return CATEGORIES.MONITORAMENTO
  if (n.includes('otimizador'))                         return CATEGORIES.OTIMIZADOR
  if (n.includes('capacitor') || n.includes('banco'))   return CATEGORIES.CAPACITORES
  return name
}

function mapInversorCat(tipo) {
  if (!tipo) return null
  const t = tipo.toLowerCase()
  if (/micro[\s-]?inversor/i.test(t))           return CATEGORIES.MICROINVERSORES
  if (/monof[áa]sico/i.test(t))                 return CATEGORIES.INVERSORES_MONO
  if (/trif[áa]sico/i.test(t))                  return CATEGORIES.INVERSORES_TRI
  if (/bombeamento|bomba/i.test(t))              return CATEGORIES.INVERSORES_BOMBEAMENTO
  if (/monitoramento/i.test(t))                  return CATEGORIES.MONITORAMENTO
  if (/otimizador/i.test(t))                     return CATEGORIES.OTIMIZADOR
  if (/controlador|cabine|multimedidor|quadro de transfer/i.test(t)) return CATEGORIES.BATERIAS
  return null
}

// Tenta extrair número de uma célula (string "R$ 1.370,36" ou número 1370.36)
function toNum(cell) {
  if (cell == null) return NaN
  if (typeof cell === 'number') return cell
  const s = String(cell).replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s)
}

function parseComposicaoPrecos(workbook) {
  // Localiza a aba pelo nome
  const sheetName = workbook.SheetNames.find(n =>
    /composição|composicao|composiçao/i.test(n)
  ) || workbook.SheetNames.find(n => n.toLowerCase().includes('preço') || n.toLowerCase().includes('preco'))
  if (!sheetName) throw new Error(`Aba "Composição Preços" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`)

  const sheet = workbook.Sheets[sheetName]
  // raw:false converte datas e strings com R$; usamos raw:true para números puros
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })

  const products = []
  let currentCat = ''
  let tableName = null
  let nextId = Date.now()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const colA = row[0]?.toString().trim() || ''
    const colC = row[2]?.toString().trim() || ''

    // ── Cabeçalho de seção: coluna C contém "Item SAP" (texto literal) ──
    if (/^item\s+sap$/i.test(colC)) {
      currentCat = mapSectionToCategory(colA)
      // Tenta capturar o nome da tabela em colunas à direita (col I-N)
      if (!tableName) {
        for (let ci = 8; ci <= 16; ci++) {
          const v = row[ci]?.toString().trim()
          if (v && v.length > 5 && /lista|tabela|\d{4}|R\d|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(v)) {
            tableName = v; break
          }
        }
      }
      continue
    }

    // ── Linha de produto: coluna C é código SAP numérico ──
    const sapRaw = row[2]
    if (sapRaw == null) continue
    const sapNum = typeof sapRaw === 'number' ? sapRaw : parseFloat(String(sapRaw).replace(/\D/g, ''))
    if (isNaN(sapNum) || sapNum <= 0) continue
    const sap = Math.round(sapNum).toString()
    if (sap.length < 7 || sap.length > 9) continue  // SAP WEG = 7-8 dígitos

    if (!colA) continue  // sem nome, pula

    const tipo  = row[1]?.toString().trim() || ''
    const preco = toNum(row[3])
    if (isNaN(preco) || preco <= 0) continue

    // Pula linhas de preço por Wp/Wc (estrutura solo): preço < 5 → R$/unidade
    if (preco < 5) continue

    const precoFrete = toNum(row[4])
    const potRaw     = typeof row[5] === 'number' ? row[5] : toNum(row[5])
    const potencia   = !isNaN(potRaw) && potRaw > 0 ? potRaw : null

    // Resolve categoria final
    let cat = currentCat
    const isInvSection = currentCat === '__INV__' || currentCat === CATEGORIES.INVERSORES_BOMBEAMENTO
    if (cat === '__INV__') {
      cat = mapInversorCat(tipo) || CATEGORIES.INVERSORES_MONO
    }
    if (!cat) cat = 'Outros'

    // Unidade de potência
    const unidPot = cat === CATEGORIES.MODULOS        ? 'Wp'
                  : cat === CATEGORIES.CAPACITORES     ? 'kVAr'
                  : potencia                           ? 'kW' : ''

    // Col G (row[6]): Disjuntor Eq. para inversores / R$/Wp para módulos
    const colG = row[6]?.toString().trim() || ''

    // Col H (row[7]): Entradas (numérico) para inversores / Fabricante (texto) para módulos
    const colH = row[7]?.toString().trim() || ''
    const colHNum = parseFloat(colH)
    const isInversor = [CATEGORIES.INVERSORES_MONO, CATEGORIES.INVERSORES_TRI,
                        CATEGORIES.MICROINVERSORES, CATEGORIES.INVERSORES_BOMBEAMENTO].includes(cat)

    const entradas  = (isInversor && !isNaN(colHNum) && colHNum > 0 && colHNum < 100) ? Math.round(colHNum) : null
    const disjuntor = (isInversor && /^(MDWP|MDWH|DWB|FUSIVEL)/i.test(colG)) ? colG : null
    const fabricante = (!isInversor && !/^\d+$/.test(colH) && colH) ? colH : 'WEG'

    const produto = {
      id:              nextId++,
      codigo:          sap,
      nome:            colA,
      modelo:          colA,
      categoria:       cat,
      tipo,
      fabricante,
      potencia,
      unidadePotencia: unidPot,
      preco:           Math.round(preco * 100) / 100,
      precoFrete:      Math.round((!isNaN(precoFrete) && precoFrete > 0 ? precoFrete : preco) * 100) / 100,
      estoque:         'Disponível',
      descricao:       [tipo, potencia ? `${potencia} ${unidPot}` : ''].filter(Boolean).join(' — '),
      specs:           { ...(potencia ? { Potência: `${potencia} ${unidPot}` } : {}), Tipo: tipo },
    }
    if (entradas  != null) produto.entradas  = entradas
    if (disjuntor != null) produto.disjuntor = disjuntor

    // kitRole atribuído dinamicamente (igual ao products.js)
    produto.kitRole = assignKitRole(produto)

    products.push(produto)
  }

  if (products.length === 0) {
    // Diagnóstico: mostra primeiras linhas para debug
    const sample = rows.slice(0, 10).map((r, i) => `[${i}] C=${r?.[2]} A=${r?.[0]}`).join('\n')
    throw new Error(`Nenhum produto encontrado. Verifique se a aba é "Composição Preços".\n\nPrimeiras linhas:\n${sample}`)
  }

  return { products, tableName }
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const [step, setStep]       = useState('pick')   // pick | preview | done
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed]   = useState(null)      // { products, tableName }
  const [mode, setMode]       = useState('prices')  // 'prices' | 'full'
  const fileRef               = useRef()

  const handleFile = async (file) => {
    if (!file) return
    setError(null); setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const result = parseComposicaoPrecos(wb)
      if (result.products.length === 0) throw new Error('Nenhum produto encontrado na planilha.')
      setParsed(result)
      setStep('preview')
    } catch (e) {
      setError(e.message || 'Erro ao ler o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleConfirm = () => {
    if (!parsed) return
    onImport(parsed, mode)
    setStep('done')
  }

  // Stats for preview
  const stats = useMemo(() => {
    if (!parsed) return null
    const cats = {}
    parsed.products.forEach(p => { cats[p.categoria] = (cats[p.categoria] || 0) + 1 })
    return { total: parsed.products.length, cats }
  }, [parsed])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-weg-blue text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2 text-lg">
            <ArrowUpFromLine size={20} /> Importar Nova Tabela de Preços
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20"><X size={18} /></button>
        </div>

        <div className="p-6">
          {/* STEP: pick file */}
          {step === 'pick' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Selecione o arquivo <strong>.xlsx</strong> da tabela WEG. O sistema vai ler a aba
                <code className="mx-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">Composição Preços</code>
                e extrair todos os produtos com código SAP e preço.
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-weg-blue/40 rounded-2xl p-10 text-center cursor-pointer hover:border-weg-blue hover:bg-blue-50 transition-all group"
              >
                <div className="text-5xl mb-3">📊</div>
                <p className="font-semibold text-gray-700 group-hover:text-weg-blue">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="text-sm text-gray-400 mt-1">Formatos aceitos: .xlsx, .xls</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-3 py-4 text-weg-blue">
                  <div className="w-5 h-5 border-2 border-weg-blue border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Lendo planilha…</span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-2 text-sm text-blue-800">
                <Info size={15} className="shrink-0 mt-0.5 text-weg-blue" />
                <span>O arquivo não precisa ter todas as abas — apenas <strong>Composição Preços</strong> é lida.</span>
              </div>
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && parsed && stats && (
            <div className="space-y-5">
              {/* File result */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={18} className="text-green-600" />
                  <span className="font-bold text-green-800">Planilha lida com sucesso</span>
                </div>
                {parsed.tableName && (
                  <p className="text-sm text-green-700">
                    Tabela detectada: <strong>{parsed.tableName}</strong>
                  </p>
                )}
                <p className="text-sm text-green-700 mt-0.5">
                  <strong>{stats.total} produtos</strong> encontrados na aba Composição Preços
                </p>
              </div>

              {/* Category breakdown */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produtos por categoria</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(stats.cats).sort(([,a],[,b]) => b-a).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-gray-600 truncate">{cat}</span>
                      <span className="font-bold text-weg-blue ml-2 shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import mode */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modo de importação</p>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'prices' ? 'border-weg-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="mode" value="prices" checked={mode === 'prices'} onChange={() => setMode('prices')} className="mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Atualizar apenas preços</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Produtos já cadastrados têm seus preços atualizados. Produtos novos são adicionados. Edições manuais de outros campos são preservadas.
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'full' ? 'border-weg-orange bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} className="mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                        Substituir catálogo completo
                        <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full font-semibold">Atenção</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Todo o catálogo é substituído pelos dados da planilha. Produtos adicionados manualmente serão removidos.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={handleConfirm} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                  <ArrowUpFromLine size={16} /> Confirmar importação
                </button>
                <button onClick={() => { setStep('pick'); setParsed(null) }} className="btn-outline px-5 py-3">
                  Voltar
                </button>
              </div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Tabela importada com sucesso!</h3>
              <p className="text-gray-500 text-sm">
                {stats?.total} produtos foram carregados no catálogo.
              </p>
              <button onClick={onClose} className="btn-primary px-8 py-3">
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Table Info Editor ────────────────────────────────────────────────────────
function TableInfoEditor({ tableInfo, onSave, onImportClick }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(tableInfo)

  const submit = () => {
    onSave(form)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="bg-weg-blue text-white rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-0.5">Tabela de Preços Ativa</p>
          <h2 className="text-lg font-bold">{tableInfo.nome}</h2>
          {tableInfo.observacao && (
            <p className="text-white/60 text-xs mt-0.5">{tableInfo.observacao}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onImportClick}
            className="flex items-center gap-1.5 bg-weg-orange hover:bg-weg-orange-dark border border-white/20 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            <ArrowUpFromLine size={15} /> Importar nova tabela
          </button>
          <button
            onClick={() => { setForm(tableInfo); setEditing(true) }}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Edit3 size={14} /> Editar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-weg-blue rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FileText size={16} className="text-weg-blue" /> Editar Informações da Tabela
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome da tabela</label>
          <input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            placeholder="Ex: Lista Dezembro 2025 R0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mês/Ano</label>
          <input
            type="month"
            value={form.mes}
            onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Versão</label>
          <input
            value={form.versao}
            onChange={e => setForm(f => ({ ...f, versao: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            placeholder="R0, R1..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Observação</label>
          <input
            value={form.observacao}
            onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            placeholder="Ex: Preços FOB Itajaí-SC..."
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={submit} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
          <Save size={14} /> Salvar
        </button>
        <button onClick={() => setEditing(false)} className="btn-outline px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Inline edit row ──────────────────────────────────────────────────────────
function ProductRow({ product, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(product)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    onUpdate(product.id, {
      ...form,
      preco: form.preco === '' || form.preco === null ? null : parseFloat(form.preco),
      potencia: form.potencia === '' ? null : parseFloat(form.potencia),
    })
    setEditing(false)
  }

  const cancel = () => {
    setForm(product)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-blue-50 border-b border-blue-100">
        <td className="px-3 py-2" colSpan="7">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Nome</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Código SAP</label>
              <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Modelo</label>
              <input value={form.modelo || ''} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue">
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Preço (R$)</label>
              <input type="number" step="0.01" value={form.preco ?? ''} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                placeholder="Sob consulta"
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Potência</label>
              <input type="number" step="0.001" value={form.potencia ?? ''} onChange={e => setForm(f => ({ ...f, potencia: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Unid. Potência</label>
              <input value={form.unidadePotencia || ''} onChange={e => setForm(f => ({ ...f, unidadePotencia: e.target.value }))}
                placeholder="kW, Wp, cv..."
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase">Estoque</label>
              <select value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue">
                <option>Disponível</option>
                <option>Sob consulta</option>
                <option>Sem estoque</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Descrição</label>
            <textarea value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-weg-blue" />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={save} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
              <Check size={12} /> Salvar
            </button>
            <button onClick={cancel} className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg">
              <X size={12} /> Cancelar
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group transition-colors">
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium text-gray-900 leading-tight">{product.nome}</p>
        <p className="text-xs text-gray-400 font-mono">{product.codigo}</p>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[180px]">
        <span className="truncate block">{product.categoria}</span>
      </td>
      <td className="px-3 py-2.5">
        {product.potencia && (
          <span className="text-xs font-semibold text-weg-blue bg-blue-50 px-2 py-0.5 rounded">
            {product.potencia} {product.unidadePotencia}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-sm font-bold text-gray-800">
        {product.preco
          ? product.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : <span className="text-gray-400 font-normal text-xs">Sob consulta</span>}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          product.estoque === 'Disponível' ? 'bg-green-100 text-green-700' :
          product.estoque === 'Sem estoque' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {product.estoque}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
            title="Editar"
          >
            <Edit3 size={14} />
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => onDelete(product.id)}
                className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors" title="Confirmar exclusão">
                <Check size={14} />
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <X size={14} />
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Excluir">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────────
function AddProductModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_PRODUCT })

  const submit = (e) => {
    e.preventDefault()
    if (!form.nome || !form.codigo) return
    onAdd({
      ...form,
      preco: form.preco === '' ? null : parseFloat(form.preco),
      potencia: form.potencia === '' ? null : parseFloat(form.potencia),
      specs: {},
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-weg-blue text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> Novo Produto</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do produto *</label>
              <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Código SAP *</label>
              <input required value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue">
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo / Descrição curta</label>
              <input value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fabricante</label>
              <input value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Preço unitário (R$)</label>
              <input type="number" step="0.01" placeholder="Deixar vazio = Sob consulta"
                value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Potência</label>
                <input type="number" step="0.001" value={form.potencia} onChange={e => setForm(f => ({ ...f, potencia: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
              </div>
              <div className="w-20">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Unid.</label>
                <input value={form.unidadePotencia} onChange={e => setForm(f => ({ ...f, unidadePotencia: e.target.value }))}
                  placeholder="kW"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Estoque</label>
              <select value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue">
                <option>Disponível</option>
                <option>Sob consulta</option>
                <option>Sem estoque</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" className="btn-primary flex items-center gap-2 px-5 py-2.5">
              <Plus size={15} /> Adicionar produto
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-5 py-2.5">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Desconto Card ───────────────────────────────────────────────────────────
function DescontoCard() {
  const { desconto, saveDesconto } = useProducts()
  const [local, setLocal] = useState(String(desconto))

  const commit = () => {
    const v = Math.min(100, Math.max(0, parseFloat(local.replace(',', '.')) || 0))
    setLocal(String(v))
    saveDesconto(v)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900 text-sm mb-0.5">Desconto Comercial</p>
          <p className="text-xs text-gray-400">Aplicado sobre o subtotal em todos os orçamentos de kit</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={local}
              onChange={e => setLocal(e.target.value)}
              onBlur={commit}
              onKeyDown={e => e.key === 'Enter' && commit()}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:border-weg-blue"
            />
            <span className="text-gray-600 font-semibold text-sm">%</span>
          </div>
          {desconto > 0 ? (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              Desconto ativo: {desconto}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-400 text-xs px-3 py-1.5 rounded-full">
              Sem desconto
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Frete Section ───────────────────────────────────────────────────────────
function FreteSection() {
  const { freteOpcoes, addFreteOpcao, updateFreteOpcao, deleteFreteOpcao, resetFrete } = useProducts()
  const [open, setOpen]       = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editNome, setEditNome]     = useState('')
  const [editAcrescimo, setEditAcrescimo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newNome, setNewNome]       = useState('')
  const [newAcrescimo, setNewAcrescimo]   = useState('')

  const startEdit = (f) => {
    setEditId(f.id)
    setEditNome(f.nome)
    setEditAcrescimo(String(f.acrescimo))
  }
  const saveEdit = () => {
    const ac = parseFloat(editAcrescimo.replace(',', '.'))
    if (!editNome.trim() || isNaN(ac)) return
    updateFreteOpcao(editId, { nome: editNome.trim(), acrescimo: ac })
    setEditId(null)
  }
  const saveNew = () => {
    const ac = parseFloat(newAcrescimo.replace(',', '.'))
    if (!newNome.trim() || isNaN(ac)) return
    addFreteOpcao({ nome: newNome.trim(), acrescimo: ac })
    setNewNome(''); setNewAcrescimo(''); setShowNew(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Truck size={18} className="text-weg-blue" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Tabela de Frete / Modalidade de Entrega</p>
            <p className="text-xs text-gray-400">{freteOpcoes.length} modalidades configuradas</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Modalidade de Frete</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-28">Acréscimo</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-24">% sobre total</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {freteOpcoes.map(f => (
                  <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editId === f.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            value={editNome}
                            onChange={e => setEditNome(e.target.value)}
                            className="w-full border border-weg-blue rounded px-2 py-1 text-sm"
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editAcrescimo}
                            onChange={e => setEditAcrescimo(e.target.value)}
                            className="w-full border border-weg-blue rounded px-2 py-1 text-sm text-center"
                            placeholder="ex: 1.055"
                          />
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-400">
                          {(() => { const a = parseFloat(editAcrescimo.replace(',','.')); return isNaN(a) ? '—' : `+${((a-1)*100).toFixed(1)}%` })()}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 justify-end">
                            <button onClick={saveEdit} className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check size={14}/></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X size={14}/></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-sm text-gray-800">{f.nome}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-mono text-sm font-semibold text-weg-blue">{f.acrescimo.toFixed(3)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                          {f.acrescimo === 1 ? 'Sem frete' : `+${((f.acrescimo - 1) * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(f)} className="p-1.5 rounded text-gray-400 hover:text-weg-blue hover:bg-blue-50"><Edit3 size={13}/></button>
                            <button onClick={() => deleteFreteOpcao(f.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* New row */}
                {showNew && (
                  <tr className="border-b border-blue-100 bg-blue-50">
                    <td className="px-4 py-2">
                      <input
                        value={newNome}
                        onChange={e => setNewNome(e.target.value)}
                        className="w-full border border-weg-blue rounded px-2 py-1 text-sm"
                        placeholder="Ex: CIF – Sem descarga – Região..."
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={newAcrescimo}
                        onChange={e => setNewAcrescimo(e.target.value)}
                        className="w-full border border-weg-blue rounded px-2 py-1 text-sm text-center"
                        placeholder="1.055"
                      />
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-gray-400">
                      {(() => { const a = parseFloat(newAcrescimo.replace(',','.')); return isNaN(a) ? '—' : `+${((a-1)*100).toFixed(1)}%` })()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={saveNew} className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check size={14}/></button>
                        <button onClick={() => setShowNew(false)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X size={14}/></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-sm text-weg-blue font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              <Plus size={14}/> Adicionar modalidade
            </button>
            <button
              onClick={() => { if (window.confirm('Restaurar tabela de frete padrão?')) resetFrete() }}
              className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded"
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── User Management ──────────────────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers]     = useState([])
  const [emails, setEmails]   = useState({}) // id → email
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [acting, setActing]   = useState({}) // id → 'ativo'|'recusado'|null

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    const [profilesRes, authRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ])
    if (profilesRes.error) { setError(profilesRes.error.message); setLoading(false); return }
    setUsers(profilesRes.data || [])
    const map = {}
    ;(authRes.data?.users || []).forEach(u => { map[u.id] = u.email })
    setEmails(map)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  // Auto-refresh a cada 30s para detectar novas solicitações
  useEffect(() => {
    const id = setInterval(() => fetchUsers(), 30000)
    return () => clearInterval(id)
  }, [])

  const setStatus = async (id, status) => {
    setActing(a => ({ ...a, [id]: status }))
    await supabaseAdmin.from('profiles').update({ status }).eq('id', id)
    setUsers(u => u.map(p => p.id === id ? { ...p, status } : p))
    if (status === 'ativo') {
      try {
        const profile = users.find(p => p.id === id) || {}
        notifyClienteApproved({
          clienteNome:  profile.nome || emails[id] || '',
          clienteEmail: emails[id] || '',
          clientePhone: profile.telefone || '',
          clienteWaKey: '',
        })
      } catch (_) {}
    }
    setActing(a => ({ ...a, [id]: null }))
  }

  const setRole = async (id, role) => {
    await supabaseAdmin.from('profiles').update({ role }).eq('id', id)
    setUsers(u => u.map(p => p.id === id ? { ...p, role } : p))
  }

  const pending  = users.filter(u => u.status === 'pendente')
  const ativos   = users.filter(u => u.status === 'ativo')
  const recusados = users.filter(u => u.status === 'recusado')

  const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  const initials = nome => (nome || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  // ── Card for pending request ──
  const PendingCard = ({ user }) => {
    const isBusy = acting[user.id]
    return (
      <div className="bg-white rounded-2xl border-2 border-yellow-200 shadow-sm p-5 space-y-4">
        {/* Top: avatar + name */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-weg-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials(user.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight">{user.nome || '—'}</p>
            {user.empresa && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <Building2 size={12} className="text-gray-400" /> {user.empresa}
              </p>
            )}
          </div>
          <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
            <Clock size={11} /> Pendente
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
          {emails[user.id] && (
            <div className="flex items-center gap-2">
              <AtSign size={12} className="text-gray-400 shrink-0" />
              <span className="truncate">{emails[user.id]}</span>
            </div>
          )}
          {user.telefone && (
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-gray-400 shrink-0" />
              <span>{user.telefone}</span>
            </div>
          )}
          {user.cnpj && (
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="font-mono">{user.cnpj}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays size={12} className="text-gray-400 shrink-0" />
            <span>Solicitado em {fmtDate(user.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatus(user.id, 'ativo')}
            disabled={!!isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors"
          >
            {isBusy === 'ativo'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><UserCheck size={15} /> Aprovar acesso</>}
          </button>
          <button
            onClick={() => setStatus(user.id, 'recusado')}
            disabled={!!isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors"
          >
            {isBusy === 'recusado'
              ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <><UserX size={15} /> Recusar</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Row for all-users table ──
  const STATUS_BADGE = {
    pendente:  { cls: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
    ativo:     { cls: 'bg-green-100 text-green-700',   label: 'Ativo' },
    recusado:  { cls: 'bg-red-100 text-red-600',       label: 'Recusado' },
  }

  const UserRow = ({ user }) => {
    const st = STATUS_BADGE[user.status] || STATUS_BADGE.pendente
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-weg-blue/10 text-weg-blue flex items-center justify-center text-xs font-bold shrink-0">
              {initials(user.nome)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{user.nome || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{emails[user.id] || '—'}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
          <p>{user.empresa || '—'}</p>
          {user.cnpj && <p className="font-mono text-gray-400">{user.cnpj}</p>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{user.telefone || '—'}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
            {st.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <select
            value={user.role}
            onChange={e => setRole(user.id, e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-weg-blue"
          >
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
          {new Date(user.created_at).toLocaleDateString('pt-BR')}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            {user.status !== 'ativo' && (
              <button onClick={() => setStatus(user.id, 'ativo')} title="Aprovar"
                className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700">
                <CheckCircle2 size={14} />
              </button>
            )}
            {user.status !== 'recusado' && (
              <button onClick={() => setStatus(user.id, 'recusado')} title="Recusar"
                className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600">
                <XCircle size={14} />
              </button>
            )}
            {user.status !== 'pendente' && (
              <button onClick={() => setStatus(user.id, 'pendente')} title="Marcar como pendente"
                className="p-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700">
                <Clock size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Users size={20} className="text-weg-blue" /> Gestão de Usuários
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {ativos.length} ativo{ativos.length !== 1 ? 's' : ''} · {pending.length} pendente{pending.length !== 1 ? 's' : ''} · atualiza automaticamente a cada 30s
          </p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-weg-blue px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-700 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Novas Solicitações ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Clock size={15} className="text-yellow-500" /> Novas Solicitações
              </h4>
              {pending.length > 0 && (
                <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {pending.length}
                </span>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
                <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
                <p className="text-green-700 font-semibold text-sm">Nenhuma solicitação pendente</p>
                <p className="text-green-500 text-xs mt-0.5">Todas as solicitações foram respondidas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pending.map(u => <PendingCard key={u.id} user={u} />)}
              </div>
            )}
          </section>

          {/* ── Todos os Usuários ── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Users size={15} className="text-weg-blue" /> Todos os Usuários
              </h4>
              <div className="flex gap-2 text-xs">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{ativos.length} ativos</span>
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{recusados.length} recusados</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {users.length === 0 ? (
                <div className="py-14 text-center">
                  <Users size={36} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Nenhum usuário cadastrado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Nome / E-mail</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Empresa / CNPJ</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Telefone</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Perfil</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Cadastro</th>
                        <th className="px-4 py-2.5 w-28 text-left text-xs font-semibold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody>{users.map(u => <UserRow key={u.id} user={u} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ─── Dashboard Panel ──────────────────────────────────────────────────────────
function DashboardPanel({ onGoToTab }) {
  const [stats, setStats] = useState(null)
  const [recentQuotes, setRecentQuotes] = useState([])
  const [loading, setLoading] = useState(true)

  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  useEffect(() => {
    const load = async () => {
      const [quotesRes, activeRes, pendingRes] = await Promise.all([
        supabaseAdmin.from('quotes').select('status, total_final, kwp, created_at, nome_projeto, data, profiles:user_id(nome, empresa)').order('created_at', { ascending: false }),
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ativo').neq('role', 'admin'),
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      ])

      const quotes = quotesRes.data || []
      const byStatus = (s) => quotes.filter(q => q.status === s).length
      const totalReceita = quotes.reduce((sum, q) => sum + (q.total_final || 0), 0)
      const totalKwp = quotes.reduce((sum, q) => sum + (parseFloat(q.kwp) || 0), 0)
      const fechados   = quotes.filter(q => ['fechado', 'implantado'].includes(q.status))
      const perdidos   = quotes.filter(q => q.status === 'perdida')

      setStats({
        total: quotes.length,
        rascunho: byStatus('rascunho'),
        aguardando: byStatus('aguardando_desconto'),
        aprovada: byStatus('aprovada'),
        recusada: byStatus('recusada'),
        fechado: byStatus('fechado'),
        implantado: byStatus('implantado'),
        perdida: byStatus('perdida'),
        receita: totalReceita,
        kwp: totalKwp,
        valorFechados: fechados.reduce((s, q) => s + (q.total_final || 0), 0),
        kwpFechados: fechados.reduce((s, q) => s + (parseFloat(q.kwp) || 0), 0),
        valorPerdidos: perdidos.reduce((s, q) => s + (q.total_final || 0), 0),
        clientesAtivos: activeRes.count || 0,
        clientesPendentes: pendingRes.count || 0,
      })
      setRecentQuotes(quotes.slice(0, 8))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const statCards = [
    { label: 'Total de cotações',    value: stats.total,                icon: FileText,    color: 'blue',   sub: `${stats.kwp.toFixed(1)} kWp total` },
    { label: 'Valor em cotações',    value: fmt(stats.receita),         icon: DollarSign,  color: 'green',  sub: 'soma dos totais' },
    { label: 'Descontos pendentes',  value: stats.aguardando,           icon: BadgePercent,color: 'yellow', sub: 'aguardando resposta', onClick: () => onGoToTab('cotacoes') },
    { label: 'Clientes ativos',      value: stats.clientesAtivos,       icon: Users,       color: 'indigo', sub: `${stats.clientesPendentes} aguardando aprovação`, onClick: stats.clientesPendentes > 0 ? () => onGoToTab('usuarios') : undefined },
    { label: 'Kits Fechados',        value: stats.fechado + stats.implantado, icon: Package, color: 'orange', sub: `${fmt(stats.valorFechados)} · ${stats.kwpFechados.toFixed(1)} kWp`, onClick: () => onGoToTab('kits_fechados') },
    { label: 'Kits Perdidos',        value: stats.perdida,              icon: XCircle,     color: 'red',    sub: fmt(stats.valorPerdidos), onClick: stats.perdida > 0 ? () => onGoToTab('kits_fechados') : undefined },
  ]

  const colorMap = {
    blue:   { card: 'bg-blue-50 border-blue-200',     icon: 'bg-weg-blue text-white',    val: 'text-weg-blue' },
    green:  { card: 'bg-green-50 border-green-200',   icon: 'bg-green-600 text-white',   val: 'text-green-700' },
    yellow: { card: 'bg-yellow-50 border-yellow-200', icon: 'bg-yellow-500 text-white',  val: 'text-yellow-700' },
    indigo: { card: 'bg-indigo-50 border-indigo-200', icon: 'bg-indigo-600 text-white',  val: 'text-indigo-700' },
    orange: { card: 'bg-orange-50 border-orange-200', icon: 'bg-orange-500 text-white',  val: 'text-orange-600' },
    red:    { card: 'bg-red-50 border-red-200',       icon: 'bg-red-500 text-white',     val: 'text-red-600' },
  }

  const STATUS_META = {
    rascunho:            { label: 'Rascunhos',              cls: 'bg-gray-200',    text: 'text-gray-600',   count: stats.rascunho },
    aguardando_desconto: { label: 'Aguardando desconto',    cls: 'bg-yellow-400',  text: 'text-yellow-700', count: stats.aguardando },
    aprovada:            { label: 'Desconto aprovado',      cls: 'bg-green-500',   text: 'text-green-700',  count: stats.aprovada },
    recusada:            { label: 'Recusado',               cls: 'bg-red-400',     text: 'text-red-600',    count: stats.recusada },
    fechado:             { label: 'Kits fechados',          cls: 'bg-orange-400',  text: 'text-orange-600', count: stats.fechado },
    implantado:          { label: 'Implantados',            cls: 'bg-emerald-500', text: 'text-emerald-700',count: stats.implantado },
    perdida:             { label: 'Propostas perdidas',     cls: 'bg-red-300',     text: 'text-red-500',    count: stats.perdida },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={20} className="text-weg-blue" />
        <h3 className="font-bold text-gray-900 text-lg">Dashboard</h3>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map(c => {
          const cm = colorMap[c.color]
          const Icon = c.icon
          return (
            <div
              key={c.label}
              onClick={c.onClick}
              className={`rounded-xl border p-4 ${cm.card} ${c.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cm.icon}`}>
                  <Icon size={17} />
                </div>
                {c.onClick && <span className="text-xs text-gray-400 underline">Ver</span>}
              </div>
              <p className={`text-2xl font-extrabold ${cm.val}`}>{c.value}</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{c.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-weg-blue" /> Cotações por status
          </h4>
          <div className="space-y-3">
            {Object.entries(STATUS_META).map(([key, m]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`font-medium ${m.text}`}>{m.label}</span>
                  <span className="font-bold text-gray-700">{m.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m.cls}`}
                    style={{ width: stats.total > 0 ? `${(m.count / stats.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-right">{stats.total} cotação{stats.total !== 1 ? 'ões' : ''} no total</p>
        </div>

        {/* Recent quotes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-weg-blue" /> Atividade recente
            </h4>
            <button onClick={() => onGoToTab('cotacoes')} className="text-xs text-weg-blue hover:underline">
              Ver todas
            </button>
          </div>
          <div className="space-y-2.5">
            {recentQuotes.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Nenhuma cotação ainda.</p>
            )}
            {recentQuotes.map(q => {
              const kitData = q.data || {}
              const statusCls = {
                rascunho: 'bg-gray-100 text-gray-500',
                aguardando_desconto: 'bg-yellow-100 text-yellow-700',
                aprovada: 'bg-green-100 text-green-700',
                recusada: 'bg-red-100 text-red-600',
              }[q.status] || 'bg-gray-100 text-gray-500'

              return (
                <div key={q.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Sun size={14} className="text-weg-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {q.nome_projeto || `Kit ${q.kwp} kWp`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {q.profiles?.nome || '—'}{q.profiles?.empresa ? ` · ${q.profiles.empresa}` : ''}
                    </p>
                    {kitData.panel && (
                      <p className="text-xs text-gray-400">
                        ☀️ {kitData.panelQty}× {kitData.panel.nome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-700">{fmt(q.total_final)}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCls}`}>
                      {q.status === 'aguardando_desconto' ? 'Aguardando' : q.status === 'rascunho' ? 'Rascunho' : q.status === 'aprovada' ? 'Aprovada' : 'Recusada'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Kit Items Table (Admin) ──────────────────────────────────────────────────
function AdminKitItems({ items }) {
  const [open, setOpen] = useState(false)
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Package size={12} /> Composição do kit ({items.length} iten{items.length !== 1 ? 's' : ''})
        </span>
        {open ? <ChevronDown size={13} className="rotate-180" /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Item</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500 hidden md:table-cell">Produto</th>
                  <th className="text-center px-3 py-1.5 font-semibold text-gray-500">Qtd</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500 hidden sm:table-cell">Unit.</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-1.5 text-gray-600 font-medium">{item.label}</td>
                    <td className="px-3 py-1.5 text-gray-400 hidden md:table-cell max-w-[160px] truncate">{item.produto}</td>
                    <td className="px-3 py-1.5 text-center font-bold text-gray-700">{item.qty}</td>
                    <td className="px-3 py-1.5 text-right text-gray-400 hidden sm:table-cell">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-gray-800">{fmt(item.total)}</td>
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

// ─── Quote Management ─────────────────────────────────────────────────────────
function QuoteManagement() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [approvingId, setApprovingId] = useState(null)
  const [approveDiscount, setApproveDiscount] = useState('')
  const [approveMsg, setApproveMsg] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectMsg, setRejectMsg] = useState('')

  const fetchQuotes = async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('quotes')
      .select('*, profiles:user_id(nome, empresa, telefone, cnpj), quote_items(*)')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchQuotes() }, [])

  const updateQuote = async (id, patch) => {
    const { error } = await supabaseAdmin.from('quotes').update(patch).eq('id', id)
    if (!error) setQuotes(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
    return error
  }

  const getClientAuth = async (userId) => {
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
      return user
    } catch { return null }
  }

  const handleApprove = async (quote) => {
    const pct = parseFloat(approveDiscount.replace(',', '.'))
    if (isNaN(pct) || pct < 0 || pct > 100) return
    const resposta = approveMsg.trim() || `Desconto de ${pct}% aprovado para este kit.`
    await updateQuote(quote.id, {
      status: 'aprovada',
      desconto_pct: pct,
      desconto_resposta: resposta,
    })
    setApprovingId(null)
    setApproveDiscount('')
    setApproveMsg('')

    // Notifica cliente
    try {
      const authUser = await getClientAuth(quote.user_id)
      const totalComDesconto = (quote.total_final || 0) * (1 - pct / 100)
      notifyDescontoAprovado({
        clienteNome: quote.profiles?.nome || authUser?.email || 'Cliente',
        clienteEmail: authUser?.email || '',
        clientePhone: quote.profiles?.telefone || '',
        clienteWaKey: authUser?.user_metadata?.whatsapp_apikey || '',
        kitNome: quote.nome_projeto || `Kit ${quote.kwp} kWp`,
        descontoPct: pct,
        totalOriginal: quote.total_final || 0,
        totalFinal: totalComDesconto,
        resposta,
      })
    } catch (_) {}
  }

  const handleReject = async (quoteId) => {
    const quote = quotes.find(q => q.id === quoteId)
    const resposta = rejectMsg.trim() || 'Solicitação de desconto não aprovada.'
    await updateQuote(quoteId, {
      status: 'rascunho',
      desconto_pct: 0,
      desconto_resposta: resposta,
    })
    setRejectingId(null)
    setRejectMsg('')

    // Notifica cliente
    try {
      if (quote) {
        const authUser = await getClientAuth(quote.user_id)
        notifyDescontoRecusado({
          clienteNome: quote.profiles?.nome || authUser?.email || 'Cliente',
          clienteEmail: authUser?.email || '',
          clientePhone: quote.profiles?.telefone || '',
          clienteWaKey: authUser?.user_metadata?.whatsapp_apikey || '',
          kitNome: quote.nome_projeto || `Kit ${quote.kwp} kWp`,
          resposta,
        })
      }
    } catch (_) {}
  }

  const STATUS_COLOR = {
    rascunho:             'bg-gray-100 text-gray-600',
    enviada:              'bg-blue-100 text-blue-700',
    em_analise:           'bg-blue-100 text-blue-700',
    aguardando_desconto:  'bg-yellow-100 text-yellow-700',
    aprovada:             'bg-green-100 text-green-700',
    recusada:             'bg-red-100 text-red-700',
    fechado:              'bg-orange-100 text-orange-700',
    implantado:           'bg-emerald-100 text-emerald-700',
    perdida:              'bg-red-100 text-red-600',
  }
  const STATUS_LABEL = {
    rascunho: 'Rascunho', enviada: 'Em análise', em_analise: 'Em análise',
    aguardando_desconto: 'Aguardando desconto',
    aprovada: 'Aprovada', recusada: 'Recusada',
    fechado: 'Aguard. Implantação', implantado: 'Implantado', perdida: 'Perdida',
  }

  const [confirmingImplantId, setConfirmingImplantId] = useState(null)
  const handleConfirmImplantacao = async (quoteId) => {
    await updateQuote(quoteId, { status: 'implantado' })
    setConfirmingImplantId(null)
  }

  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const pendingDiscount = quotes.filter(q => q.status === 'aguardando_desconto')
  const pendingImplant  = quotes.filter(q => q.status === 'fechado')

  const byStatus = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const filtered = search.trim()
    ? byStatus.filter(q => {
        const s = search.trim().toLowerCase()
        return (
          (q.profiles?.cnpj || '').replace(/\D/g, '').includes(s.replace(/\D/g, '')) ||
          (q.profiles?.nome || '').toLowerCase().includes(s) ||
          (q.profiles?.empresa || '').toLowerCase().includes(s) ||
          (q.data?.numero_orcamento || '').toLowerCase().includes(s)
        )
      })
    : byStatus

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Card de kit aguardando implantação ──
  const ImplantCard = ({ q }) => {
    const [confirming, setConfirming] = useState(false)
    const [confirmingPerdida, setConfirmingPerdida] = useState(false)
    const [busy, setBusy] = useState(false)
    const kd = q.data || {}

    const doImplantar = async () => {
      setBusy(true)
      await updateQuote(q.id, { status: 'implantado' })
      setBusy(false)
      setConfirming(false)
    }

    const doPerdida = async () => {
      setBusy(true)
      await updateQuote(q.id, { status: 'perdida' })
      setBusy(false)
      setConfirmingPerdida(false)
    }

    return (
      <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {kd.numero_orcamento && (
                <span className="text-xs font-mono font-bold text-weg-blue bg-weg-blue/10 px-2 py-0.5 rounded-full">
                  {kd.numero_orcamento}{(kd.revisao || 0) > 0 ? ` · Rev.${kd.revisao}` : ''}
                </span>
              )}
              <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Package size={10} /> Aguard. Implantação
              </span>
            </div>
            <p className="font-bold text-gray-900 mt-1">{q.nome_projeto || `Kit ${q.kwp} kWp`}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-lg text-gray-900">{fmt(q.total_final)}</p>
            <p className="text-xs text-gray-400">{q.kwp} kWp</p>
          </div>
        </div>

        {/* Client info */}
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1.5">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-gray-400 shrink-0" />
            <span className="font-semibold">{q.profiles?.nome || '—'}</span>
            {q.profiles?.empresa && <span className="text-gray-400">— {q.profiles.empresa}</span>}
          </div>
          {q.profiles?.telefone && (
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-gray-400 shrink-0" />
              <span>{q.profiles.telefone}</span>
            </div>
          )}
          {q.profiles?.cnpj && (
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="font-mono">{q.profiles.cnpj}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays size={12} className="text-gray-400 shrink-0" />
            <span>Fechado em {new Date(q.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          {q.frete_nome && (
            <div className="flex items-center gap-2">
              <Truck size={12} className="text-gray-400 shrink-0" />
              <span className="truncate">{q.frete_nome}</span>
            </div>
          )}
        </div>

        {/* Kit items summary */}
        {kd.panel && (
          <div className="text-xs text-gray-500 space-y-0.5 border-t border-gray-100 pt-3">
            <p>☀️ <strong>{kd.panelQty}×</strong> {kd.panel.modelo || kd.panel.nome}</p>
            {kd.inverter && <p>⚡ <strong>{kd.inverterQty || 1}×</strong> {kd.inverter.modelo || kd.inverter.nome}</p>}
            {Array.isArray(kd.inverters) && kd.inverters.map((i, idx) => (
              <p key={idx}>⚡ <strong>{i.qty}×</strong> {i.inverter?.modelo || i.inverter?.nome}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        {confirming ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-emerald-800 mb-2">Confirmar implantação do kit?</p>
            <div className="flex gap-2">
              <button onClick={doImplantar} disabled={busy}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-60">
                {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle2 size={14} /> Sim, confirmar</>}
              </button>
              <button onClick={() => setConfirming(false)} className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        ) : confirmingPerdida ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-red-700 mb-2">Marcar como proposta perdida?</p>
            <div className="flex gap-2">
              <button onClick={doPerdida} disabled={busy}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-60">
                {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><XCircle size={14} /> Sim, marcar perdida</>}
              </button>
              <button onClick={() => setConfirmingPerdida(false)} className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setConfirming(true)}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Confirmar implantação
            </button>
            <button onClick={() => setConfirmingPerdida(true)}
              className="px-4 py-3 border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm flex items-center justify-center gap-1">
              <XCircle size={15} />
            </button>
          </div>
        )}
      </div>
    )
  }

  const STATUS_BORDER = {
    rascunho: 'border-l-gray-300', enviada: 'border-l-blue-400',
    em_analise: 'border-l-blue-400', aguardando_desconto: 'border-l-yellow-400',
    aprovada: 'border-l-green-400', recusada: 'border-l-red-400',
    fechado: 'border-l-orange-400', implantado: 'border-l-emerald-400',
    perdida: 'border-l-red-300',
  }

  const STATUS_PILLS = [
    { value: 'all',                 label: 'Todas',           count: quotes.length },
    { value: 'rascunho',            label: 'Rascunho',        count: quotes.filter(q => q.status === 'rascunho').length },
    { value: 'em_analise',          label: 'Em análise',      count: quotes.filter(q => ['em_analise','enviada'].includes(q.status)).length },
    { value: 'aguardando_desconto', label: 'Desc. pendente',  count: pendingDiscount.length },
    { value: 'aprovada',            label: 'Aprovada',        count: quotes.filter(q => q.status === 'aprovada').length },
    { value: 'fechado',             label: 'Aguard. Implant.',count: pendingImplant.length },
    { value: 'implantado',          label: 'Implantado',      count: quotes.filter(q => q.status === 'implantado').length },
    { value: 'perdida',             label: 'Perdida',         count: quotes.filter(q => q.status === 'perdida').length },
  ]

  const fmtDt = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 mr-auto">
          <LayoutList size={20} className="text-weg-blue" /> Cotações
          <span className="text-sm font-normal text-gray-400">({filtered.length}/{quotes.length})</span>
        </h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar CNPJ, nome, empresa ou cotação…"
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl w-72 focus:outline-none focus:border-weg-blue bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={fetchQuotes} className="p-2 rounded-xl text-gray-400 hover:text-weg-blue hover:bg-gray-100 transition-colors" title="Atualizar">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Filtros por status (pills) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_PILLS.map(p => (
          <button key={p.value} onClick={() => setFilter(p.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
              filter === p.value
                ? 'bg-weg-blue text-white border-weg-blue'
                : 'bg-white text-gray-500 border-gray-200 hover:border-weg-blue/50 hover:text-weg-blue'
            }`}>
            {p.label}
            {p.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === p.value ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-500'
              } ${p.value === 'aguardando_desconto' && filter !== p.value ? '!bg-yellow-100 !text-yellow-700' : ''}`}>
                {p.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Banner desconto pendente */}
      {pendingDiscount.length > 0 && filter !== 'aguardando_desconto' && (
        <div onClick={() => setFilter('aguardando_desconto')}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2 text-sm text-yellow-800 cursor-pointer hover:bg-yellow-100">
          <BadgePercent size={16} />
          <span><strong>{pendingDiscount.length}</strong> solicitaç{pendingDiscount.length > 1 ? 'ões' : 'ão'} de desconto aguardando resposta</span>
          <span className="ml-auto text-yellow-600 underline text-xs">Ver →</span>
        </div>
      )}

      {/* ── Cards de cotações ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma cotação encontrada.</p>
          {search && <button onClick={() => setSearch('')} className="mt-2 text-xs text-weg-blue underline">Limpar busca</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const kd = q.data || {}
            const isExpanded = expandedId === q.id
            const rev = kd.revisao || 0
            const borderCls = STATUS_BORDER[q.status] || 'border-l-gray-200'

            return (
              <div key={q.id} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderCls} shadow-sm overflow-hidden transition-shadow hover:shadow-md`}>

                {/* ── Card header (clicável) ── */}
                <div onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="px-5 py-4 cursor-pointer">

                  {/* Linha 1: número + rev + status + data */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-mono font-bold text-base text-weg-blue">
                      {kd.numero_orcamento || q.id.slice(0, 8).toUpperCase()}
                    </span>
                    {rev > 0 && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Rev. {rev}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[q.status]}`}>
                      {STATUS_LABEL[q.status] || q.status}
                    </span>
                    {q.desconto_pct > 0 && (
                      <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        -{q.desconto_pct}% desc.
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{fmtDt(q.created_at)}</span>
                  </div>

                  {/* Linha 2: cliente + financeiro */}
                  <div className="flex flex-wrap gap-4 justify-between">
                    {/* Info do cliente */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {q.profiles?.nome || kd.clienteNome || '—'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {q.profiles?.empresa && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Building2 size={11} /> {q.profiles.empresa}
                          </span>
                        )}
                        {q.profiles?.cnpj && (
                          <button onClick={e => { e.stopPropagation(); setSearch(q.profiles.cnpj) }}
                            className="text-xs text-weg-blue hover:underline font-mono flex items-center gap-1" title="Filtrar por CNPJ">
                            {q.profiles.cnpj}
                          </button>
                        )}
                        {q.profiles?.telefone && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={11} /> {q.profiles.telefone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info financeira */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">kWp</p>
                        <p className="font-bold text-gray-800 text-sm">{q.kwp}</p>
                      </div>
                      {q.frete_nome && (
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-gray-400 mb-0.5">Frete</p>
                          <p className="text-xs text-gray-600 max-w-[120px] truncate">{q.frete_nome}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-gray-400 mb-0.5">Total</p>
                        <p className="font-extrabold text-gray-900 text-base">{fmt(q.total_final)}</p>
                      </div>
                      <div className="text-gray-300 ml-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Painel expandido ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100">

                    {/* Itens do kit */}
                    {(q.quote_items || []).length > 0 && (
                      <div className="px-5 pt-4 pb-2 bg-gray-50/60">
                        <AdminKitItems items={q.quote_items} />
                      </div>
                    )}

                    {/* Dados extras */}
                    <div className="px-5 py-3 flex flex-wrap gap-4 text-xs text-gray-500 bg-gray-50/40 border-t border-gray-100">
                      {q.profiles?.empresa && <span>🏢 <strong>{q.profiles.empresa}</strong></span>}
                      {q.profiles?.cnpj    && <span>📋 {q.profiles.cnpj}</span>}
                      {q.profiles?.telefone && <span>📞 {q.profiles.telefone}</span>}
                      {q.frete_nome        && <span>🚛 {q.frete_nome}</span>}
                      {kd.ov_numero        && <span>📦 OV: <strong>{kd.ov_numero}</strong></span>}
                    </div>

                    {/* Desconto pendente */}
                    {q.status === 'aguardando_desconto' && (
                      <div className="px-5 pb-4 pt-3 bg-yellow-50 border-t border-yellow-100 space-y-3">
                        <p className="text-xs text-yellow-800">
                          <strong>Motivo do desconto:</strong> {q.desconto_motivo || '—'}
                        </p>
                        {approvingId === q.id ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-700 whitespace-nowrap">Desconto (%):</label>
                              <input type="number" min="0" max="100" step="0.5"
                                value={approveDiscount} onChange={e => setApproveDiscount(e.target.value)}
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm" placeholder="ex: 5" autoFocus />
                            </div>
                            <textarea value={approveMsg} onChange={e => setApproveMsg(e.target.value)}
                              rows={2} placeholder="Mensagem para o cliente (opcional)"
                              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(q)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1">
                                <Check size={12} /> Aprovar e enviar
                              </button>
                              <button onClick={() => setApprovingId(null)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">Cancelar</button>
                            </div>
                          </div>
                        ) : rejectingId === q.id ? (
                          <div className="space-y-2">
                            <textarea value={rejectMsg} onChange={e => setRejectMsg(e.target.value)}
                              rows={2} placeholder="Motivo da recusa (opcional)"
                              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleReject(q.id)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1">
                                <X size={12} /> Confirmar recusa
                              </button>
                              <button onClick={() => setRejectingId(null)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => { setApprovingId(q.id); setRejectingId(null); setApproveDiscount(''); setApproveMsg('') }}
                              className="bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
                              <BadgePercent size={12} /> Aprovar desconto
                            </button>
                            <button onClick={() => { setRejectingId(q.id); setApprovingId(null); setRejectMsg('') }}
                              className="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
                              <X size={12} /> Recusar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Confirmar implantação */}
                    {q.status === 'fechado' && (
                      <div className="px-5 pb-4 pt-3 bg-orange-50 border-t border-orange-100">
                        <p className="text-xs text-orange-800 mb-2 font-semibold">⚡ Cliente solicitou implantação.</p>
                        {confirmingImplantId === q.id ? (
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-gray-700">Confirmar implantação?</span>
                            <button onClick={() => handleConfirmImplantacao(q.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1">
                              <Check size={12} /> Confirmar
                            </button>
                            <button onClick={() => setConfirmingImplantId(null)} className="text-xs text-gray-400 px-2 py-2">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmingImplantId(q.id)}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
                            <CheckCircle2 size={12} /> Confirmar implantação
                          </button>
                        )}
                      </div>
                    )}

                    {q.status === 'implantado' && (
                      <div className="px-5 py-3 border-t border-emerald-100 bg-emerald-50 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Implantação confirmada.
                        {kd.ov_numero && <span className="font-mono ml-1">OV: {kd.ov_numero}</span>}
                      </div>
                    )}

                    {q.desconto_resposta && q.status !== 'aguardando_desconto' && (
                      <div className={`px-5 py-3 border-t text-xs ${q.status === 'aprovada' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                        <strong>Resposta ao cliente:</strong> {q.desconto_resposta}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Notification Settings ────────────────────────────────────────────────────
function NotificationSettings() {
  const [s, setS] = useState(() => getNotifySettings())
  const [showWaKey, setShowWaKey] = useState(false)
  const [testStatus, setTestStatus] = useState({})
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => setS(prev => ({ ...prev, [key]: e.target.value }))

  const saveAll = () => {
    saveNotifySettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testWa = async () => {
    setTestStatus(t => ({ ...t, wa: 'sending' }))
    const ok = await sendWhatsApp(s.adminPhone, s.adminWaKey, '✅ Teste — Ernaniff Solar. Notificações funcionando!')
    setTestStatus(t => ({ ...t, wa: ok ? 'ok' : 'error' }))
  }

  const testEmail = async () => {
    setTestStatus(t => ({ ...t, email: 'sending' }))
    const ok = await sendEmail({
      serviceId: s.emailServiceId, templateId: s.emailTemplateId,
      publicKey: s.emailPublicKey, toEmail: s.adminEmail,
      subject: 'Teste — Ernaniff Solar',
      message: '✅ Notificações por email funcionando! Ernaniff Solar.',
    })
    setTestStatus(t => ({ ...t, email: ok ? 'ok' : 'error' }))
  }

  const statusIcon = (key) => {
    if (testStatus[key] === 'sending') return <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
    if (testStatus[key] === 'ok') return <CheckCircle2 size={14} className="text-green-500 inline" />
    if (testStatus[key] === 'error') return <XCircle size={14} className="text-red-500 inline" />
    return null
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
        <Bell size={20} className="text-weg-blue" /> Configurações de Notificações
      </h3>

      {/* WhatsApp */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={18} className="text-green-600" />
          <h4 className="font-semibold text-gray-800">WhatsApp (CallMeBot — gratuito)</h4>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 space-y-1">
          <p className="font-semibold">Como ativar em 3 passos:</p>
          <p>1. Adicione <strong>+34 644 97 74 49</strong> aos seus contatos do WhatsApp com o nome "CallMeBot".</p>
          <p>2. Envie a mensagem: <code className="bg-green-100 px-1 rounded">I allow callmebot to send me messages</code></p>
          <p>3. Você receberá seu <strong>API Key</strong> por WhatsApp. Cole abaixo.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Seu número (com DDI)</label>
            <input type="tel" value={s.adminPhone || ''} onChange={set('adminPhone')}
              placeholder="5599988230393"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Key do CallMeBot</label>
            <div className="relative">
              <input type={showWaKey ? 'text' : 'password'} value={s.adminWaKey || ''} onChange={set('adminWaKey')}
                placeholder="Ex: 123456"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-weg-blue" />
              <button onClick={() => setShowWaKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {showWaKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={testWa} disabled={!s.adminPhone || !s.adminWaKey || testStatus.wa === 'sending'}
            className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <MessageCircle size={13} /> Testar WhatsApp {statusIcon('wa')}
          </button>
          {testStatus.wa === 'ok' && <span className="text-xs text-green-600">Mensagem enviada!</span>}
          {testStatus.wa === 'error' && <span className="text-xs text-red-500">Erro — verifique número e API key.</span>}
        </div>
      </div>

      {/* Email via EmailJS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-weg-blue" />
          <h4 className="font-semibold text-gray-800">Email (EmailJS — gratuito, 200/mês)</h4>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Como configurar:</p>
          <p>1. Crie conta gratuita em <strong>emailjs.com</strong></p>
          <p>2. Adicione um serviço de email (Gmail, Outlook, etc.) e anote o <strong>Service ID</strong></p>
          <p>3. Crie um template com as variáveis: <code className="bg-blue-100 px-1 rounded">{'{{to_email}}'}</code> <code className="bg-blue-100 px-1 rounded">{'{{subject}}'}</code> <code className="bg-blue-100 px-1 rounded">{'{{message}}'}</code> — anote o <strong>Template ID</strong></p>
          <p>4. Em Account → API Keys, copie sua <strong>Public Key</strong></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service ID</label>
            <input type="text" value={s.emailServiceId || ''} onChange={set('emailServiceId')}
              placeholder="service_xxxxxxx"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template ID</label>
            <input type="text" value={s.emailTemplateId || ''} onChange={set('emailTemplateId')}
              placeholder="template_xxxxxxx"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Public Key</label>
            <input type="text" value={s.emailPublicKey || ''} onChange={set('emailPublicKey')}
              placeholder="xxxxxxxxxxxxxxxx"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Seu email (para receber)</label>
            <input type="email" value={s.adminEmail || ''} onChange={set('adminEmail')}
              placeholder="seu@email.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-weg-blue" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={testEmail}
            disabled={!s.emailServiceId || !s.emailTemplateId || !s.emailPublicKey || !s.adminEmail || testStatus.email === 'sending'}
            className="text-xs font-semibold bg-weg-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <Mail size={13} /> Testar Email {statusIcon('email')}
          </button>
          {testStatus.email === 'ok' && <span className="text-xs text-green-600">Email enviado!</span>}
          {testStatus.email === 'error' && <span className="text-xs text-red-500">Erro — verifique as credenciais.</span>}
        </div>
      </div>

      {/* WhatsApp para clientes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={18} className="text-amber-500" />
          <h4 className="font-semibold text-gray-800">WhatsApp para clientes</h4>
        </div>
        <p className="text-xs text-gray-500">
          Para que os clientes recebam notificações via WhatsApp, eles precisam ter ativado o CallMeBot e fornecido
          o API key durante o cadastro. Quando configurado, as notificações de aprovação e resposta de desconto
          são enviadas automaticamente.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          💡 Oriente os clientes a ativar o CallMeBot seguindo os mesmos 3 passos acima.
        </p>
      </div>

      {/* Salvar */}
      <div className="flex items-center gap-3">
        <button onClick={saveAll}
          className="btn-primary px-6 py-2.5 flex items-center gap-2">
          {saved ? <><CheckCircle2 size={15} /> Salvo!</> : <><Save size={15} /> Salvar configurações</>}
        </button>
        <p className="text-xs text-gray-400">As configurações ficam salvas neste dispositivo.</p>
      </div>
    </div>
  )
}

// ─── Kits Fechados Panel ──────────────────────────────────────────────────────
function KitsFechadosPanel({ onBadgeChange }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDt = d => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const fetchQuotes = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabaseAdmin
      .from('quotes')
      .select('*, profiles:user_id(nome, empresa, telefone, cnpj), quote_items(*)')
      .in('status', ['fechado', 'implantado', 'perdida'])
      .order('created_at', { ascending: false })
    const list = data || []
    setQuotes(list)
    const pendCount = list.filter(q => q.status === 'fechado').length
    onBadgeChange?.(pendCount)
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchQuotes()
    // Polling a cada 30s para capturar novos kits fechados por clientes
    const id = setInterval(() => fetchQuotes(true), 30_000)
    return () => clearInterval(id)
  }, [])

  const updateStatus = async (id, status, ovNumero = null) => {
    setActing(a => ({ ...a, [id]: status }))
    const patch = { status }
    if (ovNumero) {
      const q = quotes.find(q => q.id === id)
      patch.data = { ...(q?.data || {}), ov_numero: ovNumero }
    }
    await supabaseAdmin.from('quotes').update(patch).eq('id', id)
    setQuotes(qs => {
      const updated = qs.map(q => q.id === id
        ? { ...q, status, data: ovNumero ? { ...(q.data || {}), ov_numero: ovNumero } : q.data }
        : q)
      onBadgeChange?.(updated.filter(q => q.status === 'fechado').length)
      return updated
    })
    setActing(a => ({ ...a, [id]: null }))
  }

  const pending   = quotes.filter(q => q.status === 'fechado')
  const implanted = quotes.filter(q => q.status === 'implantado')
  const lost      = quotes.filter(q => q.status === 'perdida')

  const KitCard = ({ q }) => {
    const kd = q.data || {}
    const [confirmMode, setConfirmMode] = useState(null) // 'implantar' | 'perdida'
    const [ovNumber, setOvNumber] = useState('')
    const busy = acting[q.id]
    const isImpl = q.status === 'implantado'
    const isPerd = q.status === 'perdida'

    return (
      <div className={`bg-white rounded-2xl border-2 shadow-sm p-5 space-y-4 ${
        isImpl ? 'border-emerald-200' : isPerd ? 'border-red-200' : 'border-orange-200'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {kd.numero_orcamento && (
                <span className="font-mono font-bold text-xs text-weg-blue bg-weg-blue/10 px-2 py-0.5 rounded-full">
                  {kd.numero_orcamento}{(kd.revisao || 0) > 0 ? ` · Rev.${kd.revisao}` : ''}
                </span>
              )}
              {isImpl && (
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> Implantado
                </span>
              )}
              {isPerd && (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <XCircle size={10} /> Perdida
                </span>
              )}
              {!isImpl && !isPerd && (
                <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Package size={10} /> Aguard. Confirmação
                </span>
              )}
            </div>
            <p className="font-bold text-gray-900">{q.nome_projeto || `Kit ${q.kwp} kWp`}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-xl text-gray-900">{fmt(q.total_final)}</p>
            <p className="text-xs text-gray-400">{q.kwp} kWp</p>
          </div>
        </div>

        {/* Client info */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-gray-400 shrink-0" />
            <span className="font-semibold">{q.profiles?.nome || '—'}</span>
            {q.profiles?.empresa && <span className="text-gray-400">— {q.profiles.empresa}</span>}
          </div>
          {q.profiles?.telefone && (
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-gray-400 shrink-0" />
              <span>{q.profiles.telefone}</span>
            </div>
          )}
          {q.profiles?.cnpj && (
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="font-mono">{q.profiles.cnpj}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays size={12} className="text-gray-400 shrink-0" />
            <span>{fmtDt(q.created_at)}</span>
          </div>
          {q.frete_nome && (
            <div className="flex items-center gap-2">
              <Truck size={12} className="text-gray-400 shrink-0" />
              <span className="truncate">{q.frete_nome}</span>
            </div>
          )}
        </div>

        {/* Kit summary */}
        {kd.panel && (
          <div className="text-xs text-gray-500 space-y-0.5 border-t border-gray-100 pt-3">
            <p>☀️ <strong>{kd.panelQty}×</strong> {kd.panel.modelo || kd.panel.nome}</p>
            {kd.inverter && <p>⚡ <strong>{kd.inverterQty || 1}×</strong> {kd.inverter.modelo || kd.inverter.nome}</p>}
            {Array.isArray(kd.inverters) && kd.inverters.map((i, idx) => (
              <p key={idx}>⚡ <strong>{i.qty}×</strong> {i.inverter?.modelo || i.inverter?.nome}</p>
            ))}
            {kd.estruturaRoofType && <p>🏗️ {kd.estruturaRoofType}</p>}
          </div>
        )}

        {/* Actions — only for pending */}
        {!isImpl && !isPerd && (
          confirmMode === 'implantar' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-800">Confirmar implantação</p>
              <div>
                <label className="block text-xs font-medium text-emerald-700 mb-1">
                  Número da OV <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ovNumber}
                  onChange={e => setOvNumber(e.target.value)}
                  placeholder="Ex: OV-2026-001"
                  autoFocus
                  className="w-full text-sm border-2 border-emerald-300 focus:border-emerald-500 rounded-lg px-3 py-2 focus:outline-none bg-white font-mono"
                />
                {ovNumber.trim() === '' && (
                  <p className="text-xs text-red-500 mt-1">Informe o número da OV para confirmar</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => ovNumber.trim() && updateStatus(q.id, 'implantado', ovNumber.trim())}
                  disabled={!!busy || ovNumber.trim() === ''}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle2 size={14} /> Confirmar implantação</>}
                </button>
                <button onClick={() => { setConfirmMode(null); setOvNumber('') }} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          ) : confirmMode === 'perdida' ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-700 mb-2">Marcar como proposta perdida?</p>
              <div className="flex gap-2">
                <button onClick={() => updateStatus(q.id, 'perdida')} disabled={!!busy}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-60">
                  {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><XCircle size={14} /> Sim, perdida</>}
                </button>
                <button onClick={() => setConfirmMode(null)} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirmMode('implantar')}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Confirmar implantação
              </button>
              <button onClick={() => setConfirmMode('perdida')}
                className="px-4 py-3 border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm flex items-center justify-center gap-1">
                <XCircle size={15} /> Perdida
              </button>
            </div>
          )
        )}

        {isImpl && (
          <div className="bg-emerald-50 rounded-xl px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={13} /> Implantação confirmada
            </div>
            {kd.ov_numero && (
              <p className="text-xs text-emerald-600 font-mono pl-5">OV: <strong>{kd.ov_numero}</strong></p>
            )}
          </div>
        )}
        {isPerd && (
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <XCircle size={13} /> Proposta marcada como perdida
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-500" /> Kits Fechados
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {pending.length} aguardando confirmação · {implanted.length} implantados · {lost.length} perdidos
          </p>
        </div>
        <button onClick={fetchQuotes} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-weg-blue px-3 py-2 rounded-lg hover:bg-gray-100">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Awaiting implantation */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Package size={15} className="text-orange-500" /> Aguardando Confirmação
          </h4>
          {pending.length > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{pending.length}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-700 font-semibold text-sm">Nenhum kit aguardando confirmação</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pending.map(q => <KitCard key={q.id} q={q} />)}
          </div>
        )}
      </section>

      {/* Implanted */}
      {implanted.length > 0 && (
        <section>
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 mb-3">
            <CheckCircle2 size={15} className="text-emerald-500" /> Implantados
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{implanted.length}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {implanted.map(q => <KitCard key={q.id} q={q} />)}
          </div>
        </section>
      )}

      {/* Lost */}
      {lost.length > 0 && (
        <section>
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 mb-3">
            <XCircle size={15} className="text-red-500" /> Propostas Perdidas
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{lost.length}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lost.map(q => <KitCard key={q.id} q={q} />)}
          </div>
        </section>
      )}

      {quotes.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <Package size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Nenhum kit fechado ainda</h3>
          <p className="text-sm text-gray-400">Quando clientes fecharem kits, eles aparecerão aqui para confirmação.</p>
        </div>
      )}
    </div>
  )
}

// ─── Admin Dashboard (rendered only when authenticated) ───────────────────────
function AdminDashboard() {
  const { products, tableInfo, activeListCodes, saveProducts, saveTableInfo, setActiveListCodes, clearActiveList, addProduct, updateProduct, deleteProduct, resetToDefaults, syncDefaultPrices } = useProducts()
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('Todos')
  const [showAdd, setShowAdd] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const handleImport = (parsed, mode) => {
    const { products: imported, tableName } = parsed

    // Produtos fixos (Solo, Smart Home) nunca vêm do Excel — sempre preservados
    const importedCodes = new Set(imported.map(p => p.codigo))
    const fixedToKeep = fixedProducts.filter(p => !importedCodes.has(p.codigo))

    if (mode === 'full') {
      saveProducts([...imported, ...fixedToKeep])
    } else {
      // Atualiza preços por código SAP e adiciona produtos novos
      // Começa com os fixedProducts para garantir que sempre estão presentes
      const base = [
        ...products.filter(p => !fixedProducts.some(f => f.id === p.id)),
        ...fixedToKeep,
      ]
      const bySAP = {}
      base.forEach(p => { bySAP[p.codigo] = p })
      const merged = [...base]
      const seen = new Set(base.map(p => p.codigo))

      imported.forEach(imp => {
        if (bySAP[imp.codigo]) {
          const idx = merged.findIndex(p => p.codigo === imp.codigo && !fixedProducts.some(f => f.id === p.id))
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], preco: imp.preco, precoFrete: imp.precoFrete }
          }
        } else if (!seen.has(imp.codigo)) {
          merged.push(imp)
          seen.add(imp.codigo)
        }
      })
      saveProducts(merged)
    }

    // ── Salva whitelist com os SAP codes da lista importada ──
    // O catálogo e kit builder mostrarão apenas esses produtos
    setActiveListCodes(imported.map(p => p.codigo))

    if (tableName) {
      saveTableInfo({ ...tableInfo, nome: tableName })
    }
  }

  const filtered = useMemo(() => {
    let list = products
    if (catFilter !== 'Todos') list = list.filter(p => p.categoria === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.modelo || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [products, catFilter, search])

  const handlePrint = () => {
    window.print()
  }

  // ── Export helpers ──────────────────────────────────────────────────────────
  const buildRows = (list) => list.map(p => ({
    'Item SAP':       p.codigo,
    'Nome':           p.nome,
    'Modelo':         p.modelo || '',
    'Categoria':      p.categoria,
    'Tipo':           p.tipo || '',
    'Fabricante':     p.fabricante || '',
    'Potência':       p.potencia != null ? p.potencia : '',
    'Unid. Potência': p.unidadePotencia || '',
    'Tensão':         p.tensao || '',
    'Fase':           p.fase || '',
    'Preço (R$)':     p.preco != null ? p.preco.toFixed(2).replace('.', ',') : 'Sob consulta',
    'Estoque':        p.estoque || '',
    'Descrição':      (p.descricao || '').replace(/"/g, "'"),
  }))

  const exportCSV = (scope) => {
    const list   = scope === 'all' ? products : filtered
    const rows   = buildRows(list)
    const cols   = Object.keys(rows[0])
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
    const lines  = [
      cols.map(escape).join(';'),
      ...rows.map(r => cols.map(c => escape(r[c])).join(';')),
    ]
    const bom  = '﻿'
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    triggerDownload(blob, `WEG_Solar_${tableInfo.nome.replace(/\s/g, '_')}_${scope}.csv`)
  }

  const exportExcel = (scope) => {
    const list   = scope === 'all' ? products : filtered
    const rows   = buildRows(list)
    const cols   = Object.keys(rows[0])
    const esc    = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const header = cols.map(c => `<th style="background:#003087;color:#fff;padding:6px 10px;border:1px solid #ccc;white-space:nowrap">${esc(c)}</th>`).join('')
    const body   = rows.map(r =>
      `<tr>${cols.map((c, i) => `<td style="padding:5px 10px;border:1px solid #ddd;${i===6||i===8?'text-align:right':''}">${esc(r[c])}</td>`).join('')}</tr>`
    ).join('')
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;font-size:11px}th{font-weight:bold}tr:nth-child(even)td{background:#f4f6f8}</style>
</head><body>
<h2 style="color:#003087;font-family:Arial">${esc(tableInfo.nome)}</h2>
<p style="font-size:10px;color:#666">Exportado em ${new Date().toLocaleDateString('pt-BR')} — ${list.length} itens</p>
<table border="1" cellspacing="0" cellpadding="0"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
</body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    triggerDownload(blob, `WEG_Solar_${tableInfo.nome.replace(/\s/g, '_')}_${scope}.xls`)
  }

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [pendingDiscounts, setPendingDiscounts] = useState(0)
  const [pendingImplants, setPendingImplants]   = useState(0)
  const [pendingUsers, setPendingUsers]         = useState(0)

  // Carrega e atualiza badges de notificação
  const refreshBadges = () => {
    supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true })
      .eq('status', 'aguardando_desconto')
      .then(({ count }) => setPendingDiscounts(count || 0))
    supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true })
      .eq('status', 'fechado')
      .then(({ count }) => setPendingImplants(count || 0))
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .then(({ count }) => setPendingUsers(count || 0))
  }
  useEffect(() => {
    refreshBadges()
    const id = setInterval(refreshBadges, 30_000)
    return () => clearInterval(id)
  }, [activeTab])

  const totalValue = filtered.reduce((sum, p) => sum + (p.preco || 0), 0)

  const TABS = [
    { key: 'dashboard',      icon: TrendingUp, label: 'Dashboard',      badge: 0 },
    { key: 'produtos',       icon: Package,    label: 'Produtos',       badge: 0 },
    { key: 'usuarios',       icon: Users,      label: 'Usuários',       badge: pendingUsers },
    { key: 'cotacoes',       icon: LayoutList, label: 'Cotações',       badge: pendingDiscounts },
    { key: 'kits_fechados',  icon: CheckCircle2, label: 'Kits Fechados', badge: pendingImplants },
    { key: 'notificacoes',   icon: Bell,       label: 'Notificações',   badge: 0 },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'bg-weg-blue text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon size={15} /> {tab.label}
            {tab.badge > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                activeTab === tab.key ? 'bg-white text-weg-blue' : 'bg-red-500 text-white'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        <div className="ml-4 pl-3 border-l border-gray-200 flex items-center gap-1">
          <span className="text-xs text-gray-400">{profile?.nome}</span>
          <button
            onClick={signOut}
            title="Sair"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && <DashboardPanel onGoToTab={setActiveTab} />}

      {/* Tab: Usuários */}
      {activeTab === 'usuarios' && <UserManagement />}

      {/* Tab: Cotações */}
      {activeTab === 'cotacoes' && <QuoteManagement />}

      {/* Tab: Kits Fechados */}
      {activeTab === 'kits_fechados' && <KitsFechadosPanel onBadgeChange={setPendingImplants} />}

      {/* Tab: Notificações */}
      {activeTab === 'notificacoes' && <NotificationSettings />}

      {/* Tab: Produtos */}
      {activeTab === 'produtos' && <>

      {/* Table info */}
      <div className="mb-5">
        <TableInfoEditor tableInfo={tableInfo} onSave={saveTableInfo} onImportClick={() => setShowImport(true)} />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
            />
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-weg-blue"
          >
            <option value="Todos">Todas as categorias</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Indicador de produtos ativos vs total */}
          {activeListCodes && activeListCodes.size > 0 && (() => {
            const ativos = products.filter(p => activeListCodes.has(p.codigo)).length
            const total  = products.length
            return (
              <div className="flex items-center gap-2 text-xs bg-blue-50 border border-weg-blue/20 rounded-lg px-3 py-2">
                <span className="font-bold text-weg-blue">{ativos}</span>
                <span className="text-gray-500">na lista atual</span>
                {total - ativos > 0 && (
                  <span className="text-gray-400">({total - ativos} ocultos)</span>
                )}
                <button
                  onClick={clearActiveList}
                  className="ml-1 text-gray-400 hover:text-red-500 underline text-xs"
                  title="Remover filtro — mostrar todos os produtos"
                >
                  remover filtro
                </button>
              </div>
            )
          })()}

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
              <Plus size={15} /> Novo produto
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 border-2 border-green-600 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg font-semibold transition-colors"
              >
                <Download size={14} /> Exportar
                <ChevronDown size={13} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Exportar todos os itens</p>
                    </div>
                    <button
                      onClick={() => { exportCSV('all'); setShowExportMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                    >
                      <span className="text-lg">📄</span>
                      <div className="text-left">
                        <p className="font-semibold leading-tight">CSV — Todos ({products.length} itens)</p>
                        <p className="text-xs text-gray-400">Abre no Excel, Google Sheets</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { exportExcel('all'); setShowExportMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors border-t border-gray-50"
                    >
                      <span className="text-lg">📊</span>
                      <div className="text-left">
                        <p className="font-semibold leading-tight">Excel — Todos ({products.length} itens)</p>
                        <p className="text-xs text-gray-400">Formatado com cores WEG</p>
                      </div>
                    </button>

                    {filtered.length !== products.length && (
                      <>
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Exportar vista atual</p>
                        </div>
                        <button
                          onClick={() => { exportCSV('filtered'); setShowExportMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <span className="text-lg">📄</span>
                          <div className="text-left">
                            <p className="font-semibold leading-tight">CSV — Filtrado ({filtered.length} itens)</p>
                            <p className="text-xs text-gray-400">Somente itens exibidos</p>
                          </div>
                        </button>
                        <button
                          onClick={() => { exportExcel('filtered'); setShowExportMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-t border-gray-50"
                        >
                          <span className="text-lg">📊</span>
                          <div className="text-left">
                            <p className="font-semibold leading-tight">Excel — Filtrado ({filtered.length} itens)</p>
                            <p className="text-xs text-gray-400">Somente itens exibidos</p>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button onClick={handlePrint} className="btn-outline flex items-center gap-1.5 text-sm px-3 py-2">
              <Printer size={14} /> Imprimir
            </button>
            <button
              onClick={() => {
                const count = syncDefaultPrices()
                setSyncMsg(count > 0
                  ? `${count} preco${count !== 1 ? 's' : ''} atualizado${count !== 1 ? 's' : ''} da tabela oficial`
                  : 'Todos os precos ja estao atualizados')
                setTimeout(() => setSyncMsg(''), 4000)
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50"
            >
              <RefreshCw size={14} /> Sincronizar precos
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
            >
              <RefreshCw size={14} /> Restaurar padrao
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          <span>{filtered.length} produto{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>{products.length} total no catálogo</span>
        </div>
      </div>

      {/* Sync price toast */}
      {syncMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-green-800">
          <RefreshCw size={15} className="text-green-600 shrink-0" />
          {syncMsg}
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <p className="text-sm text-orange-800 font-medium">
              Restaurar o catálogo vai apagar todas as alterações. Confirmar?
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { resetToDefaults(); setShowResetConfirm(false) }}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg">
              Sim, restaurar
            </button>
            <button onClick={() => setShowResetConfirm(false)}
              className="bg-white border border-orange-200 text-orange-600 text-sm font-medium px-4 py-1.5 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Freight + Discount row */}
      <DescontoCard />
      <FreteSection />

      {/* Products table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produto / SAP</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Potência</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Preço</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estoque</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onUpdate={updateProduct}
                  onDelete={deleteProduct}
                />
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum produto encontrado</p>
          </div>
        )}

        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
          <span>Tabela: {tableInfo.nome}</span>
          <span>{filtered.length} itens — {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Add product modal */}
      {showAdd && <AddProductModal onAdd={addProduct} onClose={() => setShowAdd(false)} />}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      </> /* end Produtos tab */}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  return <AdminDashboard />
}
