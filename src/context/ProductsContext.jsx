import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { products as defaultProducts, assignKitRole } from '../data/products'
import { supabase } from '../lib/supabase'

const ProductsContext = createContext()

const STORAGE_KEY         = 'weg_products_v2'
const TABLE_KEY           = 'weg_table_info'
const FRETE_KEY           = 'weg_frete_opcoes'
const DESCONTO_KEY        = 'weg_desconto'
const ACTIVE_LIST_KEY     = 'weg_active_list_sap'
const CONDICOES_KEY       = 'weg_condicoes'
const CATALOG_VERSION_KEY = 'weg_catalog_version_id'

export const DEFAULT_CONDICOES =
`Preços FOB Itajaí-SC. Sujeitos a alteração sem aviso prévio.
Validade desta proposta: 7 dias a partir da data de emissão.
Dúvidas: (94) 9209-0380 · vendas@ernaniff.com.br`

export const DEFAULT_FRETE = [
  { id: 1, nome: 'FOB – Retirada em nossa fábrica WEG em Itajaí-SC', acrescimo: 1.000 },
  { id: 2, nome: 'CIF – Sem descarga – Região Sul',                   acrescimo: 1.045 },
  { id: 3, nome: 'CIF – Sem descarga – Região Sudeste',               acrescimo: 1.055 },
  { id: 4, nome: 'CIF – Sem descarga – Região Centro Oeste',          acrescimo: 1.075 },
  { id: 5, nome: 'CIF – Sem descarga – Região Nordeste',              acrescimo: 1.085 },
  { id: 6, nome: 'CIF – Sem descarga – Região Norte',                 acrescimo: 1.110 },
]

// ─── Supabase persistence (catálogo versionado) ───────────────────────────────
// Em desenvolvimento (localhost), todo acesso ao Supabase é bloqueado.
// O catálogo usa apenas localStorage + dados padrão, sem conflito com produção.
const IS_DEV = import.meta.env.DEV

// Busca a versão publicada do catálogo (produtos, lista ativa, frete, desconto,
// condições). Retorna null em qualquer erro (ex: migração ainda não aplicada),
// degradando graciosamente para o comportamento local/offline existente.
async function fetchPublishedCatalog(versionId) {
  const [verRes, prodRes, codesRes, freteRes, descRes] = await Promise.all([
    supabase.from('price_catalog_versions').select('*').eq('id', versionId).maybeSingle(),
    supabase.from('price_catalog_products').select('data').eq('version_id', versionId),
    supabase.from('price_catalog_active_codes').select('codigo').eq('version_id', versionId),
    supabase.from('freight_options').select('nome, acrescimo').eq('version_id', versionId).order('acrescimo', { ascending: true }),
    supabase.from('discount_defaults').select('desconto').eq('version_id', versionId).maybeSingle(),
  ])
  return {
    version:   verRes.data || null,
    products:  (prodRes.data || []).map(r => r.data),
    codes:     (codesRes.data || []).map(r => r.codigo),
    frete:     freteRes.data || [],
    desconto:  descRes.data ? descRes.data.desconto : null,
  }
}

// ─── localStorage loaders ─────────────────────────────────────────────────────
function loadDesconto() {
  try {
    const saved = localStorage.getItem(DESCONTO_KEY)
    return saved !== null ? Number(saved) : 0
  } catch { return 0 }
}

function loadCondicoes() {
  try {
    const saved = localStorage.getItem(CONDICOES_KEY)
    return saved !== null ? saved : DEFAULT_CONDICOES
  } catch { return DEFAULT_CONDICOES }
}

