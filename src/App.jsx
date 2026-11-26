import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { ProductsProvider, useProducts } from './context/ProductsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import GuidedTour from './components/GuidedTour'
import FeedbackButton from './components/FeedbackButton'
import OnboardingChecklist from './components/OnboardingChecklist'
import { TOURS, isTourSeen, markTourSeen } from './lib/tour'
import Footer from './components/Footer'
import HeroBanner from './components/HeroBanner'
import FilterSidebar from './components/FilterSidebar'
import ProductCard from './components/ProductCard'
import ProductDetail from './components/ProductDetail'
import AdminPage from './pages/AdminPage'
import KitBuilder from './pages/KitBuilder'
import BatteryDimensioningPage from './pages/BatteryDimensioningPage'
import SolarSimulationPage from './pages/SolarSimulationPage'
import MinhasCotacoesPage from './pages/MinhasCotacoesPage'
import PromoKitsPage from './pages/PromoKitsPage'
import LoginPage from './pages/LoginPage'
import { normalizeSearch, normalizeSearchCompact } from './lib/text'
import CadastroPage from './pages/CadastroPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import { CATEGORIES } from './data/products'
import { pathForPage, pageFromPath } from './lib/routing'
import { Search, Clock } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'default', label: 'Padrão' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome A-Z' },
  { value: 'power-desc', label: 'Maior potência' },
]

