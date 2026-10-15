// Product image paths — extracted from PORTFOLIO_WEG_SOLAR.pdf (WEG 2024/2025)
// All inverter images are transparent PNGs (background removed)

// ── WEG Inverters (PNG, transparent background) ──────────────────────────────
const WEG = {
  siw100g_m010: '/img/inversores/siw100g_m010.png',
  siw100g_m024: '/img/inversores/siw100g_m024.png',
  siw200g:      '/img/inversores/siw200g_w1.png',
  siw300h:      '/img/inversores/siw300h_w00.png',
  siw400g_s:    '/img/inversores/siw400g_w1.png',
  siw400g_m:    '/img/inversores/siw400g_w00.png',
  siw400g_l:    '/img/inversores/siw400g_large.png',
  siw500h:      '/img/inversores/siw500h.png',
  siw610:       '/img/inversores/siw610.png',
  cfw500:       '/img/inversores/cfw500.png',
  siw200h:      '/img/inversores/siw200h.png',
  siw400h:      '/img/inversores/siw400h.png',
}

// ── WEG Batteries (PNG, transparent background) ───────────────────────────────
const BAT = {
  cb050:  '/img/baterias/bateria_cb050.png',   // SBW CB050 — 5 kWh
  cb100:  '/img/baterias/bateria_cb100.png',   // SBW CB100 — 10 kWh
  sbw300: '/img/baterias/bateria_sbw300.png',  // SBW300    — 7/14/21 kWh
}

// ── Solar Panels (PNG, transparent background, from WEG PDF p.4) ─────────────
const PANEL = {
  mono:     '/img/modulos/modulo_mono.png',
  bifacial: '/img/modulos/modulo_bifacial.png',
}

// ── WEG Structures (PNG, cropped from portfolio slides) ───────────────────────
const EST = {
  solo:    '/img/estruturas/estrutura_solo.png',
  tracker: '/img/estruturas/estrutura_tracker.png',
  carport: '/img/estruturas/estrutura_carport.png',
  telhado: '/img/estruturas/estrutura_telhado.png',
  laje:    '/img/estruturas/estrutura_laje.png',
  suporte: '/img/estruturas/acessorio_suporte.png',
  fixacao: '/img/estruturas/acessorio_fixacao.png',
  perfil:  '/img/estruturas/acessorio_perfil.png',
}

// ── Cabos e conectores (fotos reais, fundo transparente) ──────────────────────
const CABO = {
  vermelho: '/img/cabos/cabo_vermelho.png',
  preto:    '/img/cabos/cabo_preto.png',
  conector: '/img/cabos/conector_mc4.jpeg',
}

// ── Proteção elétrica (fotos reais WEG) ────────────────────────────────────────
const PROT = {
  disjuntor: '/img/protecao/disjuntor.webp',
  dps:       '/img/protecao/dps.webp',
}

// ── Generic photo fallbacks (Unsplash) ───────────────────────────────────────
const UNS = 'https://images.unsplash.com'
const IMG = {
  ev:         `${UNS}/photo-1593941707882-a5bba14938c7?w=700&q=85&auto=format&fit=crop`,
  cable:      `${UNS}/photo-1558618047-3c8c76ca7d13?w=700&q=85&auto=format&fit=crop`,
  monitor:    `${UNS}/photo-1551288049-bebda4e38f71?w=700&q=85&auto=format&fit=crop`,
  smart:      `${UNS}/photo-1558618666-fcd25c85cd64?w=700&q=85&auto=format&fit=crop`,
  protection: `${UNS}/photo-1517077944-823ea887978c?w=700&q=85&auto=format&fit=crop`,
}

export const CATEGORY_IMG = {
  'Módulos Fotovoltaicos':              PANEL.mono,
  'Inversores Monofásicos':             WEG.siw300h,
  'Inversores Trifásicos':              WEG.siw500h,
  'Microinversores':                    WEG.siw100g_m024,
  'Inversores de Bombeamento':          WEG.cfw500,
  'Cabos e Conectores':                 CABO.preto,
  'Proteção e Acessórios':              PROT.dps,
  'Estruturas Metálicas':               EST.solo,
  'Estruturas – Componentes Avulsos':   EST.suporte,
  'Monitoramento':                      IMG.monitor,
  'Baterias e Armazenamento':           BAT.cb100,
  'Estações de Recarga EV':             IMG.ev,
  'WEG Smart Home':                     IMG.smart,
  'Otimizador':                         WEG.siw300h,
  'Banco de Capacitores':               IMG.protection,
}

export const KIT_TYPE_IMG = {
  ongrid_mono:  WEG.siw300h,
  ongrid_tri:   WEG.siw500h,
  micro:        WEG.siw100g_m024,
  bombeamento:  WEG.cfw500,
}

// Item de cotação salva é um snapshot achatado (sem `categoria`), então a
// categoria é inferida por palavra-chave no rótulo curto pra achar a foto real
// certa (módulo, cabo/conector, proteção) em vez de cair no ícone genérico.
// Baseado só no rótulo — evita falso-positivo tipo "kit p/ 4 módulos" na
// descrição de uma ESTRUTURA sendo lido como se fosse um módulo.
export function guessCategoria(label) {
  const t = (label || '').toLowerCase()
  if (/estrutura|fixação|fixacao/.test(t)) return undefined // getProductImage já resolve via palavra-chave (fixação/trilho/etc.)
  if (/protetor de surto|disjuntor|\bdps\b/.test(t)) return 'Proteção e Acessórios'
  if (/\bcabo\b|conector/.test(t)) return 'Cabos e Conectores'
  if (/módulo|modulo|painel/.test(t)) return 'Módulos Fotovoltaicos'
  return undefined
}

