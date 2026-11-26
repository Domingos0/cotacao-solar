import { useState } from 'react'
import { MessageSquarePlus, X, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { submitFeedback } from '../lib/feedback'

// Botão flutuante de feedback (item 28), fixo em todas as telas — abre um
// modal pra sugerir melhoria ou reportar problema, com a tela atual
// (`page`) e um print opcional (via html2canvas, best-effort: se falhar,
// o feedback ainda é enviado sem o print).
export default function FeedbackButton({ page }) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [screenshot, setScreenshot] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  if (!session) return null

  const openModal = () => {
    setOpen(true)
    setSent(false)
    setError(null)
    setMensagem('')
    setScreenshot(null)
    setTipo('sugestao')
  }

  const captureScreenshot = async () => {
    setCapturing(true)
    // Fecha o próprio modal um instante antes de capturar, senão ele aparece no print
    setOpen(false)
    await new Promise(r => setTimeout(r, 50))
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, { logging: false, useCORS: true, scale: 0.6 })
      setScreenshot(canvas.toDataURL('image/jpeg', 0.5))
    } catch (e) {
      console.warn('[feedback] captura de print falhou:', e?.message)
    }
    setOpen(true)
    setCapturing(false)
  }

  const send = async () => {
    if (!mensagem.trim()) return
    setSending(true)
    setError(null)
    const { error } = await submitFeedback({
      userId: session.user.id,
      tipo,
      mensagem: mensagem.trim(),
      pagina: page,
      screenshot,
    })
    setSending(false)
    if (error) {
      console.error('[FeedbackButton]', error)
      setError('Erro ao enviar. Tente de novo.')
      return
    }
    setSent(true)
  }

  return (
    <>
      <button
        onClick={openModal}
        title="Sugerir melhoria / Reportar problema"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-weg-blue text-white px-4 py-3 rounded-full shadow-lg hover:bg-weg-blue/90 transition-colors print:hidden"
      >
        <MessageSquarePlus size={18} />
        <span className="hidden sm:inline text-sm font-semibold">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[9997] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            {sent ? (
              <div className="text-center py-6">
                <p className="text-lg font-bold text-gray-900 mb-1">Valeu pelo feedback!</p>
                <p className="text-sm text-gray-500 mb-4">
                  Vamos analisar e, se for um problema, te avisamos por aqui quando resolver.
                </p>
                <button onClick={() => setOpen(false)} className="btn-primary px-6 py-2">Fechar</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-gray-900">Feedback</p>
                  <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setTipo('sugestao')}
                    className={`flex-1 text-sm font-semibold py-2 rounded-lg border-2 transition-colors ${
                      tipo === 'sugestao' ? 'border-weg-blue bg-blue-50 text-weg-blue' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    💡 Sugerir melhoria
                  </button>
                  <button
                    onClick={() => setTipo('problema')}
                    className={`flex-1 text-sm font-semibold py-2 rounded-lg border-2 transition-colors ${
                      tipo === 'problema' ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    ⚠ Reportar problema
                  </button>
                </div>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  rows={4}
                  placeholder="Conte o que aconteceu ou o que poderia melhorar..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue mb-3"
                />
                <button
                  onClick={captureScreenshot}
                  disabled={capturing}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 border border-dashed border-gray-300 rounded-xl py-2 mb-3 hover:border-weg-blue hover:text-weg-blue disabled:opacity-60"
                >
                  <Camera size={14} />
                  {capturing ? 'Capturando…' : screenshot ? 'Print anexado ✓ (clique pra refazer)' : 'Anexar print da tela atual'}
                </button>
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <button
                  onClick={send}
                  disabled={sending || !mensagem.trim()}
                  className="w-full btn-primary py-2.5 disabled:opacity-60"
                >
                  {sending ? 'Enviando…' : 'Enviar feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
