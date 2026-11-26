// Tours guiados e progresso de "Primeiros passos" — tudo em localStorage,
// por usuário (chave inclui o user id), pra não misturar progresso entre
// contas diferentes que usam o mesmo navegador/computador compartilhado.

function storageKey(userId) {
  return `ernaniff_onboarding_${userId || 'anon'}`
}

function readState(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeState(userId, state) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // localStorage indisponível (modo privado, quota cheia etc.) — o tour
    // simplesmente reaparece na próxima visita, sem quebrar a navegação.
  }
}

export function isTourSeen(userId, tourId) {
  return !!readState(userId).tours?.[tourId]
}

export function markTourSeen(userId, tourId) {
  const state = readState(userId)
  writeState(userId, { ...state, tours: { ...state.tours, [tourId]: true } })
}

// Checklist "Primeiros passos": montar kit → salvar cotação → pedir desconto
export const ONBOARDING_STEPS = [
  { key: 'kit_montado',     label: 'Montar um kit solar' },
  { key: 'cotacao_salva',   label: 'Salvar a cotação' },
  { key: 'desconto_pedido', label: 'Pedir um desconto' },
]

export function getOnboarding(userId) {
  return readState(userId).onboarding || {}
}

export function markOnboardingStep(userId, step) {
  const state = readState(userId)
  if (state.onboarding?.[step]) return // já marcado, evita escrita à toa
  writeState(userId, { ...state, onboarding: { ...state.onboarding, [step]: true } })
}

export function isOnboardingComplete(userId) {
  const onboarding = getOnboarding(userId)
  return ONBOARDING_STEPS.every(s => onboarding[s.key])
}

export function isOnboardingDismissed(userId) {
  return !!readState(userId).onboardingDismissed
}

export function dismissOnboarding(userId) {
  const state = readState(userId)
  writeState(userId, { ...state, onboardingDismissed: true })
}

// Definição dos passos de cada tour — cada step aponta um elemento da tela
// via atributo data-tour="...". Se o alvo não existir no momento (ex:
// usuário já navegou pra outro lugar), o motor do tour (GuidedTour) pula
// esse step sozinho, em vez de travar.
export const TOURS = {
  catalog: [
    { target: '[data-tour="nav-kit"]', title: 'Monte seu Kit', body: 'Comece por aqui pra montar um kit solar completo — módulos, inversor, baterias e acessórios, passo a passo.' },
    { target: '[data-tour="search"]', title: 'Busca rápida', body: 'Busque por nome, código SAP ou modelo. Funciona mesmo digitando com acento a menos ou espaço a mais.' },
    { target: '[data-tour="filter-sidebar"]', title: 'Filtrar por categoria', body: 'Veja só módulos, inversores, baterias etc. clicando numa categoria aqui.' },
    { target: '[data-tour="nav-cotacoes"]', title: 'Minhas Cotações', body: 'Suas cotações salvas ficam aqui — reveja, edite ou peça desconto a qualquer momento.' },
    { target: '[data-tour="help-button"]', title: 'Precisa rever isso?', body: 'Clique aqui a qualquer momento pra repetir o tour desta tela.' },
  ],
  admin: [
    { target: '[data-tour="nav-admin"]', title: 'Painel do Admin', body: 'Aqui você gerencia o catálogo, cotações de clientes, pedidos de desconto e cadastros pendentes de aprovação.' },
  ],
}

