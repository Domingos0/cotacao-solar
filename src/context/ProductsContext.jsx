import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { products as defaultProducts, assignKitRole, fixedProducts } from '../data/products'
import { supabase } from '../lib/supabase'

const ProductsContext = createContext()

// Marca "o rascunho já tinha dado erro (ensureDraftVersion já reportou)" —
// os save* abaixo rejeitam com isso em vez de reportar de novo com uma
// mensagem genérica menos útil que a original.
class DraftUnavailableError extends Error {}

export const DEFAULT_CONDICOES =
`Preços FOB Itajaí-SC. Sujeitos a alteração sem aviso prévio.
Validade desta proposta: 7 dias a partir da data de emissão.
Dúvidas: (94) 9209-0380 · vendas@ernaniff.com.br`

export const DEFAULT_FRETE = [
  { id: 1, nome: 'FOB – Retirada em nossa fábrica WEG em Itajaí-SC', acrescimo: 1.000 },
  { id: 2, nome: 'CIF – Sem descarga – Região Sul',                   acrescimo: 1.045 },
  { id: 3, nome: 'CIF – Sem descarga – Região Sudeste',               acrescimo: 1.055 },
  { id: 4, nome: 'CIF – Sem descarga – Região Centro Oeste',          acrescimo: 1.075 },
  { id: 5, nome: 'CIF – Sem descarga – Região Nordeste',              acrescimo: 1.085 },
  { id: 6, nome: 'CIF – Sem descarga – Região Norte',                 acrescimo: 1.110 },
]

// ─── Supabase persistence (catálogo versionado) ───────────────────────────────
// Em desenvolvimento (localhost), todo acesso ao Supabase é bloqueado.
// O catálogo usa só os dados padrão do bundle, sem conflito com produção.
const IS_DEV = import.meta.env.DEV

// Busca a versão publicada do catálogo (produtos, lista ativa, frete, desconto,
// condições). Em qualquer erro (ex: migração ainda não aplicada), deixa quem
// chamou tratar — degrada pros defaults do bundle, nunca pra um cache velho.
async function fetchPublishedCatalog(versionId) {
  const [verRes, prodRes, codesRes, freteRes, descRes] = await Promise.all([
    supabase.from('price_catalog_versions').select('*').eq('id', versionId).maybeSingle(),
    supabase.from('price_catalog_products').select('data').eq('version_id', versionId),
    supabase.from('price_catalog_active_codes').select('codigo').eq('version_id', versionId),
    supabase.from('freight_options').select('nome, acrescimo').eq('version_id', versionId).order('acrescimo', { ascending: true }),
    supabase.from('discount_defaults').select('desconto').eq('version_id', versionId).maybeSingle(),
  ])
  return {
    version:   verRes.data || null,
    products:  (prodRes.data || []).map(r => r.data),
    codes:     (codesRes.data || []).map(r => r.codigo),
    frete:     freteRes.data || [],
    desconto:  descRes.data ? descRes.data.desconto : null,
  }
}

const r2 = v => v != null ? Math.round(v * 100) / 100 : v

function normalizeProduct(p) {
  return { ...p }
}

const DEFAULT_TABLE_INFO = {
  nome: 'Lista Novembro 2025 R0',
  mes: '2025-11',
  versao: 'R0',
  observacao: 'Preços FOB Itajaí-SC. Sujeitos a alteração sem aviso prévio.',
  validityDays: 7,
}

