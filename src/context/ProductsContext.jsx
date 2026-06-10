import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { products as defaultProducts, assignKitRole } from '../data/products'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const ProductsContext = createContext()

const STORAGE_KEY      = 'weg_products_v2'
const TABLE_KEY        = 'weg_table_info'
const FRETE_KEY        = 'weg_frete_opcoes'
const DESCONTO_KEY     = 'weg_desconto'
const AUTH_KEY         = 'weg_admin_auth'
const ACTIVE_LIST_KEY  = 'weg_active_list_sap'

export const DEFAULT_FRETE = [
  { id: 1, nome: 'FOB – Retirada em nossa fábrica WEG em Itajaí-SC', acrescimo: 1.000 },
  { id: 2, nome: 'CIF – Sem descarga – Região Sul',                   acrescimo: 1.045 },
  { id: 3, nome: 'CIF – Sem descarga – Região Sudeste',               acrescimo: 1.055 },
  { id: 4, nome: 'CIF – Sem descarga – Região Centro Oeste',          acrescimo: 1.075 },
  { id: 5, nome: 'CIF – Sem descarga – Região Nordeste',              acrescimo: 1.085 },
  { id: 6, nome: 'CIF – Sem descarga – Região Norte',                 acrescimo: 1.110 },
]

// ─── Supabase persistence helpers ─────────────────────────────────────────────
async function sbSave(key, value) {
  try {
    await supabaseAdmin
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
  } catch (e) { console.warn('[settings] save error:', e?.message) }
}

async function sbLoad(key) {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data?.value ?? null
  } catch { return null }
}

// ─── localStorage loaders ─────────────────────────────────────────────────────
function loadDesconto() {
  try {
    const saved = localStorage.getItem(DESCONTO_KEY)
    return saved !== null ? Number(saved) : 0
  } catch { return 0 }
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
  return { ...p, preco: r2(p.preco), precoFrete: r2(p.precoFrete) }
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
    }
  } catch {
    return { nome: 'Lista Novembro 2025 R0', mes: '2025-11', versao: 'R0', observacao: '' }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(loadProducts)
  const [tableInfo, setTableInfo] = useState(loadTableInfo)
  const [freteOpcoes, setFreteOpcoes] = useState(loadFrete)
  const [desconto, setDesconto]       = useState(loadDesconto)
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [activeListCodes, setActiveListCodesState] = useState(loadActiveListCodes)

  // Na inicialização: se o localStorage não tem dados importados (cache foi limpo),
  // restaura do Supabase automaticamente
  useEffect(() => {
    const hasLocal = localStorage.getItem(ACTIVE_LIST_KEY) !== null
    if (hasLocal) return // localStorage OK, não precisa buscar do Supabase

    Promise.all([
      sbLoad('catalog_products'),
      sbLoad('catalog_active_codes'),
      sbLoad('catalog_table_info'),
      sbLoad('catalog_frete'),
      sbLoad('catalog_desconto'),
    ]).then(([prods, codes, tinfo, frete, desc]) => {
      if (prods) {
        const restored = prods.map(p => normalizeProduct({ ...p, kitRole: p.kitRole ?? assignKitRole(p) }))
        setProducts(restored)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored))
      }
      if (codes) {
        const s = new Set(codes)
        setActiveListCodesState(s)
        localStorage.setItem(ACTIVE_LIST_KEY, JSON.stringify(codes))
      }
      if (tinfo) {
        setTableInfo(tinfo)
        localStorage.setItem(TABLE_KEY, JSON.stringify(tinfo))
      }
      if (frete) {
        setFreteOpcoes(frete)
        localStorage.setItem(FRETE_KEY, JSON.stringify(frete))
      }
      if (desc !== null) {
        const d = Number(desc)
        setDesconto(d)
        localStorage.setItem(DESCONTO_KEY, String(d))
      }
    }).catch(e => console.warn('[catalog] restore error:', e?.message))
  }, [])

  const catalogProducts = React.useMemo(() => {
    if (!activeListCodes || activeListCodes.size === 0) return products
    return products.filter(p => activeListCodes.has(p.codigo))
  }, [products, activeListCodes])

  const saveProducts = useCallback((newProducts) => {
    setProducts(newProducts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProducts))
    sbSave('catalog_products', newProducts)
  }, [])

  const saveTableInfo = useCallback((info) => {
    setTableInfo(info)
    localStorage.setItem(TABLE_KEY, JSON.stringify(info))
    sbSave('catalog_table_info', info)
  }, [])

  const setActiveListCodes = useCallback((codes) => {
    const s = codes && codes.length > 0 ? new Set(codes) : null
    setActiveListCodesState(s)
    if (s) {
      const arr = [...s]
      localStorage.setItem(ACTIVE_LIST_KEY, JSON.stringify(arr))
      sbSave('catalog_active_codes', arr)
    } else {
      localStorage.removeItem(ACTIVE_LIST_KEY)
      sbSave('catalog_active_codes', null)
    }
  }, [])

  const clearActiveList = useCallback(() => {
    setActiveListCodesState(null)
    localStorage.removeItem(ACTIVE_LIST_KEY)
    sbSave('catalog_active_codes', null)
  }, [])

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
    sbSave('catalog_desconto', v)
  }, [])

  const saveFrete = useCallback((opcoes) => {
    setFreteOpcoes(opcoes)
    localStorage.setItem(FRETE_KEY, JSON.stringify(opcoes))
    sbSave('catalog_frete', opcoes)
  }, [])

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

  const login = useCallback((password) => {
    if (password === 'WEG@2025') {
      sessionStorage.setItem(AUTH_KEY, '1')
      setIsAdmin(true)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY)
    setIsAdmin(false)
  }, [])

  return (
    <ProductsContext.Provider value={{
      products,
      catalogProducts,
      activeListCodes,
      tableInfo,
      freteOpcoes,
      desconto,
      isAdmin,
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
      saveFrete,
      addFreteOpcao,
      updateFreteOpcao,
      deleteFreteOpcao,
      resetFrete,
      login,
      logout,
    }}>
      {children}
    </ProductsContext.Provider>
  )
}

export const useProducts = () => useContext(ProductsContext)
