import { useState, useMemo, useEffect, useCallback } from 'react'
import { ProductsProvider, useProducts } from './context/ProductsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import HeroBanner from './components/HeroBanner'
import FilterSidebar from './components/FilterSidebar'
import ProductCard from './components/ProductCard'
import ProductDetail from './components/ProductDetail'
import AdminPage from './pages/AdminPage'
import KitBuilder from './pages/KitBuilder'
import MinhasCotacoesPage from './pages/MinhasCotacoesPage'
import LoginPage from './pages/LoginPage'
import CadastroPage from './pages/CadastroPage'
import { CATEGORIES } from './data/products'
import { Search, Clock } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'default', label: 'Padrão' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome A-Z' },
  { value: 'power-desc', label: 'Maior potência' },
]

function CatalogPage({ searchQuery, setSearchQuery }) {
  const { products } = useProducts()
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [sortBy, setSortBy] = useState('default')

  const counts = useMemo(() => {
    const result = {}
    products.forEach(p => { result[p.categoria] = (result[p.categoria] || 0) + 1 })
    return result
  }, [products])

  const filtered = useMemo(() => {
    let list = products
    if (selectedCategory) list = list.filter(p => p.categoria === selectedCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.modelo || '').toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.tipo.toLowerCase().includes(q) ||
        (p.descricao || '').toLowerCase().includes(q)
      )
    }
    switch (sortBy) {
      case 'price-asc': return [...list].sort((a, b) => (a.preco || Infinity) - (b.preco || Infinity))
      case 'price-desc': return [...list].sort((a, b) => (b.preco || 0) - (a.preco || 0))
      case 'name': return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      case 'power-desc': return [...list].sort((a, b) => (b.potencia || 0) - (a.potencia || 0))
      default: return list
    }
  }, [products, searchQuery, selectedCategory, sortBy])

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat)
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <HeroBanner />
      <div id="catalogo" className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <FilterSidebar
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            counts={counts}
            total={products.length}
          />

          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCategory || 'Todos os Produtos'}</h2>
                <p className="text-sm text-gray-400">
                  {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
                  {searchQuery && <span> para "<span className="text-weg-blue font-medium">{searchQuery}</span>"</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 shrink-0">Ordenar:</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-weg-blue text-gray-700"
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Active filters */}
            {(selectedCategory || searchQuery) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategory && <FilterChip label={selectedCategory} onRemove={() => setSelectedCategory(null)} />}
                {searchQuery && <FilterChip label={`Busca: "${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
              </div>
            )}

            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(product => (
                  <ProductCard key={product.id} product={product} onClick={setSelectedProduct} />
                ))}
              </div>
            ) : (
              <EmptyState query={searchQuery} onReset={() => { setSearchQuery(''); setSelectedCategory(null) }} />
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-weg-blue text-white text-xs font-medium px-3 py-1.5 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-white/70 ml-0.5">✕</button>
    </span>
  )
}

function EmptyState({ query, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-weg-gray rounded-full w-20 h-20 flex items-center justify-center mb-4">
        <Search size={32} className="text-gray-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum produto encontrado</h3>
      {query && <p className="text-gray-400 text-sm mb-6">Sem resultados para "<span className="font-medium text-gray-600">{query}</span>".</p>}
      <button onClick={onReset} className="btn-primary">Limpar filtros</button>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-weg-gray flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-weg-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando…</p>
      </div>
    </div>
  )
}

function PendingScreen({ onLogout, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)

  const check = useCallback(async () => {
    setChecking(true)
    await onRefresh()
    setLastCheck(new Date())
    setChecking(false)
  }, [onRefresh])

  // Polling automático a cada 15 segundos
  useEffect(() => {
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [check])

  return (
    <div className="min-h-screen bg-weg-gray flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-8 text-center">
        <Clock size={48} className="text-weg-blue mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cadastro em análise</h2>
        <p className="text-gray-500 text-sm mb-2">
          Seu cadastro está aguardando aprovação do administrador.
          Você receberá acesso assim que for aprovado.
        </p>
        {lastCheck && (
          <p className="text-xs text-gray-300 mb-4">
            Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
          </p>
        )}
        <button
          onClick={check}
          disabled={checking}
          className="w-full btn-primary py-2.5 text-sm mb-3 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {checking
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verificando…</>
            : <><Clock size={15} /> Verificar aprovação</>}
        </button>
        <button onClick={onLogout} className="btn-outline w-full py-2.5 text-sm">
          Sair
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const { session, loading, isAdmin, isAtivo, signOut, refreshProfile } = useAuth()
  const [page, setPage] = useState('catalog')
  const [authPage, setAuthPage] = useState('login')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadedQuote, setLoadedQuote] = useState(null) // { quoteData, savedId }

  const handleLoadQuote = ({ quoteData, savedId }) => {
    setLoadedQuote({ quoteData, savedId })
    setPage('kit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <LoadingScreen />

  if (!session) {
    if (authPage === 'register') return <CadastroPage onGoToLogin={() => setAuthPage('login')} />
    return <LoginPage onGoToRegister={() => setAuthPage('register')} />
  }

  if (!isAdmin && !isAtivo) return <PendingScreen onLogout={signOut} onRefresh={refreshProfile} />

  const handlePageChange = (p) => {
    if (p === 'kit') setLoadedQuote(null) // novo kit sempre começa do zero via nav
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-weg-gray">
      <Header
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        page={page}
        onPageChange={handlePageChange}
      />

      <main className="flex-1">
        {page === 'catalog' && <CatalogPage searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {page === 'kit' && (
          <KitBuilder
            key={loadedQuote?.savedId || 'new'}
            initialData={loadedQuote?.quoteData}
            initialSavedId={loadedQuote?.savedId}
          />
        )}
        {page === 'cotacoes' && <MinhasCotacoesPage onLoadQuote={handleLoadQuote} />}
        {page === 'admin' && <AdminPage />}
      </main>

      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ProductsProvider>
        <AppContent />
      </ProductsProvider>
    </AuthProvider>
  )
}
