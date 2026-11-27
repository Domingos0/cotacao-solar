// Importar vários datasheets de uma vez: pelo NOME do arquivo descobre a
// série (SIW200G, SIW500H…) e os modelos cobertos (M030_M060, T010-T025,
// "3 a 6K"…), e monta um plano: qual PDF vira o padrão de cada linha e
// quais modelos precisam de um PDF próprio (override em product.datasheetUrl).
// O admin vê a prévia antes de aplicar.

// Normaliza o prefixo do código: ST012 ~ T012, SK020 ~ K020 (mesma família)
const famPrefix = p => (p.length > 1 ? p.slice(-1) : p)

const SERIE_RE_SIW = /SIW[\s_-]*(\d{3})([GH])?(?![\dA-Z])/
const SERIE_RE_BARE = /(?:^|[^\dA-Z])(\d{3})([GH])(?=[\s_-]|$)/
const SERIE_RE_GLUED = /DATASHEET(\d{3})([GH])/

function detectSerie(text) {
  const t = text.toUpperCase()
  const m = SERIE_RE_SIW.exec(t) || SERIE_RE_GLUED.exec(t) || SERIE_RE_BARE.exec(t)
  return m ? `SIW${m[1]}${m[2] || ''}` : null
}

// Nome de arquivo → { serie, codes:[{p,n}], range:{p,min,max}|null, kw:{min,max}|null }
export function parseDatasheetName(fileName) {
  const base = String(fileName || '').replace(/\.pdf$/i, '').toUpperCase()
  const serie = detectSerie(base)
  if (!serie) return { serie: null, codes: [], range: null, kw: null }

  // tira a série do texto pra ela não virar "código" (ex: 610 / 200H)
  const resto = base
    .replace(SERIE_RE_SIW, ' ').replace(SERIE_RE_GLUED, ' ').replace(SERIE_RE_BARE, ' ')

  // "T010-T025" → faixa explícita
  let range = null
  const r = /(ST|SK|[MKTS])(\d{3})\s*-\s*(?:ST|SK|[MKTS])?(\d{3})/.exec(resto)
  if (r) range = { p: famPrefix(r[1]), min: Number(r[2]), max: Number(r[3]) }

  const codes = []
  const codeRe = /(?:^|[^A-Z0-9])(ST|SK|[MKTS])(\d{3})(?=[^0-9]|$)/g
  const restoEsp = resto.replace(/_/g, ' ')
  let m
  while ((m = codeRe.exec(restoEsp))) codes.push({ p: famPrefix(m[1]), raw: m[1], n: Number(m[2]) })

  // 2+ códigos da mesma família viram faixa (M030_M050_M060 → M 30..60)
  if (!range && codes.length >= 2 && codes.every(c => c.p === codes[0].p)) {
    const ns = codes.map(c => c.n)
    range = { p: codes[0].p, min: Math.min(...ns), max: Math.max(...ns) }
  }

  // "3_a_6K" → faixa de potência em kW
  let kw = null
  const k = /(\d+(?:[.,]\d+)?)\s*A\s*(\d+(?:[.,]\d+)?)\s*KW?\b/.exec(base.replace(/_/g, ' '))
  if (k) kw = { min: Number(k[1].replace(',', '.')), max: Number(k[2].replace(',', '.')) }

  return { serie, codes, range, kw }
}

// Produto do catálogo → { serie, code:{p,n}|null, kw }
export function parseProductModel(nome) {
  const t = String(nome || '').toUpperCase()
  const serie = detectSerie(t)
  if (!serie) return { serie: null, code: null, kw: null }
  const resto = t.replace(SERIE_RE_SIW, ' ')
  const m = /(?:^|[^A-Z0-9])(ST|SK|[MKTSH])(\d{3})(?=[^0-9]|$)/.exec(resto)
  if (!m) return { serie, code: null, kw: null }
  const p = famPrefix(m[1])
  const n = Number(m[2])
  return { serie, code: { p, raw: m[1], n }, kw: p === 'M' ? n / 10 : n }
}

