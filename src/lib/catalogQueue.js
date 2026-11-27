// Gravação do catálogo (rascunho → publicar) sem corrida.
// Cada edição de produto grava no rascunho e publica. Edições rápidas
// seguidas corriam juntas e a 2ª gravava no rascunho que a 1ª acabara de
// publicar → "cannot edit a published catalog version directly".

// Fila: cada tarefa só começa quando a anterior terminou (com sucesso ou erro)
export function createSerialQueue() {
  let tail = Promise.resolve()
  return (fn) => {
    const p = tail.then(fn, fn)
    tail = p.catch(() => {})
    return p
  }
}

// Grava no rascunho; se o rascunho guardado já foi publicado (por outra
// aba/admin), descarta o id, pega um rascunho novo e tenta mais 1 vez.
export async function replaceWithRetry({ getDraftId, resetDraft, replace }) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const draftId = await getDraftId()
    if (!draftId) return { ok: false, semRascunho: true }
    const { error } = await replace(draftId)
    if (!error) return { ok: true }
    if (tentativa === 0 && /published/i.test(error.message || '')) { resetDraft(); continue }
    throw error
  }
  return { ok: true }
}
