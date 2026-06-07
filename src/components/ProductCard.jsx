import { useState } from 'react'
import { ChevronRight, Zap } from 'lucide-react'
import { getProductImage } from '../data/productImages'

const categoryColor = {
  'Módulos Fotovoltaicos':        'bg-amber-100 text-amber-800',
  'Inversores Monofásicos':       'bg-blue-100 text-blue-800',
  'Inversores Trifásicos':        'bg-indigo-100 text-indigo-800',
  'Microinversores':              'bg-purple-100 text-purple-800',
  'Inversores de Bombeamento':    'bg-cyan-100 text-cyan-800',
  'Baterias e Armazenamento':     'bg-green-100 text-green-800',
  'Estações de Recarga EV':       'bg-emerald-100 text-emerald-800',
  'WEG Smart Home':               'bg-pink-100 text-pink-800',
  'Cabos e Conectores':           'bg-gray-100 text-gray-700',
  'Estruturas Metálicas':         'bg-orange-100 text-orange-800',
  'Monitoramento':                'bg-teal-100 text-teal-800',
}

const categoryEmoji = {
  'Módulos Fotovoltaicos':        '☀️',
  'Inversores Monofásicos':       '⚡',
  'Inversores Trifásicos':        '⚡',
  'Microinversores':              '🔌',
  'Inversores de Bombeamento':    '💧',
  'Baterias e Armazenamento':     '🔋',
  'Estações de Recarga EV':       '🚗',
  'WEG Smart Home':               '🏠',
  'Cabos e Conectores':           '🔗',
  'Estruturas Metálicas':         '🏗️',
  'Monitoramento':                '📡',
  'Proteção e Acessórios':        '🛡️',
  'Otimizador':                   '⚙️',
  'Banco de Capacitores':         '🔆',
}

const categoryGradient = {
  'Módulos Fotovoltaicos':        'from-amber-50 to-amber-100',
  'Inversores Monofásicos':       'from-blue-50 to-blue-100',
  'Inversores Trifásicos':        'from-indigo-50 to-indigo-100',
  'Microinversores':              'from-purple-50 to-purple-100',
  'Inversores de Bombeamento':    'from-cyan-50 to-cyan-100',
  'Baterias e Armazenamento':     'from-green-50 to-green-100',
  'Estações de Recarga EV':       'from-emerald-50 to-emerald-100',
  'WEG Smart Home':               'from-pink-50 to-pink-100',
  'Cabos e Conectores':           'from-gray-50 to-gray-100',
  'Estruturas Metálicas':         'from-orange-50 to-orange-100',
  'Monitoramento':                'from-teal-50 to-teal-100',
}

function getCategoryBarColor(cat) {
  const bars = {
    'Módulos Fotovoltaicos':        'bg-amber-400',
    'Inversores Monofásicos':       'bg-blue-500',
    'Inversores Trifásicos':        'bg-indigo-500',
    'Microinversores':              'bg-purple-500',
    'Inversores de Bombeamento':    'bg-cyan-500',
    'Baterias e Armazenamento':     'bg-green-500',
    'Estações de Recarga EV':       'bg-emerald-500',
    'WEG Smart Home':               'bg-pink-500',
    'Cabos e Conectores':           'bg-gray-400',
    'Estruturas Metálicas':         'bg-orange-400',
    'Monitoramento':                'bg-teal-500',
  }
  return bars[cat] || 'bg-weg-blue'
}

function formatPrice(preco, unidadeVenda) {
  if (!preco) return 'Sob consulta'
  const formatted = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (unidadeVenda) return `${formatted}/${unidadeVenda}`
  return formatted
}

function getPowerLabel(product) {
  if (product.potencia && product.unidadePotencia) {
    return `${product.potencia} ${product.unidadePotencia}`
  }
  return null
}

function ProductImg({ src, alt, fallbackEmoji, gradient }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${gradient || 'from-gray-50 to-gray-100'}`}>
        <span className="text-5xl">{fallbackEmoji}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-110"
      onError={() => setError(true)}
    />
  )
}

export default function ProductCard({ product, onClick }) {
  const colorClass = categoryColor[product.categoria] || 'bg-gray-100 text-gray-700'
  const emoji = categoryEmoji[product.categoria] || '📦'
  const gradient = categoryGradient[product.categoria] || 'from-gray-50 to-gray-100'
  const powerLabel = getPowerLabel(product)
  const imgSrc = getProductImage(product)

  return (
    <article
      className="card group cursor-pointer flex flex-col overflow-hidden"
      onClick={() => onClick(product)}
    >
      {/* Image area */}
      <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${gradient}`}>
        <ProductImg src={imgSrc} alt={product.nome} fallbackEmoji={emoji} gradient={gradient} />

        {/* Category bar at top */}
        <div className={`absolute top-0 inset-x-0 h-1 ${getCategoryBarColor(product.categoria)}`} />

        {/* Category badge overlay */}
        <div className="absolute top-3 left-3">
          <span className={`badge ${colorClass} font-medium shadow-sm backdrop-blur-sm`}>
            {product.categoria}
          </span>
        </div>

        {/* FINAME badge */}
        {product.finame && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-blue-600 text-white text-[10px] shadow-sm">FINAME</span>
          </div>
        )}

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-4 pb-4 pt-3">
        {/* Product name */}
        <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-weg-blue transition-colors line-clamp-2">
          {product.nome}
        </h3>
        <p className="text-xs text-gray-400 font-mono mb-3">SAP: {product.codigo}</p>

        {/* Specs pills */}
        <div className="flex flex-wrap gap-1.5 mb-3 flex-1">
          {powerLabel && (
            <span className="inline-flex items-center gap-1 text-xs bg-weg-gray text-weg-blue px-2 py-1 rounded-md font-semibold">
              <Zap size={11} />
              {powerLabel}
            </span>
          )}
          {product.tensao && (
            <span className="inline-flex items-center gap-1 text-xs bg-weg-gray text-gray-600 px-2 py-1 rounded-md">
              {product.tensao} {product.fase || ''}
            </span>
          )}
          {product.fabricante && product.fabricante !== 'WEG' && (
            <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-md">
              {product.fabricante}
            </span>
          )}
          {product.tipo && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded-md">
              {product.tipo}
            </span>
          )}
        </div>

        {/* Footer: price + cta */}
        <div className="flex items-end justify-between border-t border-gray-100 pt-3 mt-auto">
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Preço unitário</p>
            <p className={`font-bold text-lg leading-none ${product.preco ? 'text-weg-blue' : 'text-gray-400 text-base'}`}>
              {formatPrice(product.preco, product.unidadeVenda)}
            </p>
          </div>
          <button className="flex items-center gap-1 text-sm font-semibold text-weg-orange hover:text-weg-orange-dark group-hover:translate-x-0.5 transition-transform shrink-0">
            Ver detalhes
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
