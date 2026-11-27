import { describe, it, expect } from 'vitest'
import { createSerialQueue, replaceWithRetry } from './catalogQueue'

// Banco falso com a mesma regra do Supabase: rascunho publicado não aceita
// gravação; get_or_create_draft devolve o rascunho aberto ou cria um novo.
function fakeDb() {
  const versions = []
  let nextId = 1
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  return {
    versions,
    async getOrCreateDraft() {
      await sleep(2)
      let d = versions.find(v => !v.published)
      // como no Supabase: rascunho novo nasce como cópia do catálogo publicado
      if (!d) { d = { id: nextId++, published: false, products: this.publicado() ?? null }; versions.push(d) }
      return d.id
    },
    async replace(id, products) {
      await sleep(5)
      const v = versions.find(x => x.id === id)
      if (v.published) return { error: { message: 'cannot edit a published catalog version directly' } }
      v.products = products
      return { error: null }
    },
    async publish(id) {
      await sleep(3)
      versions.find(x => x.id === id).published = true
    },
    publicado() { return [...versions].reverse().find(v => v.published)?.products },
  }
}

const sleepMs = ms => new Promise(r => setTimeout(r, ms))

describe('gravação do catálogo com edições rápidas seguidas', () => {
  it('código ANTIGO (sem fila): reproduz "cannot edit a published catalog version"', async () => {
    const db = fakeDb()
    let draftId = null
    const getDraftId = async () => draftId || (draftId = await db.getOrCreateDraft())
    const save = async (p) => { const { error } = await db.replace(await getDraftId(), p); if (error) throw error }
    const publish = async () => { await db.publish(await getDraftId()); draftId = null }
    const update = async (p) => { await save(p); await publish() }
    const digitando = [['2026-12'], ['2026-12-1'], ['2026-12-15']].map((v, i) => sleepMs(i * 8).then(() => update(v)))
    const r = await Promise.allSettled(digitando)
    expect(r.some(x => x.status === 'rejected' && /published/.test(x.reason.message))).toBe(true)
  })

  it('código NOVO (com fila): 3 edições rápidas sem erro, e vale a última', async () => {
    const db = fakeDb()
    let draftId = null
    const fila = createSerialQueue()
    const getDraftId = async () => draftId || (draftId = await db.getOrCreateDraft())
    const save = (p) => fila(() => replaceWithRetry({
      getDraftId, resetDraft: () => { draftId = null }, replace: id => db.replace(id, p),
    }))
    const publish = () => fila(async () => { await db.publish(await getDraftId()); draftId = null })
    const update = async (p) => { await save(p); await publish() }
    const digitando = [['2026-12'], ['2026-12-1'], ['2026-12-15']].map((v, i) => sleepMs(i * 8).then(() => update(v)))
    const r = await Promise.allSettled(digitando)
    expect(r.every(x => x.status === 'fulfilled')).toBe(true)
    expect(db.publicado()).toEqual(['2026-12-15'])
  })

  it('rascunho publicado por outra aba: pega um novo e grava', async () => {
    const db = fakeDb()
    let draftId = await db.getOrCreateDraft()
    await db.publish(draftId) // outra aba publicou
    const r = await replaceWithRetry({
      getDraftId: async () => draftId || (draftId = await db.getOrCreateDraft()),
      resetDraft: () => { draftId = null },
      replace: id => db.replace(id, ['ok']),
    })
    expect(r.ok).toBe(true)
    expect(db.versions.find(v => !v.published).products).toEqual(['ok'])
  })
})
