import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'

// Motor genérico de tour guiado: recebe uma lista de steps (cada um aponta
// pra um elemento via data-tour) e desenha um "spotlight" (buraco no
// overlay escuro) + balão de texto por cima da tela, navegando com
// Próximo/Voltar/Pular. Se o alvo de um step não estiver na tela (ex:
// usuário já saiu daquela área), o step é pulado sozinho, em vez de travar.
export default function GuidedTour({ steps, onFinish }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState(null)

  const step = steps[stepIdx]

  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.target)
    if (!el) {
      if (stepIdx < steps.length - 1) setStepIdx(i => i + 1)
      else onFinish()
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setRect(el.getBoundingClientRect())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  useEffect(() => {
    const t = setTimeout(measure, 200) // espera o scroll/render assentar
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [measure])

  useEffect(() => {
    // Trava o scroll do body enquanto o tour está ativo, igual a um modal
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!steps.length || !step) return null
  const isLast = stepIdx === steps.length - 1

  const pad = 8
  const spot = rect ? {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  } : null

  const tooltipW = 320
  const tooltipMaxH = 180
  const tooltipTop = spot
    ? (spot.top + spot.height + 12 + tooltipMaxH > window.innerHeight
        ? Math.max(12, spot.top - tooltipMaxH - 12)
        : spot.top + spot.height + 12)
    : window.innerHeight / 2 - 90
  const tooltipLeft = spot
    ? Math.min(Math.max(12, spot.left), window.innerWidth - tooltipW - 12)
    : window.innerWidth / 2 - tooltipW / 2

  return (
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-label="Tour guiado" aria-live="polite">
      {/* Overlay escuro com "buraco" no alvo via box-shadow gigante */}
      {spot ? (
        <div
          className="fixed rounded-xl transition-all duration-300 pointer-events-none"
          style={{
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.65)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/65" />
      )}

      {/* Balão de texto */}
      <div
        className="fixed bg-white rounded-2xl shadow-2xl p-4 transition-all duration-300"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipW }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-xs font-bold text-weg-blue uppercase tracking-wide">{step.title}</p>
          <button onClick={onFinish} className="text-gray-300 hover:text-gray-500 shrink-0" aria-label="Fechar tour">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{stepIdx + 1} / {steps.length}</span>
          <div className="flex gap-2">
            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx(i => i - 1)}
                className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                Voltar
              </button>
            )}
            <button
              onClick={() => isLast ? onFinish() : setStepIdx(i => i + 1)}
              className="text-xs font-semibold text-white bg-weg-blue px-3 py-1.5 rounded-lg hover:bg-weg-blue/90"
            >
              {isLast ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
