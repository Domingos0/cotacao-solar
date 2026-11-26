import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { GLOSSARY } from '../lib/glossary'

// Dica (i) nos termos técnicos (item 27) — ícone pequeno que mostra uma
// explicação curta ao passar o mouse (desktop) ou tocar (mobile). `term`
// busca o texto em src/lib/glossary.js; `text` deixa passar um texto
// pontual quando não há (ou não vale a pena ter) uma entrada no glossário.
export default function InfoTip({ term, text, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const body = text || GLOSSARY[term]

  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!body) return null

  return (
    <span className={`relative inline-flex align-middle ${className}`} ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-gray-400 hover:text-weg-blue transition-colors"
        aria-label="Mais informações"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-snug font-normal normal-case"
        >
          {body}
        </span>
      )}
    </span>
  )
}
