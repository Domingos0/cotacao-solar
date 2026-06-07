import { createContext, useContext, useState, useCallback } from 'react'
import { products as defaultProducts, assignKitRole } from '../data/products'

const ProductsContext = createContext()

const STORAGE_KEY   = 'weg_products_v2'
const TABLE_KEY     = 'weg_table_info'
const FRETE_KEY     = 'weg_frete_opcoes'
const DESCONTO_KEY  = 'weg_desconto'
const AUTH_KEY      = 'weg_admin_auth'

export const DEFAULT_FRETE = [
  { id: 1, nome: 'FOB – Retirada em nossa fábrica WEG em Itajaí-SC', acrescimo: 1.000 },
  { id: 2, nome: 'CIF – Sem descarga – Região Sul',                   acrescimo: 1.045 },
  { id: 3, nome: 'CIF – Sem descarga – Região Sudeste',               acrescimo: 1.055 },
  { id: 4, nome: 'CIF – Sem descarga – Região Centro Oeste',          acrescimo: 1.075 },
  { id: 5, nome: 'CIF – Sem descarga – Região Nordeste',              acrescimo: 1.085 },
  { id: 6, nome: 'CIF – Sem descarga – Região Norte',                 acrescimo: 1.110 },
]

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
  } catch {
    return DEFAULT_FRETE
  }
}

const r2 = v => v != null ? Math.round(v * 100) / 100 : v

function normalizeProduct(p) {
  return { ...p, preco: r2(p.preco), precoFrete: r2(p.precoFrete) }
}

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultProducts.map(normalizeProduct)

    // Build lookup of official prices by SAP code
    const officialPrices = {}
    defaultProducts.forEach(p => {
      if (p.preco != null) officialPrices[p.codigo] = { preco: r2(p.preco), precoFrete: r2(p.preco), ipi: p.ipi }
    })

    const parsed = JSON.parse(saved)
    const merged = parsed.map(p => {
      const off = officialPrices[p.codigo]
      const base = normalizeProduct({
        ...p,
        kitRole: p.kitRole !== undefined ? p.kitRole : assignKitRole(p),
      })
      // Apply official price if it differs (keeps localStorage data synced with price list)
      if (off && (base.preco !== off.preco || base.precoFrete !== off.precoFrete)) {
        return { ...base, preco: off.preco, precoFrete: off.precoFrete, ipi: off.ipi ?? base.ipi }
      }
      return base
    })

    // Save merged back to localStorage so subsequent reads are up to date
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged
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

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(loadProducts)
  const [tableInfo, setTableInfo] = useState(loadTableInfo)
  const [freteOpcoes, setFreteOpcoes] = useState(loadFrete)
  const [desconto, setDesconto]       = useState(loadDesconto)
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')

  const saveProducts = useCallback((newProducts) => {
    setProducts(newProducts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProducts))
  }, [])

  const saveTableInfo = useCallback((info) => {
    setTableInfo(info)
    localStorage.setItem(TABLE_KEY, JSON.stringify(info))
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

  // Apply updated prices from defaultProducts to current products by SAP code
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
  }, [])

  const saveFrete = useCallback((opcoes) => {
    setFreteOpcoes(opcoes)
    localStorage.setItem(FRETE_KEY, JSON.stringify(opcoes))
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
      tableInfo,
      freteOpcoes,
      desconto,
      isAdmin,
      saveProducts,
      saveTableInfo,
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
