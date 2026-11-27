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
    // Links (data-pdf-link): posição em px dentro da página → vira área
    // clicável no PDF (a página em si é imagem, link de texto não funcionaria)
    const pageRect = page.getBoundingClientRect()
    const links = Array.from(page.querySelectorAll('[data-pdf-link]')).map(el => {
      const r = el.getBoundingClientRect()
      return { url: el.getAttribute('data-pdf-link'), x: r.left - pageRect.left, y: r.top - pageRect.top, w: r.width, h: r.height }
    })
    const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
    const img = canvas.toDataURL('image/jpeg', 0.88)
    previews.push(img)
    // Página nunca menor que A4; se o conteúdo passar (muitos itens), a página
    // do PDF fica mais comprida em vez de cortar o conteúdo.
    const h = Math.max(A4_H, (canvas.height * A4_W) / canvas.width)
    if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [A4_W, h], orientation: 'portrait', compress: true })
    else pdf.addPage([A4_W, h], 'portrait')
    pdf.addImage(img, 'JPEG', 0, 0, A4_W, (canvas.height * A4_W) / canvas.width)
    const mmPorPx = A4_W / pageRect.width
    links.forEach(l => pdf.link(l.x * mmPorPx, l.y * mmPorPx, l.w * mmPorPx, l.h * mmPorPx, { url: l.url }))
  }
  if (!pdf) throw new Error('Nenhuma página de proposta encontrada')
  const blob = pdf.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })
  return { blob, file, previews }
}

// Baixa os PDFs de datasheet pra mandar junto no compartilhamento.
// Falha de um arquivo não impede os outros (nem a proposta).
export async function fetchDatasheetFiles(datasheets) {
  const unicos = (datasheets || []).filter(d => !d.repetido)
  const files = await Promise.all(unicos.map(async d => {
    try {
      const r = await fetch(d.url)
      if (!r.ok) return null
      const blob = await r.blob()
      const nome = `Datasheet ${d.nome}`.replace(/[\/:*?"<>|]/g, '-') + '.pdf'
      return new File([blob], nome, { type: 'application/pdf' })
    } catch {
      return null
    }
  }))
  return files.filter(Boolean)
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
