// Saída da proposta (layout PrintedProposal) em dois modos:
//  - mode="print": monta a proposta e abre o diálogo de impressão (Salvar como PDF).
//  - mode="share": gera o PDF, mostra a prévia das páginas e compartilha no
//    WhatsApp — celular: menu nativo com o PDF anexado; computador: baixa o
//    PDF e abre a conversa com a mensagem pronta.
// Usado por Monte seu Kit, Minhas Cotações (cotação, revisões, unificada) e Admin.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, Loader2, Share2 } from 'lucide-react'
import PrintedProposal from './PrintedProposal'
import { execPrint, waitImages } from '../lib/print'
import { renderProposalPdf, canShareFile, downloadFile } from '../lib/sharePdf'
import { proposalFileName } from '../lib/proposal'
import { buildWaLink, buildShareMessage } from '../lib/whatsapp'

function WhatsIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36A9.42 9.42 0 0 1 2.6 12.06c0-5.2 4.24-9.44 9.46-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44zm8.05-17.5A11.3 11.3 0 0 0 12.05.7C5.78.7.67 5.8.67 12.07c0 2 .52 3.96 1.52 5.68L.57 23.3l5.69-1.49a11.35 11.35 0 0 0 5.78 1.57h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.33-8.04z" />
    </svg>
  )
}

// nome/link: saudação e link da cotação no portal que vão na mensagem junto
// com o PDF (link só quando quem recebe é o dono da cotação).
export default function ProposalOutput({ proposal, mode = 'print', phone = '', nome = '', link = '', onClose }) {
  const message = buildShareMessage(proposal, { nome, link })
  const rootRef = useRef(null)
  const [state, setState] = useState(mode === 'share' ? 'gerando' : 'pronto') // gerando | pronto | erro
  const [pdf, setPdf] = useState(null) // { file, previews }
  const [erro, setErro] = useState('')
  const fileName = proposalFileName(proposal)

  // Impressão: espera logo/miniaturas carregarem e abre o diálogo.
  useEffect(() => {
    if (mode !== 'print') return
    let cancel = false
    waitImages(rootRef.current).then(() => {
      if (!cancel && rootRef.current) execPrint(() => onClose?.(), rootRef.current)
    })
    return () => { cancel = true }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compartilhar: gera o PDF uma vez ao abrir.
  useEffect(() => {
    if (mode !== 'share') return
    let cancel = false
    renderProposalPdf(rootRef.current, { fileName })
      .then(r => { if (!cancel) { setPdf(r); setState('pronto') } })
      .catch(e => { if (!cancel) { setErro(e?.message || 'Falha ao gerar o PDF'); setState('erro') } })
    return () => { cancel = true }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const podeCompartilharArquivo = pdf ? canShareFile(pdf.file) : false

  // Precisa rodar direto no clique (gesto do usuário) — por isso o PDF já
  // está pronto antes do botão aparecer.
  async function compartilhar() {
    try {
      await navigator.share({ files: [pdf.file], text: message, title: fileName.replace(/\.pdf$/, '') })
    } catch (e) {
      if (e?.name !== 'AbortError') baixarEAbrirWhats()
    }
  }

  function baixarEAbrirWhats() {
    downloadFile(pdf.file, fileName)
    window.open(buildWaLink(phone, message), '_blank', 'noopener')
  }

  if (mode === 'print') {
    return createPortal(
      <div ref={rootRef} className="proposta-print fixed inset-0 z-[9999] overflow-auto bg-slate-200 py-6">
        <div className="space-y-6 flex flex-col items-center print:block print:space-y-0">
          <PrintedProposal proposal={proposal} />
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <>
      {/* Render em tamanho real fora da tela — é daqui que sai o PDF */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 794, pointerEvents: 'none' }}>
        <div ref={rootRef}><PrintedProposal proposal={proposal} /></div>
      </div>

      <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 flex items-center gap-2"><WhatsIcon className="w-5 h-5 text-[#25D366]" /> Enviar proposta</p>
              <p className="text-xs text-slate-500 truncate">{fileName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
            {state === 'gerando' && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#16307A]" />
                <p className="text-sm">Gerando o PDF da proposta…</p>
              </div>
            )}
            {state === 'erro' && (
              <div className="text-center py-12 text-sm text-red-600">
                Não foi possível gerar o PDF ({erro}). Tente de novo ou use "Imprimir / PDF".
              </div>
            )}
            {state === 'pronto' && pdf && (
              <div className="space-y-3">
                {pdf.previews.map((src, i) => (
                  <img key={i} src={src} alt={`Página ${i + 1} da proposta`} className="w-full rounded-lg shadow border border-slate-200 bg-white" />
                ))}
              </div>
            )}
          </div>

          {state === 'pronto' && pdf && (
            <div className="p-4 border-t border-slate-200 space-y-2">
              {podeCompartilharArquivo ? (
                <button onClick={compartilhar} className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold py-3 rounded-xl">
                  <Share2 className="w-4 h-4" /> Compartilhar PDF no WhatsApp
                </button>
              ) : (
                <button onClick={baixarEAbrirWhats} className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold py-3 rounded-xl">
                  <WhatsIcon /> Baixar PDF e abrir WhatsApp
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => downloadFile(pdf.file, fileName)} className="flex-1 flex items-center justify-center gap-2 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 text-sm">
                  <Download className="w-4 h-4" /> Só baixar o PDF
                </button>
                {podeCompartilharArquivo && (
                  <button onClick={() => window.open(buildWaLink(phone, message), '_blank', 'noopener')} className="flex-1 flex items-center justify-center gap-2 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 text-sm">
                    <WhatsIcon /> Só a mensagem
                  </button>
                )}
              </div>
              {!podeCompartilharArquivo && (
                <p className="text-[11px] text-slate-500 text-center">No computador o WhatsApp não aceita anexo por link: o PDF é baixado e a conversa abre com a mensagem — é só arrastar o arquivo pra conversa.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
