// Impressão mobile-safe: move o elemento a imprimir pra filho direto do body,
// desfaz estilos inline que quebram no mobile (fixed + overflow:auto = só o
// viewport sai no papel), marca body.is-printing e chama window.print().
// O CSS de impressão (index.css) só mostra o #kit-print — se o elemento
// recebido não tiver esse id, ele ganha o id temporariamente (e quem tinha
// o id perde, até o fim da impressão).
export function execPrint(cleanup, target = null) {
  const el = target || document.getElementById('kit-print')
  if (!el) { window.print(); return }
  const parent = el.parentNode
  const next = el.nextSibling
  const savedStyle = el.style.cssText
  const savedId = el.id
  const holder = savedId === 'kit-print' ? null : document.getElementById('kit-print')
  if (holder) holder.id = ''
  el.id = 'kit-print'

  el.style.cssText = [
    'position:static', 'inset:auto',
    'top:auto', 'left:auto', 'right:auto', 'bottom:auto',
    'width:100%', 'max-width:none', 'height:auto', 'max-height:none',
    'overflow:visible', 'border-radius:0', 'box-shadow:none',
    'z-index:auto', 'transform:none', 'background:white',
  ].join(';')

  document.body.appendChild(el)
  document.body.classList.add('is-printing')
  let done = false
  const restore = () => {
    if (done) return
    done = true
    document.body.classList.remove('is-printing')
    el.style.cssText = savedStyle
    el.id = savedId
    if (holder) holder.id = 'kit-print'
    if (el.parentNode === document.body && parent) parent.insertBefore(el, next)
    cleanup?.()
  }
  window.addEventListener('afterprint', restore, { once: true })
  // Mobile Safari não dispara afterprint de forma confiável
  setTimeout(restore, 30000)
  setTimeout(() => window.print(), 80)
}

// Espera as imagens de dentro do elemento carregarem (ou falharem) — senão a
// impressão/PDF sai com as miniaturas e o logo em branco.
export function waitImages(el, timeoutMs = 5000) {
  const imgs = Array.from(el?.querySelectorAll('img') || [])
  const pending = imgs.filter(img => !img.complete)
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pending.map(img => new Promise(res => {
      img.addEventListener('load', res, { once: true })
      img.addEventListener('error', res, { once: true })
    }))),
    new Promise(res => setTimeout(res, timeoutMs)),
  ])
}
