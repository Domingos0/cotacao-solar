import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { submitFeedback, markRatingPromptShown } from '../lib/feedback'

// Prompt de avaliação 1-5 após salvar uma cotação (item 28) — exibido no
// máximo uma vez por mês por usuário (gate em canShowRatingPrompt, checado
// por quem renderiza este componente antes de montá-lo).
export default function RatingPrompt({ userId, page, onClose }) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const close = () => { markRatingPromptShown(userId); onClose() }

  const send = async (value) => {
    if (sending) return
    setNota(value)
    setSending(true)
    await submitFeedback({ userId, tipo: 'avaliacao', nota: value, pagina: page })
    setSending(false)
    setDone(true)
    markRatingPromptShown(userId)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9997] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative">
        <button onClick={close} className="absolute top-3 right-3 text-gray-300 hover:text-gray-500" aria-label="Fechar">
          <X size={18} />
        </button>
        {done ? (
          <p className="text-lg font-bold text-gray-900 py-4">Obrigado pela avaliação! 🙌</p>
        ) : (
          <>
            <p className="font-bold text-gray-900 mb-1">Cotação salva!</p>
            <p className="text-sm text-gray-500 mb-4">De 1 a 5, como foi sua experiência montando essa cotação?</p>
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  disabled={sending}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => send(n)}
                  className="p-1 disabled:opacity-60"
                  aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                >
                  <Star size={28} className={(hover || nota) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