// ─── Provider ─────────────────────────────────────────────────────────────────
// Sem cache local (localStorage): o catálogo é sempre carregado na hora, a
// partir do servidor (ou do bundle padrão em dev). Isso existia antes como
// "cache com checagem de versão", mas divergências entre o cache de cada
// navegador e o que estava de fato publicado causaram confusão repetida
// (um navegador mostrando a lista nova, outro preso numa antiga). Carregar
// sempre do zero elimina essa classe de bug, ao custo de um fetch a mais
// a cada abertura da página.
export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(() => defaultProducts.map(normalizeProduct))
  const [tableInfo, setTableInfo] = useState(DEFAULT_TABLE_INFO)
  const [freteOpcoes, setFreteOpcoes] = useState(DEFAULT_FRETE)
  const [desconto, setDesconto]       = useState(0)
  const [activeListCodes, setActiveListCodesState] = useState(null)
  const [condicoes, setCondicoes] = useState(DEFAULT_CONDICOES)
  const [catalogLoading, setCatalogLoading] = useState(!IS_DEV)
  // Item 45 — datasheets por linha de inversor ({linha: url}); não faz
  // parte do catálogo versionado (price_catalog_versions), é sua própria
  // tabela simples, então carrega independente da checagem de versão.
  const [datasheetsByLinha, setDatasheetsByLinha] = useState({})
  const reloadDatasheets = useCallback(async () => {
    if (IS_DEV) return
    const { data, error } = await supabase.from('inverter_datasheets').select('linha, url')
    if (error) { console.warn('[datasheets] load error:', error.message); return }
    setDatasheetsByLinha(Object.fromEntries((data || []).map(r => [r.linha, r.url])))
  }, [])
  useEffect(() => { reloadDatasheets() }, [reloadDatasheets])

  // Erro global de gravação do catálogo (rascunho no Supabase) — todas as
  // funções save* abaixo atualizam o state local IMEDIATAMENTE (por isso a
  // tela sempre parece "salvar na hora"), mas a escrita real no banco é
  // assíncrona em segundo plano. Antes, se essa escrita falhasse, o erro só
  // ia pro console — a tela continuava dizendo "salvo" mesmo com o rascunho
  // no banco desatualizado. Centraliza isso aqui num state exposto pelo
  // contexto, pra qualquer tela mostrar um aviso quando acontecer.
  const [catalogSaveError, setCatalogSaveError] = useState(null)
  const clearCatalogSaveError = useCallback(() => setCatalogSaveError(null), [])
  const reportCatalogSaveError = useCallback((label, e) => {
    console.warn(`[catalog] ${label} error:`, e?.message)
    setCatalogSaveError(`Falha ao sincronizar "${label}" com o servidor — suas alterações ficaram só neste navegador até você tentar de novo. (${e?.message || 'erro desconhecido'})`)
  }, [])

  // id da versão de rascunho em edição (admin), resolvido sob demanda e
  // reaproveitado enquanto durar esta sessão
  const draftVersionIdRef = useRef(null)

  const ensureDraftVersion = useCallback(async () => {
    if (draftVersionIdRef.current) return draftVersionIdRef.current
    try {
      const { data, error } = await supabase.rpc('get_or_create_draft_catalog_version')
      if (error) throw error
      draftVersionIdRef.current = data
      return data
    } catch (e) {
      // Antes só logava no console e devolvia null — cada save* abaixo via
      // "sem draftId" como um simples no-op silencioso (nenhum erro visível),
      // deixando a tela achar que salvou quando na verdade nada foi gravado
      // no servidor. Isso mascarou o bug real de "importei mas não publicou
      // pra todo mundo": o publish seguinte reaproveitava um rascunho antigo
      // (o único que existia), sem o conteúdo recém-importado.
      console.warn('[catalog] draft version error:', e?.message)
      reportCatalogSaveError('preparar rascunho do catálogo', e)
      return null
    }
  }, [reportCatalogSaveError])

  // Sem localStorage: compara contra o id guardado em memória (nesta mesma
  // sessão de página) só pra não repetir o fetch completo sem necessidade
  // no polling periódico — isso NÃO é persistido, então toda vez que a
  // página é aberta de novo (F5, nova aba, outro navegador) esse ref começa
  // vazio e a primeira chamada busca a versão publicada do zero, garantido.
  const lastSeenVersionIdRef = useRef(null)
  const checkCatalogVersion = useCallback(async ({ signal } = {}) => {
    if (IS_DEV) { setCatalogLoading(false); return }
    try {
      const { data: versionId, error } = await supabase.rpc('current_catalog_version')
      if (error) throw error
      if (signal?.cancelled) return
      if (!versionId) { setCatalogLoading(false); return } // nunca houve publicação: mantém os defaults do bundle
      if (lastSeenVersionIdRef.current === versionId) { setCatalogLoading(false); return }

      const { version, products: prods, codes, frete, desconto: desc } = await fetchPublishedCatalog(versionId)
      if (signal?.cancelled) return
      if (!prods.length) { setCatalogLoading(false); return } // versão publicada sem produtos: mantém defaults

      const restored = prods.map(p => normalizeProduct({ ...p, kitRole: p.kitRole ?? assignKitRole(p) }))
      setProducts(restored)

      setActiveListCodesState(codes.length ? new Set(codes) : null)

      if (version) {
        setTableInfo({
          nome: version.label, mes: version.vigencia_mes, versao: version.versao, observacao: version.observacao,
          validityDays: version.validity_days ?? 7,
        })
        if (typeof version.condicoes === 'string' && version.condicoes) setCondicoes(version.condicoes)
      }

      if (frete.length) {
        setFreteOpcoes(frete.map((f, i) => ({ id: i + 1, nome: f.nome, acrescimo: f.acrescimo })))
      }

      if (desc !== null && desc !== undefined) setDesconto(Number(desc))

      lastSeenVersionIdRef.current = versionId
    } catch (e) {
      console.warn('[catalog] version check error:', e?.message)
    } finally {
      if (!signal?.cancelled) setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (IS_DEV) return
    const signal = { cancelled: false }
    checkCatalogVersion({ signal })

    // Reconfirma periodicamente (sem precisar recarregar a página) e também
    // quando a aba volta a ficar visível — cobre quem deixa o navegador
    // aberto enquanto o admin publica uma lista nova.
    const intervalId = setInterval(() => checkCatalogVersion(), 5 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') checkCatalogVersion() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      signal.cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkCatalogVersion])

  // fixedProducts (Smart Home, estruturas Solo, acessórios de micro) nunca
  // vêm do import do xlsx — a lista ativa (activeListCodes) é montada só com
  // os códigos importados, então esses produtos fixos sempre ficavam de fora
  // do filtro do catálogo assim que qualquer lista era publicada. Mantém
  // esses sempre visíveis, independente do que estiver na lista ativa.
  const fixedProductIds = React.useMemo(() => new Set(fixedProducts.map(p => p.id)), [])
  const catalogProducts = React.useMemo(() => {
    if (!activeListCodes || activeListCodes.size === 0) return products
    return products.filter(p => activeListCodes.has(p.codigo) || fixedProductIds.has(p.id))
  }, [products, activeListCodes, fixedProductIds])

  // Cada save* abaixo: grava local (otimista) na hora, e devolve uma promise
  // que só resolve de verdade depois da escrita no servidor ter confirmado.
  // Antes, um erro aqui (incluindo "não consegui nem preparar o rascunho")
  // era só reportado via catalogSaveError e a promise resolvia normalmente
  // mesmo assim — quem chamava (ex: handleImport) não tinha como saber que
  // nada foi salvo, e podia seguir pra publicar um rascunho que não recebeu
  // a escrita. Agora essas funções REJEITAM a promise nesse caso, pra quem
  // encadeia ações (import → lista ativa → publicar) poder abortar a cadeia.
  const saveProducts = useCallback((newProducts) => {
    setProducts(newProducts)
    if (IS_DEV) return Promise.resolve()
    return ensureDraftVersion().then(draftId => {
      if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
      return supabase.rpc('replace_catalog_products', { p_version_id: draftId, p_products: newProducts })
        .then(({ error }) => { if (error) throw error })
    }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('produtos', e); throw e })
  }, [ensureDraftVersion, reportCatalogSaveError])

  const saveTableInfo = useCallback((info) => {
    setTableInfo(info)
    if (IS_DEV) return Promise.resolve()
    return ensureDraftVersion().then(draftId => {
      if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
      return supabase.from('price_catalog_versions').update({
        label: info.nome, vigencia_mes: info.mes, versao: info.versao, observacao: info.observacao,
        validity_days: Math.max(1, Number(info.validityDays) || 7),
      }).eq('id', draftId).then(({ error }) => { if (error) throw error })
    }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('dados da tabela', e); throw e })
  }, [ensureDraftVersion, reportCatalogSaveError])

  const setActiveListCodes = useCallback((codes) => {
    const s = codes && codes.length > 0 ? new Set(codes) : null
    setActiveListCodesState(s)
    if (s) {
      const arr = [...s]
      if (IS_DEV) return Promise.resolve()
      return ensureDraftVersion().then(async (draftId) => {
        if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
        const del = await supabase.from('price_catalog_active_codes').delete().eq('version_id', draftId)
        if (del.error) throw del.error
        const ins = await supabase.from('price_catalog_active_codes').insert(arr.map(codigo => ({ version_id: draftId, codigo })))
        if (ins.error) throw ins.error
      }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('lista ativa', e); throw e })
    } else {
      if (IS_DEV) return Promise.resolve()
      return ensureDraftVersion().then(draftId => {
        if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
        return supabase.from('price_catalog_active_codes').delete().eq('version_id', draftId)
          .then(({ error }) => { if (error) throw error })
      }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('lista ativa', e); throw e })
    }
  }, [ensureDraftVersion, reportCatalogSaveError])

  const clearActiveList = useCallback(() => {
    setActiveListCodesState(null)
    if (IS_DEV) return
    ensureDraftVersion().then(draftId => {
      if (!draftId) return
      return supabase.from('price_catalog_active_codes').delete().eq('version_id', draftId)
    }).catch(e => reportCatalogSaveError('lista ativa', e))
  }, [ensureDraftVersion, reportCatalogSaveError])

  // Publica a versão de rascunho em edição, tornando-a a versão oficial
  // vista por todos os clientes (via current_catalog_version()).
  const publishCatalog = useCallback(async () => {
    if (IS_DEV) return { ok: false, error: 'Publicação indisponível em desenvolvimento.' }
    const draftId = draftVersionIdRef.current || await ensureDraftVersion()
    if (!draftId) return { ok: false, error: 'Não foi possível preparar a versão para publicação.' }
    try {
      const { error } = await supabase.rpc('publish_price_catalog', { p_version_id: draftId })
      if (error) throw error
      draftVersionIdRef.current = null
      lastSeenVersionIdRef.current = draftId
      // "Avise-me quando chegar" (item 32) — dispara em segundo plano, sem
      // bloquear nem falhar a publicação por causa disso.
      supabase.rpc('check_stock_notifications').then(({ error: e }) => {
        if (e) console.warn('[check_stock_notifications]', e.message)
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e?.message || 'Erro ao publicar.' }
    }
  }, [ensureDraftVersion])

  // Edições individuais de produto (toggle de estoque, editar um campo,
  // excluir) só gravavam no rascunho e nunca publicavam — a tela do admin
  // mostrava a mudança na hora (estado local otimista), mas um F5/logout
  // puxava de novo a versão PUBLICADA antiga, revertendo a edição (ex:
  // estoque "Esgotado" voltando pra "Disponível" sozinho). Publica
  // automaticamente depois de cada uma dessas ações discretas — nenhum
  // call site destas três funções é por tecla digitada, sempre um clique
  // único, então publicar a cada chamada é seguro e não gera spam de RPC.
  const publishAfter = useCallback(async (savePromise) => {
    try {
      await savePromise
      const res = await publishCatalog()
      if (!res.ok) reportCatalogSaveError('publicar alteração', new Error(res.error))
    } catch { /* saveProducts já reportou o próprio erro de gravação */ }
  }, [publishCatalog, reportCatalogSaveError])

  const addProduct = useCallback((product) => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1
    const newProduct = normalizeProduct({ ...product, id: newId })
    const updated = [...products, newProduct]
    publishAfter(saveProducts(updated))
    return newProduct
  }, [products, saveProducts, publishAfter])

  const updateProduct = useCallback((id, updates) => {
    const updated = products.map(p => p.id === id ? { ...p, ...updates } : p)
    publishAfter(saveProducts(updated))
  }, [products, saveProducts, publishAfter])

  const deleteProduct = useCallback((id) => {
    const updated = products.filter(p => p.id !== id)
    publishAfter(saveProducts(updated))
  }, [products, saveProducts, publishAfter])

  const resetToDefaults = useCallback(() => {
    return saveProducts(defaultProducts)
  }, [saveProducts])

  const syncDefaultPrices = useCallback(() => {
    const byCode = {}
    defaultProducts.forEach(p => { byCode[p.codigo] = p })
    let count = 0
    const updated = products.map(p => {
      const def = byCode[p.codigo]
      if (!def || def.preco == null) return p
      const defPreco = r2(def.preco)
      const changed = p.preco !== defPreco || p.precoFrete !== defPreco
      if (changed) count++
      return changed ? { ...p, preco: defPreco, precoFrete: defPreco, ipi: def.ipi ?? p.ipi } : p
    })
    const saved = saveProducts(updated)
    return { count, saved }
  }, [products, saveProducts])

  const saveDesconto = useCallback((val) => {
    const v = Math.min(100, Math.max(0, Number(val) || 0))
    setDesconto(v)
    if (IS_DEV) return
    publishAfter(ensureDraftVersion().then(draftId => {
      if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
      return supabase.from('discount_defaults').upsert({ version_id: draftId, desconto: v })
        .then(({ error }) => { if (error) throw error })
    }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('desconto padrão', e); throw e }))
  }, [ensureDraftVersion, reportCatalogSaveError, publishAfter])

  const saveCondicoes = useCallback((texto) => {
    const v = typeof texto === 'string' ? texto : DEFAULT_CONDICOES
    setCondicoes(v)
    if (IS_DEV) return
    publishAfter(ensureDraftVersion().then(draftId => {
      if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
      return supabase.from('price_catalog_versions').update({ condicoes: v }).eq('id', draftId)
        .then(({ error }) => { if (error) throw error })
    }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('condições comerciais', e); throw e }))
  }, [ensureDraftVersion, reportCatalogSaveError, publishAfter])

  const saveFrete = useCallback((opcoes) => {
    setFreteOpcoes(opcoes)
    if (IS_DEV) return
    publishAfter(ensureDraftVersion().then(async (draftId) => {
      if (!draftId) throw new DraftUnavailableError('rascunho indisponível')
      const del = await supabase.from('freight_options').delete().eq('version_id', draftId)
      if (del.error) throw del.error
      if (opcoes.length) {
        const ins = await supabase.from('freight_options').insert(opcoes.map(o => ({ version_id: draftId, nome: o.nome, acrescimo: o.acrescimo })))
        if (ins.error) throw ins.error
      }
    }).catch(e => { if (!(e instanceof DraftUnavailableError)) reportCatalogSaveError('opções de frete', e); throw e }))
  }, [ensureDraftVersion, reportCatalogSaveError, publishAfter])

  const addFreteOpcao = useCallback((opcao) => {
    const nextId = Math.max(...freteOpcoes.map(f => f.id), 0) + 1
    saveFrete([...freteOpcoes, { ...opcao, id: nextId }])
  }, [freteOpcoes, saveFrete])

  const updateFreteOpcao = useCallback((id, updates) => {
    saveFrete(freteOpcoes.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [freteOpcoes, saveFrete])

  const deleteFreteOpcao = useCallback((id) => {
    saveFrete(freteOpcoes.filter(f => f.id !== id))
  }, [freteOpcoes, saveFrete])

  const resetFrete = useCallback(() => {
    saveFrete(DEFAULT_FRETE)
  }, [saveFrete])

  return (
    <ProductsContext.Provider value={{
      products,
      catalogProducts,
      catalogLoading,
      activeListCodes,
      tableInfo,
      freteOpcoes,
      desconto,
      saveProducts,
      saveTableInfo,
      setActiveListCodes,
      clearActiveList,
      addProduct,
      updateProduct,
      deleteProduct,
      resetToDefaults,
      syncDefaultPrices,
      saveDesconto,
      condicoes,
      saveCondicoes,
      saveFrete,
      addFreteOpcao,
      updateFreteOpcao,
      deleteFreteOpcao,
      resetFrete,
      publishCatalog,
      catalogSaveError,
      clearCatalogSaveError,
      datasheetsByLinha,
      reloadDatasheets,
    }}>
      {children}
      {/* Aviso global: aparece em qualquer tela sempre que uma gravação do
          catálogo falhar em segundo plano (ver reportCatalogSaveError acima) —
          sem isso, a tela mostrava "salvo" mesmo com a escrita no banco falha. */}
      {catalogSaveError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, maxWidth: 380 }}
          className="bg-red-50 border border-red-300 rounded-xl shadow-lg p-4 text-sm text-red-800 flex items-start gap-2">
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Erro ao salvar no servidor</p>
            <p className="text-xs">{catalogSaveError}</p>
          </div>
          <button onClick={clearCatalogSaveError} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
        </div>
      )}
    </ProductsContext.Provider>
  )
}

export const useProducts = () => useContext(ProductsContext)
