import { CATEGORIES } from '../data/products'
import { X, SlidersHorizontal } from 'lucide-react'

const categoryOrder = [
  CATEGORIES.MODULOS,
  CATEGORIES.MICROINVERSORES,
  CATEGORIES.INVERSORES_MONO,
  CATEGORIES.INVERSORES_TRI,
  CATEGORIES.INVERSORES_BOMBEAMENTO,
  CATEGORIES.BATERIAS,
  CATEGORIES.ESTACOES_RECARGA,
  CATEGORIES.MONITORAMENTO,
  CATEGORIES.CABOS_CONECTORES,
  CATEGORIES.ESTRUTURAS,
  CATEGORIES.SMART_HOME,
]

const categoryEmoji = {
  [CATEGORIES.MODULOS]: '☀️',
  [CATEGORIES.MICROINVERSORES]: '🔌',
  [CATEGORIES.INVERSORES_MONO]: '⚡',
  [CATEGORIES.INVERSORES_TRI]: '⚡',
  [CATEGORIES.INVERSORES_BOMBEAMENTO]: '💧',
  [CATEGORIES.BATERIAS]: '🔋',
  [CATEGORIES.ESTACOES_RECARGA]: '🚗',
  [CATEGORIES.SMART_HOME]: '🏠',
  [CATEGORIES.CABOS_CONECTORES]: '🔗',
  [CATEGORIES.ESTRUTURAS]: '🏗️',
  [CATEGORIES.MONITORAMENTO]: '📡',
}

export default function FilterSidebar({ selectedCategory, onCategoryChange, counts, total }) {
  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-20">
        {/* Header */}
        <div className="bg-weg-blue px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <SlidersHorizontal size={16} />
            <span className="font-semibold text-sm">Filtrar por Categoria</span>
          </div>
          {selectedCategory && (
            <button
              onClick={() => onCategoryChange(null)}
              className="text-white/70 hover:text-white p-0.5 rounded"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* All categories */}
        <div className="p-2">
          <button
            onClick={() => onCategoryChange(null)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
              !selectedCategory
                ? 'bg-weg-blue text-white font-semibold'
                : 'text-gray-600 hover:bg-weg-gray hover:text-weg-blue'
            }`}
          >
            <span>Todos os Produtos</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              !selectedCategory ? 'bg-white/20 text-white' : 'bg-weg-gray text-weg-blue'
            }`}>
              {total}
            </span>
          </button>

          <div className="h-px bg-gray-100 my-2" />

          {categoryOrder.map(cat => {
            const count = counts[cat] || 0
            if (count === 0) return null
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-weg-orange text-white font-semibold'
                    : 'text-gray-600 hover:bg-weg-gray hover:text-weg-blue'
                }`}
              >
                <span className="flex items-center gap-2 text-left">
                  <span>{categoryEmoji[cat]}</span>
                  <span className="leading-tight">{cat}</span>
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-1 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-weg-gray text-weg-blue'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Price note */}
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Preços em R$ (reais). Não inclui impostos ou frete, salvo indicação.
          </p>
        </div>
      </div>
    </aside>
  )
}
