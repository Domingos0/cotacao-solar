// Item 44: endereço próprio por tela (e por cotação, pra mandar link
// direto). O app não usa react-router — a navegação já é um switch simples
// por `page` (estado em App.jsx). Isso só sincroniza esse MESMO estado com
// a URL via History API, sem trocar a arquitetura existente.
export const PAGE_TO_PATH = {
  catalog: '/catalogo',
  kit: '/montar-kit',
  promocoes: '/kits-promocao',
  cotacoes: '/minhas-cotacoes',
  dimensionamento: '/dimensionar-bateria',
  'simulacao-solar': '/simulacao-solar',
  admin: '/admin',
}

// page + id opcional (só faz sentido pra 'cotacoes', pra apontar uma
// cotação específica) → path.
export function pathForPage(page, quoteId) {
  const base = PAGE_TO_PATH[page] || PAGE_TO_PATH.catalog
  if (page === 'cotacoes' && quoteId) return `${base}/${quoteId}`
  return base
}

// path → { page, quoteId } — o inverso de pathForPage. Path desconhecido
// cai no catálogo (mesmo comportamento de sempre, só que agora previsível
// a partir de QUALQUER path, não só da raiz).
export function pageFromPath(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/'
  for (const [page, path] of Object.entries(PAGE_TO_PATH)) {
    if (clean === path) return { page, quoteId: null }
    if (clean.startsWith(`${path}/`)) {
      const rest = clean.slice(path.length + 1)
      return { page, quoteId: rest || null }
    }
  }
  return { page: 'catalog', quoteId: null }
}
