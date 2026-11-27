import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { X } from 'lucide-react'

// Motor genérico de tour guiado: recebe uma lista de steps (cada um aponta
// pra um elemento via data-tour) e desenha um "spotlight" (buraco no
// overlay escuro) + balão de texto por cima da tela, navegando com
// Próximo/Voltar/Pular. Se o alvo de um step não estiver na tela (ex:
// usuário já saiu daquela área), o step é pulado sozinho, em vez de travar.
// onDisable (opcional): botão "Não mostrar mais" — desliga os tutoriais
// automáticos do usuário (quem chama grava a escolha).
export default function GuidedTour({ steps, onFinish, onDisable }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState(null)
  const tooltipRef = useRef(null)
  // Tamanho REAL do balão (não um chute) — sem isso, um body de texto mais
  // longo podia empurrar o balão (ou seus botões Próximo/Voltar) pra fora da
  // tela, porque o cálculo de posição usava uma altura fixa estimada.
  const [tooltipSize, setTooltipSize] = useState({ w: 320, h: 180 })

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

  // Remede o balão sempre que o conteúdo (título/texto) muda de tamanho,
  // pra reposicionar com a altura real em vez da estimativa.
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const r = tooltipRef.current.getBoundingClientRect()
      setTooltipSize({ w: r.width, h: r.height })
    }
  }, [stepIdx, rect])

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

  const margin = 12
  // Nunca deixa o balão mais largo que a tela (telas estreitas/mobile) —
  // sem isso, "innerWidth - tooltipW - margin" podia dar negativo e jogar
  // o balão pra fora da tela à esquerda, tornando Próximo/Voltar inalcançáveis.
  const tooltipW = Math.min(tooltipSize.w || 320, window.innerWidth - margin * 2)
  const tooltipH = tooltipSize.h || 180

  const rawTop = spot
    ? (spot.top + spot.height + margin + tooltipH > window.innerHeight
        ? spot.top - tooltipH - margin
        : spot.top + spot.height + margin)
    : window.innerHeight / 2 - tooltipH / 2
  const rawLeft = spot ? spot.left : window.innerWidth / 2 - tooltipW / 2

  // Clamp final nos dois eixos — garante que o balão (e seus botões) sempre
  // caibam inteiros na tela, não importa onde o alvo esteja.
  const tooltipTop = Math.min(Math.max(margin, rawTop), Math.max(margin, window.innerHeight - tooltipH - margin))
  const tooltipLeft = Math.min(Math.max(margin, rawLeft), Math.max(margin, window.innerWidth - tooltipW - margin))

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
        ref={tooltipRef}
        className="fixed bg-white rounded-2xl shadow-2xl p-4 transition-all duration-300"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipW, maxWidth: `calc(100vw - ${margin * 2}px)` }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-xs font-bold text-weg-blue uppercase tracking-wide">{step.title}</p>
          <button onClick={onFinish} className="text-gray-300 hover:text-gray-500 shrink-0" aria-label="Fechar tour">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400">{stepIdx + 1} / {steps.length}</span>
            {onDisable && (
              <button onClick={onDisable} className="text-[11px] text-gray-400 hover:text-gray-600 underline text-left">
                Não mostrar mais
              </button>
            )}
          </div>
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
