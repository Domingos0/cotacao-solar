// Gera o PDF da proposta a partir das páginas renderizadas (.proposta-pagina)
// e compartilha. O link wa.me só aceita texto — não dá pra anexar arquivo por
// URL. Então: no celular usa o menu nativo de compartilhar (Web Share API com
// arquivo), que manda o PDF direto pro WhatsApp; no computador baixa o PDF e
// abre a conversa com a mensagem pronta pra anexar.
import { waitImages } from './print'

const A4_W = 210
const A4_H = 297

export async function renderProposalPdf(root, { fileName = 'Proposta.pdf' } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  await waitImages(root)
  if (document.fonts?.ready) await document.fonts.ready

  const pages = Array.from(root.querySelectorAll('.proposta-pagina'))
  let pdf = null
  const previews = []
  for (const page of pages) {
    const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
    const img = canvas.toDataURL('image/jpeg', 0.88)
    previews.push(img)
    // Página nunca menor que A4; se o conteúdo passar (muitos itens), a página
    // do PDF fica mais comprida em vez de cortar o conteúdo.
    const h = Math.max(A4_H, (canvas.height * A4_W) / canvas.width)
    if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [A4_W, h], orientation: 'portrait', compress: true })
    else pdf.addPage([A4_W, h], 'portrait')
    pdf.addImage(img, 'JPEG', 0, 0, A4_W, (canvas.height * A4_W) / canvas.width)
  }
  if (!pdf) throw new Error('Nenhuma página de proposta encontrada')
  const blob = pdf.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })
  return { blob, file, previews }
}

export function canShareFile(file) {
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
  } catch {
    return false
  }
}

export function downloadFile(blobOrFile, fileName) {
  const url = URL.createObjectURL(blobOrFile)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
