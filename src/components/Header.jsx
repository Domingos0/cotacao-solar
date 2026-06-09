import { useState } from 'react'
import { Search, Menu, X, Phone, Mail, Zap, LayoutGrid, Settings, LogOut, User, FileText } from 'lucide-react'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'

export default function Header({ onSearch, searchQuery, page, onPageChange }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { tableInfo } = useProducts()
  const { isAdmin, session, profile, signOut } = useAuth()

  const NAV_ITEMS = [
    { id: 'catalog',   label: 'Catálogo',         icon: LayoutGrid, show: true },
    { id: 'kit',       label: 'Monte seu Kit',     icon: Zap,        show: true },
    { id: 'cotacoes',  label: 'Minhas Cotações',   icon: FileText,   show: !!session && !isAdmin },
    { id: 'admin',     label: 'Admin',             icon: Settings,   show: isAdmin },
  ].filter(i => i.show)

  const navBtn = (item) => {
    const Icon = item.icon
    const active = page === item.id
    return (
      <button
        key={item.id}
        onClick={() => { onPageChange(item.id); setMenuOpen(false) }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? item.id === 'kit' ? 'bg-weg-orange text-white' : 'bg-white/20 text-white'
            : 'text-white/75 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon size={15} /> {item.label}
        {item.id === 'admin' && <span className="w-2 h-2 bg-green-400 rounded-full" />}
      </button>
    )
  }

  return (
    <header className="bg-weg-blue text-white shadow-lg sticky top-0 z-50">
      {/* Top info bar */}
      <div className="bg-weg-dark border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex justify-between items-center text-xs text-white/60">
          <span>{tableInfo?.nome || 'Lista de Preços'}</span>
          <div className="hidden sm:flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone size={11} /> 0800 727 0800</span>
            <span className="flex items-center gap-1"><Mail size={11} /> energia.solar@weg.net</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <button onClick={() => onPageChange('catalog')}
            className="flex items-center gap-3 shrink-0 hover:opacity-90 transition-opacity">
            <img src="/Logo_ErnaniFF_branco sem fundo.PNG" alt="Ernaniff Representações" className="h-24 object-contain" />
          </button>

          {/* Search (catalog only) */}
          {page === 'catalog' && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={15} />
                <input type="text" placeholder="Buscar por modelo, código SAP..."
                  value={searchQuery} onChange={e => onSearch(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-weg-orange focus:bg-white/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-auto">
            {NAV_ITEMS.map(navBtn)}

            {/* User + logout */}
            {profile && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/20">
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <User size={13} />
                  <span className="max-w-[100px] truncate">{profile.nome?.split(' ')[0]}</span>
                </div>
                <button onClick={signOut} title="Sair"
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-white/10 ml-auto"
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-white/20 space-y-1">
            {page === 'catalog' && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={15} />
                <input type="text" placeholder="Buscar..." value={searchQuery}
                  onChange={e => onSearch(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-weg-orange"
                />
              </div>
            )}
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              return (
                <button key={item.id}
                  onClick={() => { onPageChange(item.id); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    page === item.id ? 'bg-white/20 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}>
                  <Icon size={16} /> {item.label}
                </button>
              )
            })}
            {profile && (
              <button onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10">
                <LogOut size={16} /> Sair ({profile.nome?.split(' ')[0]})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active page accent bar */}
      {page === 'kit'      && <div className="h-0.5 bg-weg-orange" />}
      {page === 'admin'    && <div className="h-0.5 bg-yellow-400" />}
      {page === 'cotacoes' && <div className="h-0.5 bg-green-400" />}
    </header>
  )
}

function WEGLogo() {
  return (
    <svg width="80" height="32" viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="48" rx="4" fill="#003087" />
      <text x="60" y="34" textAnchor="middle" fontFamily="Inter, Arial" fontWeight="900" fontSize="28" fill="white" letterSpacing="2">WEG</text>
      <rect x="0" y="42" width="120" height="6" rx="0" fill="#E87722" />
    </svg>
  )
}
