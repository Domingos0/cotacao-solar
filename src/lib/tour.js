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
  kit: [
    { target: '[data-tour="kit-steps"]', title: 'Passo a passo', body: 'O kit é montado em etapas — módulo, inversor, baterias e acessórios. Dá pra voltar e ajustar qualquer uma delas depois.' },
    { target: '[data-tour="kit-save"]', title: 'Salvar cotação', body: 'Quando terminar, salve a cotação aqui. Ela aparece em "Minhas Cotações" pra você continuar depois ou pedir desconto.' },
  ],
  admin: [
    { target: '[data-tour="nav-admin"]', title: 'Painel do Admin', body: 'Aqui você gerencia o catálogo, cotações de clientes, pedidos de desconto e cadastros pendentes de aprovação.' },
  ],
}
