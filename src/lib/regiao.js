// Helpers de região/UF usados pelo Kit Builder e por Minhas Cotações
// (sugestão de frete, destaque/filtro de módulos CD Nordeste). Extraído de
// KitBuilder.jsx — primeiro passo do item 24 (separar arquivos grandes):
// são funções puras, sem estado nem JSX, fáceis de testar isoladamente.
// MinhasCotacoesPage.jsx tinha sua PRÓPRIA cópia de isNordestePanel
// (idêntica por enquanto, mas exatamente o tipo de duplicação que já
// divergiu silenciosamente em outros pontos corrigidos nesta sessão) —
// consolidada aqui também, pra não acontecer de novo no futuro.

export const UF_REGIAO = {
  AC: 'norte', AM: 'norte', AP: 'norte', PA: 'norte', RO: 'norte', RR: 'norte', TO: 'norte',
  AL: 'nordeste', BA: 'nordeste', CE: 'nordeste', MA: 'nordeste', PB: 'nordeste',
  PE: 'nordeste', PI: 'nordeste', RN: 'nordeste', SE: 'nordeste',
  DF: 'centro_oeste', GO: 'centro_oeste', MS: 'centro_oeste', MT: 'centro_oeste',
  ES: 'sudeste', MG: 'sudeste', RJ: 'sudeste', SP: 'sudeste',
  PR: 'sul', RS: 'sul', SC: 'sul',
}

// Extrai a sigla de UF de strings como "Manaus / AM", "São Paulo - SP", "PA"
export function detectUF(local) {
  if (!local) return null
  const m = local.trim().match(/\b([A-Za-z]{2})\s*$/)
  if (m) {
    const uf = m[1].toUpperCase()
    if (UF_REGIAO[uf]) return uf
  }
  return null
}

export function regiaoFromUF(uf) {
  return uf ? (UF_REGIAO[uf] || null) : null
}

// Detecta painel de CD Nordeste pelo nome
export function isNordestePanel(panel) {
  if (!panel?.nome) return false
  return /(nordeste|cd\s*ne\b)/i.test(panel.nome)
}

// Módulos CD Nordeste só podem ser entregues via frete Norte, Nordeste ou
// FOB no CD — extraído do Kit Builder (tinha essa regra, mas Minhas
// Cotações deixava escolher qualquer frete ao editar uma cotação com
// painel CD Nordeste, sem aplicar a mesma restrição).
export function fretePermitidoNordeste(frete) {
  return /(norte|nordeste|fob)/i.test(frete?.nome || '')
}
