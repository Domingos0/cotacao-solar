import { X, Package, Tag, Zap, Phone, CheckCircle, Copy, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { getProductImage } from '../data/productImages'
import { getInverterSpecs } from '../data/inverterSpecs'

function formatPrice(preco, unidadeVenda) {
  if (!preco) return 'Sob consulta'
  const f = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return unidadeVenda ? `${f}/${unidadeVenda}` : f
}

function ProductImg({ src, alt, fallbackEmoji }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-7xl">{fallbackEmoji}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain p-4"
      onError={() => setError(true)}
    />
  )
}

export default function ProductDetail({ product, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!product) return null

  const copyCode = () => {
    navigator.clipboard.writeText(product.codigo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const imgSrc   = getProductImage(product)
  const invSpec  = getInverterSpecs(product)
  const emoji    = getCategoryEmoji(product.categoria)

  // Merge: specs from product data + enriched specs from portfolio
  const specsToShow = invSpec?.specs
    ?? (product.specs && Object.keys(product.specs).length > 0 ? product.specs : null)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Image banner */}
        <div className="relative h-52 bg-gradient-to-br from-weg-blue/10 to-weg-blue/5 rounded-t-2xl overflow-hidden">
          <ProductImg src={imgSrc} alt={product.nome} fallbackEmoji={emoji} />

          {/* Category bar */}
          <div className={`absolute top-0 inset-x-0 h-1 ${getCategoryBarColor(product.categoria)}`} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
          >
            <X size={18} className="text-gray-700" />
          </button>

          {/* FINAME badge */}
          {product.finame && (
            <div className="absolute top-3 left-3">
              <span className="badge bg-blue-600 text-white text-[10px] shadow-sm">FINAME</span>
            </div>
          )}

          {/* Portfolio badges */}
          {invSpec?.badges && (
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              {invSpec.badges.map(b => (
                <span key={b} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-weg-blue/90 text-white shadow-sm">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Header text */}
        <div className="bg-weg-blue text-white px-6 py-4">
          <div className="flex items-start gap-3 pr-2">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-widest mb-0.5">{product.categoria}</p>
              <h2 className="text-xl font-bold leading-snug">{product.nome}</h2>
              {invSpec?.subtitulo
                ? <p className="text-white/70 text-sm mt-0.5">{invSpec.subtitulo}</p>
                : product.tipo && <p className="text-white/70 text-sm mt-0.5">{product.tipo}</p>
              }
            </div>
          </div>

          {/* SAP code */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-white/60 text-xs">Código SAP:</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-sm font-mono font-semibold transition-colors"
            >
              {product.codigo}
              {copied
                ? <CheckCircle size={13} className="text-green-300" />
                : <Copy size={13} className="text-white/60" />
              }
            </button>
            <span className="text-white/40 text-xs">{copied ? 'Copiado!' : 'Clique para copiar'}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Price */}
          <div className="flex items-center justify-between bg-weg-gray rounded-xl px-5 py-4">
            <div>
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Preço Unitário (FOB Itajaí-SC)</p>
              <p className={`text-3xl font-extrabold ${product.preco ? 'text-weg-blue' : 'text-gray-400 text-xl'}`}>
                {formatPrice(product.preco, product.unidadeVenda)}
              </p>
            </div>
            <div className="text-right">
              <span className={`badge text-sm px-3 py-1 ${product.estoque === 'Disponível' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${product.estoque === 'Disponível' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {product.estoque}
              </span>
            </div>
          </div>

          {/* Specs — portfolio data or product.specs */}
          {specsToShow && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-weg-blue" />
                Especificações Técnicas
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(specsToShow).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">{key}</p>
                    <p className="text-sm font-semibold text-gray-800">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {product.descricao && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Package size={16} className="text-weg-blue" />
                Descrição
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{product.descricao}</p>
            </div>
          )}

          {/* Modelo */}
          {product.modelo && (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
              <Tag size={16} className="text-weg-blue shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Modelo / Part Number</p>
                <p className="font-mono font-semibold text-weg-blue text-sm">{product.modelo}</p>
              </div>
            </div>
          )}

          {/* WEG origin note */}
          {invSpec && (
            <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100 pt-3">
              <ShieldCheck size={14} className="text-weg-blue shrink-0" />
              Especificações baseadas no Portfólio Oficial WEG Solar 2024/2025
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <button className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
              <Phone size={16} />
              Solicitar Cotação
            </button>
            <button onClick={onClose} className="flex-1 btn-outline py-3">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getCategoryEmoji(cat) {
  const m = {
    'Módulos Fotovoltaicos':     '☀️',
    'Inversores Monofásicos':    '⚡',
    'Inversores Trifásicos':     '⚡',
    'Microinversores':           '🔌',
    'Inversores de Bombeamento': '💧',
    'Baterias e Armazenamento':  '🔋',
    'Estações de Recarga EV':    '🚗',
    'WEG Smart Home':            '🏠',
    'Cabos e Conectores':        '🔗',
    'Estruturas Metálicas':      '🏗️',
    'Monitoramento':             '📡',
    'Proteção e Acessórios':     '🛡️',
  }
  return m[cat] || '📦'
}

function getCategoryBarColor(cat) {
  const bars = {
    'Módulos Fotovoltaicos':     'bg-amber-400',
    'Inversores Monofásicos':    'bg-blue-500',
    'Inversores Trifásicos':     'bg-indigo-500',
    'Microinversores':           'bg-purple-500',
    'Inversores de Bombeamento': 'bg-cyan-500',
    'Baterias e Armazenamento':  'bg-green-500',
    'Estações de Recarga EV':    'bg-emerald-500',
    'WEG Smart Home':            'bg-pink-500',
    'Cabos e Conectores':        'bg-gray-400',
    'Estruturas Metálicas':      'bg-orange-400',
    'Monitoramento':             'bg-teal-500',
  }
  return bars[cat] || 'bg-weg-blue'
}
