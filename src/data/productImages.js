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
  'Cabos e Conectores':                 IMG.cable,
  'Proteção e Acessórios':              IMG.protection,
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

export function getProductImage(product) {
  const nome = (product.nome || '').toLowerCase()
  const fab  = (product.fabricante || '').toLowerCase()
  const pot  = product.potencia || 0

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

  return CATEGORY_IMG[product.categoria] || null
}