function loadFrete() {
  try {
    const saved = localStorage.getItem(FRETE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_FRETE
  } catch { return DEFAULT_FRETE }
}

function loadActiveListCodes() {
  try {
    const saved = localStorage.getItem(ACTIVE_LIST_KEY)
    return saved ? new Set(JSON.parse(saved)) : null
  } catch { return null }
}

const r2 = v => v != null ? Math.round(v * 100) / 100 : v

function normalizeProduct(p) {
  return { ...p }
}

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultProducts.map(normalizeProduct)

    const parsed = JSON.parse(saved)
    const savedCodes = new Set(parsed.map(p => p.codigo))

    const savedList = parsed.map(p => normalizeProduct({
      ...p,
      kitRole: p.kitRole !== undefined ? p.kitRole : assignKitRole(p),
    }))

    const newProducts = defaultProducts
      .filter(p => !savedCodes.has(p.codigo))
      .map(normalizeProduct)

    return [...savedList, ...newProducts]
  } catch {
    return defaultProducts.map(normalizeProduct)
  }
}

function loadTableInfo() {
  try {
    const saved = localStorage.getItem(TABLE_KEY)
    return saved ? JSON.parse(saved) : {
      nome: 'Lista Novembro 2025 R0',
      mes: '2025-11',
      versao: 'R0',
      observacao: 'Preços FOB Itajaí-SC. Sujeitos a alteração sem aviso prévio.',
      validityDays: 7,
    }
  } catch {
    return { nome: 'Lista Novembro 2025 R0', mes: '2025-11', versao: 'R0', observacao: '', validityDays: 7 }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(loadProducts)
  const [tableInfo, setTableInfo] = useState(loadTableInfo)
  const [freteOpcoes, setFreteOpcoes] = useState(loadFrete)
  const [desconto, setDesconto]       = useState(loadDesconto)
  const [activeListCodes, setActiveListCodesState] = useState(loadActiveListCodes)
  const [condicoes, setCondicoes] = useState(loadCondicoes)

  // Erro global de gravação do catálogo (rascunho no Supabase) — todas as
  // funções save* abaixo gravam no localStorage/state local IMEDIATAMENTE
  // (por isso a tela sempre parece "salvar na hora"), mas a escrita real no
  // banco é assíncrona em segundo plano. Antes, se essa escrita falhasse, o
  // erro só ia pro console — a tela continuava dizendo "salvo" mesmo com o
  // rascunho no banco desatualizado. Centraliza isso aqui num state exposto
  // pelo contexto, pra qualquer tela mostrar um aviso quando acontecer.
  const [catalogSaveError, setCatalogSaveError] = useState(null)
  const clearCatalogSaveError = useCallback(() => setCatalogSaveError(null), [])
  const reportCatalogSaveError = useCallback((label, e) => {
    console.warn(`[catalog] ${label} error:`, e?.message)
    setCatalogSaveError(`Falha ao sincronizar "${label}" com o servidor — suas alterações ficaram só neste navegador até você tentar de novo. (${e?.message || 'erro desconhecido'})`)
  }, [])

  // id da versão de rascunho em edição (admin), resolvido sob demanda e
  // reaproveitado enquanto durar esta sessão. Guardamos a PROMISE (não só o
  // id) para que várias gravações disparadas ao mesmo tempo — ex.: importar
  // planilha grava produtos + lista ativa + nome da tabela de uma vez —
  // compartilhem o mesmo rascunho em vez de criar rascunhos concorrentes.
  const draftPromiseRef = useRef(null)

  const ensureDraftVersion = useCallback(() => {
    if (!draftPromiseRef.current) {
      draftPromiseRef.current = (async () => {
        const { data, error } = await supabase.rpc('get_or_create_draft_catalog_version')
        if (error) throw error
        if (!data) throw new Error('rascunho do catálogo não retornado')
        return data
      })().catch(e => {
        draftPromiseRef.current = null // permite tentar de novo na próxima gravação
        throw e
      })
    }
    return draftPromiseRef.current
  }, [])

  // Gravações no rascunho ainda em andamento. publishCatalog() espera todas
  // terminarem antes de publicar — senão publicaria o rascunho sem a planilha.
  const pendingWritesRef = useRef(new Set())
  // true quando há alterações gravadas no rascunho que ainda não foram publicadas
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)

  // Executa uma gravação no rascunho: resolve o rascunho, roda `fn(draftId)`,
  // trata erros do Supabase (que vêm em { error }, não como exceção) e
  // registra a promise como pendente. Retorna { ok, error }.
  const writeDraft = useCallback((label, fn) => {
    if (IS_DEV) return Promise.resolve({ ok: true })
    const p = (async () => {
      try {
        const draftId = await ensureDraftVersion()
        const results = await fn(draftId)
        const list = Array.isArray(results) ? results : [results]
        const failed = list.find(r => r && r.error)
        if (failed) throw failed.error
        setHasUnpublishedChanges(true)
        return { ok: true }
      } catch (e) {
        reportCatalogSaveError(label, e)
        return { ok: false, error: e?.message || String(e) }
      }
    })()
    pendingWritesRef.current.add(p)
    p.finally(() => pendingWritesRef.current.delete(p))
    return p
  }, [ensureDraftVersion, reportCatalogSaveError])

  // Compara a versão publicada com a que está em cache e só refaz o fetch
  // quando elas divergem — corrige o bug de cache desatualizado. Roda ao
  // abrir o site E periodicamente depois (ver useEffect abaixo), pra quem
  // deixa a aba aberta por muito tempo não ficar preso numa lista antiga
  // sem precisar dar F5.
  const checkCatalogVersion = useCallback(async ({ signal } = {}) => {
    if (IS_DEV) return
    try {
      const { data: versionId, error } = await supabase.rpc('current_catalog_version')
      if (error) throw error
      if (signal?.cancelled || !versionId) return
      if (localStorage.getItem(CATALOG_VERSION_KEY) === versionId) return

      const { version, products: prods, codes, frete, desconto: desc } = await fetchPublishedCatalog(versionId)
      if (signal?.cancelled) return
      if (!prods.length) return // versão publicada sem produtos: mantém fallback local

      const restored = prods.map(p => normalizeProduct({ ...p, kitRole: p.kitRole ?? assignKitRole(p) }))
      setProducts(restored)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored))

      if (codes.length) {
        setActiveListCodesState(new Set(codes))
        localStorage.setItem(ACTIVE_LIST_KEY, JSON.stringify(codes))
      }

      if (version) {
        const tinfo = {
          nome: version.label, mes: version.vigencia_mes, versao: version.versao, observacao: version.observacao,
          validityDays: version.validity_days ?? 7,
        }
        setTableInfo(tinfo)
        localStorage.setItem(TABLE_KEY, JSON.stringify(tinfo))

        if (typeof version.condicoes === 'string' && version.condicoes) {
          setCondicoes(version.condicoes)
          localStorage.setItem(CONDICOES_KEY, version.condicoes)
        }
      }

      if (frete.length) {
        const freteWithIds = frete.map((f, i) => ({ id: i + 1, nome: f.nome, acrescimo: f.acrescimo }))
        setFreteOpcoes(freteWithIds)
        localStorage.setItem(FRETE_KEY, JSON.stringify(freteWithIds))
      }

      if (desc !== null && desc !== undefined) {
        setDesconto(Number(desc))
        localStorage.setItem(DESCONTO_KEY, String(desc))
      }

      localStorage.setItem(CATALOG_VERSION_KEY, versionId)
    } catch (e) {
      console.warn('[catalog] version check error:', e?.message)
    }
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const signal = { cancelled: false }
    checkCatalogVersion({ signal })

    // Reconfirma periodicamente (sem precisar recarregar a página) e também
    // quando a aba volta a ficar visível — cobre quem deixa o navegador
    // aberto enquanto o admin publica uma lista nova.
    const intervalId = setInterval(() => checkCatalogVersion(), 5 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') checkCatalogVersion() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      signal.cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkCatalogVersion])

  const catalogProducts = React.useMemo(() => {
    if (!activeListCodes || activeListCodes.size === 0) return products
    return products.filter(p => activeListCodes.has(p.codigo))
  }, [products, activeListCodes])

  const saveProducts = useCallback((newProducts) => {
    setProducts(newProducts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProducts))
    return writeDraft('produtos', draftId =>
      supabase.rpc('replace_catalog_products', { p_version_id: draftId, p_products: newProducts }))
  }, [writeDraft])

  const saveTableInfo = useCallback((info) => {
    setTableInfo(info)
    localStorage.setItem(TABLE_KEY, JSON.stringify(info))
    return writeDraft('dados da tabela', draftId =>
      supabase.from('price_catalog_versions').update({
        label: info.nome, vigencia_mes: info.mes, versao: info.versao, observacao: info.observacao,
        validity_days: Math.max(1, Number(info.validityDays) || 7),
      }).eq('id', draftId))
  }, [writeDraft])

  const replaceActiveCodes = useCallback((arr) =>
    writeDraft('lista ativa', async (draftId) => {
      const del = await supabase.from('price_catalog_active_codes').delete().eq('version_id', draftId)
      if (del.error || !arr.length) return del
      return supabase.from('price_catalog_active_codes').insert(arr.map(codigo => ({ version_id: draftId, codigo })))
    }), [writeDraft])

  const setActiveListCodes = useCallback((codes) => {
    const s = codes && codes.length > 0 ? new Set(codes) : null
    setActiveListCodesState(s)
    if (s) {
      const arr = [...s]
      localStorage.setItem(ACTIVE_LIST_KEY, JSON.stringify(arr))
      return replaceActiveCodes(arr)
    }
    localStorage.removeItem(ACTIVE_LIST_KEY)
    return replaceActiveCodes([])
  }, [replaceActiveCodes])

  const clearActiveList = useCallback(() => {
    setActiveListCodesState(null)
    localStorage.removeItem(ACTIVE_LIST_KEY)
    return replaceActiveCodes([])
  }, [replaceActiveCodes])

  const addProduct = useCallback((product) => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1
    const newProduct = normalizeProduct({ ...product, id: newId })
    const updated = [...products, newProduct]
    saveProducts(updated)
    return newProduct
  }, [products, saveProducts])

  const updateProduct = useCallback((id, updates) => {
    const updated = products.map(p => p.id === id ? { ...p, ...updates } : p)
    saveProducts(updated)
  }, [products, saveProducts])

  const deleteProduct = useCallback((id) => {
    const updated = products.filter(p => p.id !== id)
    saveProducts(updated)
  }, [products, saveProducts])

  const resetToDefaults = useCallback(() => {
    saveProducts(defaultProducts)
  }, [saveProducts])

  const syncDefaultPrices = useCallback(() => {
    const byCode = {}
    defaultProducts.forEach(p => { byCode[p.codigo] = p })
    let count = 0
    const updated = products.map(p => {
      const def = byCode[p.codigo]
      if (!def || def.preco == null) return p
      const defPreco = r2(def.preco)
      const changed = p.preco !== defPreco || p.precoFrete !== defPreco
      if (changed) count++
      return changed ? { ...p, preco: defPreco, precoFrete: defPreco, ipi: def.ipi ?? p.ipi } : p
    })
    saveProducts(updated)
    return count
  }, [products, saveProducts])

  const saveDesconto = useCallback((val) => {
    const v = Math.min(100, Math.max(0, Number(val) || 0))
    setDesconto(v)
    localStorage.setItem(DESCONTO_KEY, String(v))
    return writeDraft('desconto padrão', draftId =>
      supabase.from('discount_defaults').upsert({ version_id: draftId, desconto: v }))
  }, [writeDraft])

  const saveCondicoes = useCallback((texto) => {
    const v = typeof texto === 'string' ? texto : DEFAULT_CONDICOES
    setCondicoes(v)
    localStorage.setItem(CONDICOES_KEY, v)
    return writeDraft('condições comerciais', draftId =>
      supabase.from('price_catalog_versions').update({ condicoes: v }).eq('id', draftId))
  }, [writeDraft])

  const saveFrete = useCallback((opcoes) => {
    setFreteOpcoes(opcoes)
    localStorage.setItem(FRETE_KEY, JSON.stringify(opcoes))
    return writeDraft('opções de frete', async (draftId) => {
      const del = await supabase.from('freight_options').delete().eq('version_id', draftId)
      if (del.error || !opcoes.length) return del
      return supabase.from('freight_options').insert(opcoes.map(o => ({ version_id: draftId, nome: o.nome, acrescimo: o.acrescimo })))
    })
  }, [writeDraft])

  const addFreteOpcao = useCallback((opcao) => {
    const nextId = Math.max(...freteOpcoes.map(f => f.id), 0) + 1
    saveFrete([...freteOpcoes, { ...opcao, id: nextId }])
  }, [freteOpcoes, saveFrete])

  const updateFreteOpcao = useCallback((id, updates) => {
    saveFrete(freteOpcoes.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [freteOpcoes, saveFrete])

  const deleteFreteOpcao = useCallback((id) => {
    saveFrete(freteOpcoes.filter(f => f.id !== id))
  }, [freteOpcoes, saveFrete])

  const resetFrete = useCallback(() => {
    saveFrete(DEFAULT_FRETE)
  }, [saveFrete])

  // Publica a versão de rascunho em edição, tornando-a a versão oficial
  // vista por todos os usuários (via current_catalog_version()). Antes de
  // publicar, espera todas as gravações pendentes no rascunho terminarem.
  const publishCatalog = useCallback(async () => {
    if (IS_DEV) return { ok: false, error: 'Publicação indisponível em desenvolvimento.' }
    const pending = [...pendingWritesRef.current]
    const results = await Promise.all(pending)
    const failed = results.find(r => r && !r.ok)
    if (failed) return { ok: false, error: `Uma gravação falhou, nada foi publicado: ${failed.error}` }

    let draftId
    try { draftId = await ensureDraftVersion() }
    catch (e) { return { ok: false, error: 'Não foi possível preparar a versão para publicação: ' + (e?.message || '') } }

    try {
      const { error } = await supabase.rpc('publish_price_catalog', { p_version_id: draftId })
      if (error) throw error
      draftPromiseRef.current = null
      setHasUnpublishedChanges(false)
      localStorage.setItem(CATALOG_VERSION_KEY, draftId)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e?.message || 'Erro ao publicar.' }
    }
  }, [ensureDraftVersion])

  return (
    <ProductsContext.Provider value={{
      products,
      catalogProducts,
      activeListCodes,
      tableInfo,
      freteOpcoes,
      desconto,
      saveProducts,
      saveTableInfo,
      setActiveListCodes,
      clearActiveList,
      addProduct,
      updateProduct,
      deleteProduct,
      resetToDefaults,
      syncDefaultPrices,
      saveDesconto,
      condicoes,
      saveCondicoes,
      saveFrete,
      addFreteOpcao,
      updateFreteOpcao,
      deleteFreteOpcao,
      resetFrete,
      publishCatalog,
      hasUnpublishedChanges,
      catalogSaveError,
      clearCatalogSaveError,
    }}>
      {children}
      {/* Aviso global: aparece em qualquer tela sempre que uma gravação do
          catálogo falhar em segundo plano (ver reportCatalogSaveError acima) —
          sem isso, a tela mostrava "salvo" mesmo com a escrita no banco falha. */}
      {catalogSaveError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, maxWidth: 380 }}
          className="bg-red-50 border border-red-300 rounded-xl shadow-lg p-4 text-sm text-red-800 flex items-start gap-2">
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Erro ao salvar no servidor</p>
            <p className="text-xs">{catalogSaveError}</p>
          </div>
          <button onClick={clearCatalogSaveError} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
        </div>
      )}
    </ProductsContext.Provider>
  )
}

export const useProducts = () => useContext(ProductsContext)