export function getProductImage(product) {
  const nome = (product.nome || '').toLowerCase()
  const fab  = (product.fabricante || '').toLowerCase()
  const pot  = product.potencia || 0
  // Muitos produtos (ex: disjuntores "MDWP-C10-2") só mencionam o tipo no
  // campo `tipo`, não no `nome` — usa os dois juntos nas buscas por palavra.
  const nomeTipo = nome + ' ' + (product.tipo || '').toLowerCase()

  // ── Módulos Fotovoltaicos — detecção por marca / tipo ────────────────────
  if (product.categoria === 'Módulos Fotovoltaicos') {
    const isBifacial = nome.includes('bifaci') || nome.includes('bifac') ||
                       nome.includes('dual') || nome.includes('glass')
    return isBifacial ? PANEL.bifacial : PANEL.mono
  }

  // ── Inversores WEG ───────────────────────────────────────────────────────
  if (nome.includes('siw100g') && nome.includes('m010')) return WEG.siw100g_m010
  if (nome.includes('siw100g') && nome.includes('m024')) return WEG.siw100g_m024
  if (nome.includes('siw100'))                            return WEG.siw100g_m010

  if (nome.includes('siw200h'))                           return WEG.siw200h
  if (nome.includes('siw400h'))                           return WEG.siw400h

  if (nome.includes('siw200'))                            return WEG.siw200g
  if (nome.includes('siw300'))                            return WEG.siw300h

  if (nome.includes('siw400')) {
    if (pot >= 75)  return WEG.siw400g_l
    if (pot >= 15)  return WEG.siw400g_m
    return WEG.siw400g_s
  }
  if (nome.includes('siw420'))                            return WEG.siw400g_m
  if (nome.includes('siw500'))                            return WEG.siw500h
  if (nome.includes('siw610') || nome.includes('siw600')) return WEG.siw610
  if (nome.includes('siw700') || nome.includes('siw750')) return WEG.siw610
  if (nome.includes('cfw500'))                            return WEG.cfw500

  // ── Baterias WEG — detecção por modelo ───────────────────────────────────
  if (nome.includes('sbw300') || nome.includes('sbw 300'))  return BAT.sbw300
  if (nome.includes('cb050')  || nome.includes('cb 050'))   return BAT.cb050
  if (nome.includes('cb100')  || nome.includes('cb 100'))   return BAT.cb100
  // SBW200 (geração nova, mesmo porte físico do CB050/CB100 — sem foto própria
  // ainda, usa a foto do porte equivalente como placeholder)
  if (nome.includes('sbw200')) {
    if (nome.includes('057')) return BAT.cb050
    if (nome.includes('115') || nome.includes('0115')) return BAT.cb100
    return BAT.cb100
  }
  // Fallback: qualquer bateria SBW sem modelo específico
  if (nome.includes('sbw') || nome.includes('bateria') || nome.includes('battery'))
    return BAT.cb100

  // ── Estruturas — detecção por nome + tipo ────────────────────────────────
  const tipo = (product.tipo || '').toLowerCase()
  const all  = nome + ' ' + tipo  // search both fields

  if (all.includes('carport'))                                           return EST.carport
  if (all.includes('tracker') || all.includes('rastreador'))             return EST.tracker

  // Telhado: nome contém tipo de telhado (cerâmico, trapezoidal, metálico,
  // fibrocimento) OU tipo menciona "telhado"
  if (all.includes('cerâmico')   || all.includes('ceramico')   ||
      all.includes('trapezoidal') || all.includes('fibrocimento') ||
      all.includes('telhado')     || all.includes('rooftop')    ||
      (nome.includes('telha') && !nome.includes('metálico')))             return EST.telhado

  // Metálico pode ser telhado metálico ou estrutura metálica genérica
  if (all.includes('metálico') || all.includes('metalico'))              return EST.telhado

  if (all.includes('laje') || all.includes('flat'))                      return EST.laje
  if (all.includes('solo') || all.includes('ground'))                    return EST.solo

  // ── Componentes avulsos ───────────────────────────────────────────────────
  if (nome.includes('perfil') || nome.includes('trilho') || nome.includes('rail'))
    return EST.perfil
  if (nome.includes('grampo') || nome.includes('clamp') ||
      nome.includes('fixação') || nome.includes('fixacao'))              return EST.fixacao
  if (nome.includes('suporte') || nome.includes('bracket') ||
      nome.includes('gancho'))                                           return EST.suporte

  // Fallback para categoria — estruturas sem keyword usam telhado (mais comum)
  if (product.categoria === 'Estruturas Metálicas')                      return EST.telhado
  if (product.categoria === 'Estruturas – Componentes Avulsos')          return EST.suporte

  // ── Cabos, conectores e proteção elétrica ──────────────────────────────────
  if (nome.includes('conector') || nome.includes('mc4'))                 return CABO.conector
  // Produtos reais de cabo no catálogo costumam vir nomeados "Unipolar
  // flexível NH 6mm² Vermelho/Preto" — sem a palavra "cabo" — então também
  // entra aqui por categoria.
  if (nome.includes('cabo') || product.categoria === 'Cabos e Conectores') {
    if (nome.includes('vermelho') || nome.includes('positivo') || nome.includes('(+)'))
      return CABO.vermelho
    if (nome.includes('preto') || nome.includes('negativo') || nome.includes('(-)') || nome.includes('(–)'))
      return CABO.preto
    return CABO.preto
  }
  if (nomeTipo.includes('disjuntor'))                                     return PROT.disjuntor
  if (nomeTipo.includes('protetor de surto') || nomeTipo.includes('dps') || nomeTipo.includes('surto'))
    return PROT.dps

  return CATEGORY_IMG[product.categoria] || null
}