// Tutorial completo do Monte seu Kit (item 46): em vez de um tour genérico
// fixo, cada etapa da wizard dispara o PRÓPRIO tour na primeira vez que o
// usuário chega nela (ver KitBuilder.jsx), e pode ser revisto a qualquer
// momento pelo botão "?" do cabeçalho — sempre mostrando o tour da etapa
// em que o usuário está no momento, não um tour fixo. A etapa de Resumo
// tem vários alvos (é onde vivem a maioria dos recursos extras: forma de
// pagamento, datasheet, salvar, desconto...); as demais etapas usam um
// único alvo (o card da etapa atual, data-tour="kit-step-content"), porque
// o conteúdo interno muda de estrutura conforme o tipo de kit escolhido —
// tentar apontar pra um campo específico de cada variação seria frágil.
export const KIT_STEP_TOURS = {
  kit_tipo: [
    { target: '[data-tour="kit-step-content"]', title: 'Tipo de Kit', body: 'Escolha On-Grid Monofásico, Trifásico, Microinversor ou Bombeamento Solar — isso filtra os inversores compatíveis nos próximos passos.' },
  ],
  kit_dimensionamento: [
    { target: '[data-tour="kit-step-content"]', title: 'Dimensionamento', body: 'Informe a potência (kWp) desejada ou o consumo mensal do cliente. Os dados de cidade/UF também entram aqui e definem a modalidade de frete disponível depois, no Resumo.' },
  ],
  kit_dimensionamento_bomb: [
    { target: '[data-tour="kit-step-content"]', title: 'Dimensionamento da Bomba', body: 'Informe vazão, altura manométrica e demais dados da bomba — o sistema sugere o inversor de frequência compatível no próximo passo.' },
  ],
  kit_modulos: [
    { target: '[data-tour="kit-step-content"]', title: 'Módulos', body: 'Escolha o modelo de painel solar. Produtos esgotados ou com previsão de chegada aparecem sinalizados, e módulos CD Nordeste são priorizados pra clientes dessa região.' },
  ],
  kit_inversor: [
    { target: '[data-tour="kit-step-content"]', title: 'Inversor', body: 'Veja a compatibilidade de cada inversor com a potência escolhida (% de sobredimensionamento). Em sistemas maiores dá pra montar um mix de mais de um inversor.' },
  ],
  kit_baterias: [
    { target: '[data-tour="kit-step-content"]', title: 'Baterias', body: 'Pra inversores híbridos, configure aqui o banco de baterias SBW — capacidade, autonomia e modo de operação (backup, off-grid etc.).' },
  ],
  kit_acessorios: [
    { target: '[data-tour="kit-step-content"]', title: 'Acessórios', body: 'Cabos, disjuntores, protetores de surto e estrutura de fixação são sugeridos automaticamente a partir do inversor e da quantidade de painéis — revise e ajuste se precisar.' },
  ],
  kit_resumo: [
    { target: '[data-tour="kit-steps"]', title: 'Resumo — fechando o orçamento', body: 'Aqui reúne tudo: itens, valores, forma de pagamento e as ações pra enviar a cotação ao cliente.' },
    { target: '[data-tour="kit-resumo-pagamento"]', title: 'Formas de pagamento', body: 'Mostra o valor à vista e simula o parcelamento no cartão (1x a 12x), já com as taxas aplicadas. Some sozinho da versão impressa.' },
    { target: '[data-tour="kit-resumo-datasheet"]', title: 'Datasheet do produto', body: 'Quando cadastrado no Admin (Produtos > Datasheets por linha), cada item do kit ganha um link direto pro datasheet (ficha técnica) do inversor em PDF.' },
    { target: '[data-tour="kit-save"]', title: 'Salvar cotação', body: 'Salva (ou atualiza, se já for uma cotação existente) — ela fica disponível em "Minhas Cotações" pra reabrir, duplicar, enviar por WhatsApp ou comparar revisões depois.' },
    { target: '[data-tour="kit-resumo-desconto"]', title: 'Solicitar desconto', body: 'Depois de salvar, dá pra pedir um desconto ao administrador direto por aqui, com justificativa — ele responde pela mesma tela.' },
  ],
}

// A quantidade e o significado dos passos da wizard mudam conforme o tipo
// de kit (bombeamento pula etapas) e se o inversor escolhido é híbrido
// (entra a etapa extra de Baterias) — por isso o id do tour de cada
// posição numérica do `step` não é fixo, precisa ser calculado.
export function getKitTourId(step, data, isHybrid) {
  if (step === 1) return 'kit_tipo'
  if (step === 2) return data?.kitType === 'bombeamento' ? 'kit_dimensionamento_bomb' : 'kit_dimensionamento'
  if (step === 3) return 'kit_modulos'
  if (step === 4) return 'kit_inversor'
  if (isHybrid && step === 5) return 'kit_baterias'
  const accStep = isHybrid ? 6 : 5
  const resumoStep = isHybrid ? 7 : 6
  if (step === accStep) return 'kit_acessorios'
  if (step === resumoStep) return 'kit_resumo'
  return null
}
