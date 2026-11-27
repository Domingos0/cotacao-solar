// Feedback do usuário (sugestão/problema) e avaliação 1-5 pós-salvar
// cotação (item 28) — escrita na tabela public.feedbacks (ver migração
// supabase/migrations/20261126120000_feedbacks.sql).
import { supabase } from './supabase'

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ratingStorageKey(userId) {
  return `ernaniff_rating_prompt_${userId || 'anon'}`
}

// "No máximo uma vez por mês" — guardado em localStorage (mesmo padrão do
// tour/onboarding), não vale a pena uma consulta ao banco só pra isso.
export function canShowRatingPrompt(userId) {
  try {
    return localStorage.getItem(ratingStorageKey(userId)) !== monthKey()
  } catch {
    return true
  }
}

export function markRatingPromptShown(userId) {
  try { localStorage.setItem(ratingStorageKey(userId), monthKey()) } catch {
    // localStorage indisponível — pior caso, o prompt aparece de novo antes da hora
  }
}

export async function submitFeedback({ userId, tipo, mensagem, pagina, screenshot, nota }) {
  const { error } = await supabase.from('feedbacks').insert({
    user_id: userId,
    tipo,
    mensagem: mensagem || null,
    pagina: pagina || null,
    screenshot: screenshot || null,
    nota: nota ?? null,
  })
  return { error }
}

// feedbacks.user_id aponta pra auth.users (não pra public.profiles), então
// o join "profiles:user_id(...)" do PostgREST falha ("Could not find a
// relationship between 'feedbacks' and 'user_id'"). Busca os perfis à parte
// e junta aqui — mesmo formato de antes (row.profiles = { nome, ... }).
export async function listFeedbacks() {
  const { data, error } = await supabase
    .from('feedbacks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { data: [], error }
  const rows = data || []
  const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  if (!ids.length) return { data: rows, error: null }
  const { data: perfis } = await supabase
    .from('profiles')
    .select('id, nome, empresa, numero_usuario')
    .in('id', ids)
  const porId = Object.fromEntries((perfis || []).map(p => [p.id, p]))
  return { data: rows.map(r => ({ ...r, profiles: porId[r.user_id] || null })), error: null }
}

export async function resolveFeedback(id, respostaAdmin) {
  const { error } = await supabase
    .from('feedbacks')
    .update({ status: 'resolvido', resposta_admin: respostaAdmin || null, resolved_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}
