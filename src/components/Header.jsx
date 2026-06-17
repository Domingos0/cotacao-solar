import { useState, useRef, useEffect } from 'react'
import { Search, Menu, X, Phone, Mail, Zap, LayoutGrid, Settings, LogOut, User, FileText, Hash, Check, Pencil } from 'lucide-react'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'

export default function Header({ onSearch, searchQuery, page, onPageChange }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [editingNum, setEditingNum] = useState(false)
  const [numValue, setNumValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const popoverRef = useRef(null)
  const { tableInfo } = useProducts()
  const { isAdmin, session, profile, signOut, updateProfile } = useAuth()

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!showUserMenu) return
    const handle = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showUserMenu])

  const openUserMenu = () => {
    setNumValue(profile?.numero_usuario || '')
    setEditingNum(false)
    setShowUserMenu(v => !v)
  }

  const saveNumero = async () => {
    setSaving(true)
    setSaveError(null)
    const { error } = await updateProfile({ numero_usuario: numValue.trim() || null })
    setSaving(false)
    if (error) {
      setSaveError('Erro ao salvar. Verifique o banco de dados.')
    } else {
      setEditingNum(false)
    }
  }

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
            <span className="flex items-center gap-1"><Phone size={11} /> 94 9209-0380</span>
            <span className="flex items-center gap-1"><Mail size={11} /> vendas@ernaniff.com.br</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <button onClick={() => onPageChange('catalog')}
            className="flex items-center gap-3 shrink-0 hover:opacity-90 transition-opacity">
            <img src="/logo-ernaniff-branco.png" alt="Ernaniff Representações" className="w-32 sm:w-40 md:w-52 h-auto max-h-10 object-contain" />
          </button>

          {/* Search (catalog only) */}
          {page === 'catalog' && (
            <div className="flex-1 max-w-[160px] sm:max-w-xs md:max-w-md">
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
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/20 relative" ref={popoverRef}>
                <button
                  onClick={openUserMenu}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <User size={13} />
                  {profile.numero_usuario && (
                    <span className="bg-white/20 text-white font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">
                      #{profile.numero_usuario}
                    </span>
                  )}
                  <span className="max-w-[100px] truncate">{profile.nome?.split(' ')[0]}</span>
                </button>
                <button onClick={signOut} title="Sair"
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <LogOut size={14} />
                </button>

                {/* User popover */}
                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-3 z-50 text-gray-800">
                    <div className="px-4 pb-2 border-b border-gray-100">
                      <p className="font-bold text-sm text-gray-900 truncate">{profile.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
                    </div>
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                        <Hash size={11} /> Número de Usuário
                      </p>
                      {editingNum ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={numValue}
                              onChange={e => { setNumValue(e.target.value); setSaveError(null) }}
                              onKeyDown={e => { if (e.key === 'Enter') saveNumero(); if (e.key === 'Escape') { setEditingNum(false); setSaveError(null) } }}
                              placeholder="Ex: 001, V-12, REP-03…"
                              className={`flex-1 border rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 ${saveError ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-weg-blue'}`}
                            />
                            <button
                              onClick={saveNumero}
                              disabled={saving}
                              className="p-1.5 bg-weg-blue text-white rounded-lg hover:bg-weg-blue/90 disabled:opacity-50"
                            >
                              {saving
                                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Check size={14} />}
                            </button>
                          </div>
                          {saveError && (
                            <p className="text-[11px] text-red-500 leading-tight">{saveError}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setNumValue(profile?.numero_usuario || ''); setEditingNum(true) }}
                          className="w-full flex items-center justify-between text-sm bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                        >
                          <span className={profile?.numero_usuario ? 'font-mono font-bold text-weg-blue' : 'text-gray-400 text-xs'}>
                            {profile?.numero_usuario ? `#${profile.numero_usuario}` : 'Clique para definir…'}
                          </span>
                          <Pencil size={12} className="text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