// 3 = arquivo só desse modelo, 2 = modelo citado entre vários,
// 1 = por faixa/potência ou arquivo da série toda, 0 = não cobre
export function coverage(file, prod) {
  if (!file.serie || file.serie !== prod.serie) return 0
  const semModelo = !file.codes.length && !file.range && !file.kw
  if (semModelo) return 1
  if (!prod.code) return 0
  // Código exato: prefixo IDÊNTICO (ST020 ≠ T020 — são modelos diferentes);
  // a família (ST ~ T) só vale pra faixa logo abaixo.
  const citado = file.codes.some(c => c.raw === prod.code.raw && c.n === prod.code.n)
  if (citado) return file.codes.length === 1 ? 3 : 2
  if (file.range && file.range.p === prod.code.p && prod.code.n >= file.range.min && prod.code.n <= file.range.max) return 1
  // "7 a 10K" cobre 10,5 kW (M105): meio kW de folga no teto
  if (file.kw && prod.kw != null && prod.kw >= file.kw.min && prod.kw <= file.kw.max + 0.5) return 1
  return 0
}

const prefereArquivo = (a, b) =>
  (Number(/^DATASHEET/i.test(b.name)) - Number(/^DATASHEET/i.test(a.name))) || (a.name.length - b.name.length)

// files: [{ name }], products: [{ id, nome }], getLinha(product) → 'SIW200G' | null
export function planDatasheetImport(files, products, getLinha) {
  // File do navegador guarda `name` num getter do protótipo — `{...f}` perde
  // o nome. Copia explícito e guarda o File original em `original`.
  const parsedFiles = files.map(f => ({ name: f.name, original: f, ...parseDatasheetName(f.name) }))
  const inversores = products
    .map(p => ({ product: p, linha: getLinha(p), ...parseProductModel(p.nome) }))
    .filter(p => p.serie)

  // 1) PDF padrão de cada linha: entre os arquivos da MESMA série da linha,
  //    o que cobre mais modelos dela (empate: começa com DATASHEET, nome curto)
  const linhas = [...new Set(inversores.map(p => p.linha).filter(Boolean))]
  const padraoPorLinha = {}
  linhas.forEach(linha => {
    const daLinha = inversores.filter(p => p.linha === linha)
    const candidatos = parsedFiles
      .filter(f => f.serie === linha)
      .map(f => ({ f, n: daLinha.filter(p => coverage(f, p) > 0).length }))
      .sort((a, b) => (b.n - a.n) || prefereArquivo(a.f, b.f))
    if (candidatos.length) padraoPorLinha[linha] = candidatos[0].f
  })

  // 2) Modelo com PDF próprio: o melhor arquivo que cobre o modelo, quando
  //    ele não é o padrão que a linha do modelo já vai ter
  const modelos = []
  inversores.forEach(p => {
    const melhor = parsedFiles
      .map(f => ({ f, c: coverage(f, p) }))
      .filter(x => x.c > 0)
      .sort((a, b) => (b.c - a.c) || prefereArquivo(a.f, b.f))[0]
    if (!melhor) return
    if (padraoPorLinha[p.linha] && padraoPorLinha[p.linha].name === melhor.f.name) return
    modelos.push({ product: p.product, file: melhor.f })
  })

  const usados = new Set([...Object.values(padraoPorLinha), ...modelos.map(m => m.file)].map(f => f.name))
  const ignorados = parsedFiles
    .filter(f => !usados.has(f.name))
    .map(f => ({ file: f, motivo: f.serie ? `nenhum modelo ${f.serie} do catálogo usa esse PDF` : 'não é datasheet de inversor' }))

  return {
    linhas: Object.entries(padraoPorLinha).map(([linha, file]) => ({ linha, file })).sort((a, b) => a.linha.localeCompare(b.linha)),
    modelos,
    ignorados,
  }
}