function CatalogPage({ searchQuery, setSearchQuery }) {
  const { catalogProducts: products } = useProducts()
  const { session, isAdmin } = useAuth()
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
      const q = normalizeSearch(searchQuery)
      const qCompact = normalizeSearchCompact(searchQuery)
      list = list.filter(p =>
        normalizeSearch(p.nome).includes(q) ||
        normalizeSearch(p.codigo).includes(q) ||
        normalizeSearch(p.modelo).includes(q) ||
        normalizeSearch(p.categoria).includes(q) ||
        normalizeSearch(p.tipo).includes(q) ||
        normalizeSearch(p.descricao).includes(q) ||
        // Comparação sem espaços, pra achar código de modelo mesmo com
        // espaço extra de qualquer lado (ex: "siw 300h" → "SIW300H").
        normalizeSearchCompact(p.nome).includes(qCompact) ||
        normalizeSearchCompact(p.codigo).includes(qCompact) ||
        normalizeSearchCompact(p.modelo).includes(qCompact)
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
            {!isAdmin && <OnboardingChecklist userId={session?.user?.id} />}
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
  const { session, loading, isAdmin, isAtivo, signOut, refreshProfile, passwordRecovery } = useAuth()
  const [authPage, setAuthPage] = useState('login')

  if (loading) return <LoadingScreen />

  // Veio do link de "esqueci a senha" — pede a nova senha antes de qualquer coisa,
  // mesmo já existindo uma sessão temporária de recovery
  if (passwordRecovery) return <ResetPasswordPage />

  if (!session) {
    if (authPage === 'register') return <CadastroPage onGoToLogin={() => setAuthPage('login')} />
    return <LoginPage onGoToRegister={() => setAuthPage('register')} />
  }

  if (!isAdmin && !isAtivo) return <PendingScreen onLogout={signOut} onRefresh={refreshProfile} />

  // key=session.user.id: força remount completo de toda a UI quando o usuário muda
  // garante estado 100% limpo — sem dados do usuário anterior
  return <AuthenticatedApp key={session.user.id} />
}

function AuthenticatedApp() {
  const { session, isAdmin, signOut } = useAuth()
  // Item 44: cada tela (e cada cotação) tem o próprio endereço — o estado
  // inicial já vem da URL atual (refresh/link direto preserva onde o
  // usuário estava), não sempre do catálogo.
  const initialRoute = useRef(pageFromPath(window.location.pathname)).current
  const [page, setPage] = useState(initialRoute.page)
  const [openQuoteId, setOpenQuoteId] = useState(initialRoute.quoteId)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadedQuote, setLoadedQuote] = useState(null)
  const [estudoInicial, setEstudoInicial] = useState(null)
  const [activeTour, setActiveTour] = useState(null)
  // O tour do Monte seu Kit não é um array fixo em TOURS — cada etapa da
  // wizard tem o seu próprio (ver src/lib/tour.js, KIT_STEP_TOURS), e quem
  // sabe qual é a etapa atual é o próprio KitBuilder. Esse contador só avisa
  // "o usuário pediu pra rever o tour agora", e o KitBuilder decide qual.
  const [kitTourTrigger, setKitTourTrigger] = useState(0)

  const startTour = (tourId) => {
    if (tourId === 'kit') { setKitTourTrigger(n => n + 1); return }
    if (TOURS[tourId]) setActiveTour(tourId)
  }
  const finishTour = () => {
    if (activeTour) markTourSeen(session?.user?.id, activeTour)
    setActiveTour(null)
  }

  // Tour guiado automático no primeiro login (item 26) — um pra cliente
  // (Catálogo) e um pra admin (Painel), cada um marcado como visto só
  // depois de concluído ou fechado, pra não reaparecer sozinho depois.
  useEffect(() => {
    const firstTourId = isAdmin ? 'admin' : 'catalog'
    if (!isTourSeen(session?.user?.id, firstTourId)) {
      const t = setTimeout(() => setActiveTour(firstTourId), 600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Duas cotações carregadas sem savedId (duplicar, ou "usar no kit" vindo do
  // Dimensionar Bateria) teriam a mesma key 'new' no KitBuilder abaixo e ele
  // não remontaria — ficaria com os dados da primeira carregada. loadId força
  // o remount mesmo quando não há savedId pra diferenciar.
  const loadCounterRef = useRef(0)
  const handleLoadQuote = ({ quoteData, savedId }) => {
    if (!savedId) loadCounterRef.current += 1
    setLoadedQuote({ quoteData, savedId, loadId: savedId ? null : loadCounterRef.current })
    setPage('kit')
    setOpenQuoteId(null)
    history.pushState(null, '', pathForPage('kit'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // "Solicitar este kit" na aba Kits da Promoção (item 36) — joga o cliente
  // direto pro Monte seu Kit já com módulo/inversor da promoção escolhidos e
  // a preferência de telhado marcada, pulando Tipo de Kit/Dimensionamento/
  // Módulos/Inversor (já decididos pela própria promoção). origemPromo avisa
  // o KitBuilder pra abrir direto na etapa de Acessórios.
  const CAT_TO_KIT_TYPE = {
    [CATEGORIES.INVERSORES_MONO]:        'ongrid_mono',
    [CATEGORIES.INVERSORES_TRI]:         'ongrid_tri',
    [CATEGORIES.MICROINVERSORES]:        'micro',
    [CATEGORIES.INVERSORES_BOMBEAMENTO]: 'bombeamento',
  }
  const handleRequestPromo = (promoKit, uf, roofType) => {
    const quoteData = {
      kitType: CAT_TO_KIT_TYPE[promoKit.inversor?.categoria] || 'ongrid_mono',
      panel: promoKit.modulo,
      panelQty: promoKit.modulo?.qty || 1,
      inverter: promoKit.inversor,
      inverterQty: promoKit.inversor?.qty || 1,
      clienteUF: uf || undefined,
      wantsEstrutura: !!roofType,
      estruturaRoofType: roofType || null,
      origemPromo: true,
      promoKitId: promoKit.id,
    }
    handleLoadQuote({ quoteData, savedId: undefined })
  }

  const handlePageChange = (p) => {
    if (p === 'kit') setLoadedQuote(null) // novo kit sempre começa do zero via nav
    setPage(p)
    setOpenQuoteId(null)
    history.pushState(null, '', pathForPage(p))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Item 44: um link direto (ou aba antiga) pra uma tela só de admin, aberto
  // por quem não é admin, cai no catálogo em vez de ficar com o <main>
  // em branco (as telas admin-only já só renderizam com isAdmin, mas antes
  // disso o `page` inicial vinha sempre de 'catalog', nunca de um link).
  const ADMIN_ONLY_PAGES = ['admin', 'dimensionamento', 'simulacao-solar']
  useEffect(() => {
    if (ADMIN_ONLY_PAGES.includes(page) && !isAdmin) {
      setPage('catalog')
      history.replaceState(null, '', pathForPage('catalog'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isAdmin])

  // Item 44: Voltar/Avançar do navegador — a URL já é a fonte da verdade
  // (handlePageChange e syncQuoteUrl escrevem nela), então só precisa reler
  // e aplicar no estado, sem empurrar uma entrada nova no histórico.
  useEffect(() => {
    const onPopState = () => {
      const { page: p, quoteId } = pageFromPath(window.location.pathname)
      setPage(p)
      setOpenQuoteId(quoteId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Mantém a URL em dia quando o usuário abre/fecha uma cotação específica
  // em Minhas Cotações, pra ela virar um link compartilhável (item 44) sem
  // precisar tocar em cada botão que já abre uma cotação naquela tela.
  const syncQuoteUrl = (quoteId) => {
    setOpenQuoteId(quoteId)
    const path = pathForPage('cotacoes', quoteId)
    if (window.location.pathname !== path) history.pushState(null, '', path)
  }

  // Voltar do Monte seu Kit pra página de Estudo, restaurando o que foi
  // calculado lá (cargas, família, consumo etc.) pra continuar editando.
  const handleBackToEstudo = (estudoRaw) => {
    setEstudoInicial(estudoRaw || null)
    setPage('dimensionamento')
    history.pushState(null, '', pathForPage('dimensionamento'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-weg-gray">
      <Header
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        page={page}
        onPageChange={handlePageChange}
        onStartTour={startTour}
      />

      <main className="flex-1">
        {page === 'catalog' && <CatalogPage searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {page === 'kit' && (
          <KitBuilder
            key={loadedQuote?.savedId || (loadedQuote?.loadId ? `new-${loadedQuote.loadId}` : 'new')}
            initialData={loadedQuote?.quoteData}
            initialSavedId={loadedQuote?.savedId}
            onGoToQuotes={() => handlePageChange('cotacoes')}
            onBackToEstudo={handleBackToEstudo}
            tourTrigger={kitTourTrigger}
          />
        )}
        {page === 'cotacoes' && (
          <MinhasCotacoesPage
            onLoadQuote={handleLoadQuote}
            initialQuoteId={openQuoteId}
            onQuoteUrlChange={syncQuoteUrl}
          />
        )}
        {page === 'promocoes' && <PromoKitsPage onRequestPromo={handleRequestPromo} />}
        {page === 'dimensionamento' && isAdmin && (
          <BatteryDimensioningPage
            initialState={estudoInicial}
            onUseInKit={(quoteData) => handleLoadQuote({ quoteData, savedId: undefined })}
          />
        )}
        {page === 'simulacao-solar' && isAdmin && <SolarSimulationPage />}
        {page === 'admin' && isAdmin && <AdminPage onLoadQuote={handleLoadQuote} />}
      </main>

      <Footer />

      <FeedbackButton page={page} />

      {activeTour && TOURS[activeTour] && (
        <GuidedTour steps={TOURS[activeTour]} onFinish={finishTour} />
      )}
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
