// Miniatura da foto do produto a partir do rótulo/nome do item da cotação
// (quote_items não tem categoria — infere pelo rótulo, igual à proposta
// impressa). Sem foto conhecida, mostra um ícone neutro.
import { useState } from 'react'
import { getProductImage, guessCategoria } from '../data/productImages'

export default function ProductThumb({ label, produto, size = 40 }) {
  const [err, setErr] = useState(false)
  const nome = `${label || ''} ${produto || ''}`.trim()
  const src = getProductImage({ nome, categoria: guessCategoria(label) })
  return (
    <div
      className="rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {src && !err
        ? <img src={src} alt={nome} className="w-full h-full object-contain p-1" onError={() => setErr(true)} />
        : <span className="text-lg">📦</span>}
    </div>
  )
}
