// ─── Notification Service ─────────────────────────────────────────────────────
// O envio de verdade (WhatsApp via CallMeBot / Email via EmailJS) acontece na
// Supabase Edge Function `send-notification`, que lê os segredos do admin com
// a service_role key — isso nunca fica disponível no navegador. Aqui só
// guardamos o cache local das configs (pra exibir no formulário do admin) e
// disparamos os eventos.

import { supabase } from './supabase'

const STORAGE_KEY = 'ernaniff_notify_v1'
const REMOTE_KEY  = 'notify_settings'
const IS_DEV = import.meta.env.DEV

export function getNotifySettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}
export function saveNotifySettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  if (!IS_DEV) {
    supabase.from('app_settings')
      .upsert({ key: REMOTE_KEY, value: s, updated_at: new Date().toISOString() })
      .then(() => {}, e => console.warn('[notify] settings sync error:', e?.message))
  }
}

// Lê a config compartilhada (Supabase). RLS só deixa admin ler a linha
// 'notify_settings' — para qualquer outro usuário isso retorna vazio.
export async function getRemoteNotifySettings() {
  if (IS_DEV) return {}
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', REMOTE_KEY).maybeSingle()
    return data?.value || {}
  } catch { return {} }
}

// ─── Envio direto (só para o admin testar as próprias configs no painel) ─────
// Aqui é seguro chamar CallMeBot/EmailJS direto do navegador porque os valores
// (apikey/telefone/chaves) já estão visíveis no formulário do próprio admin —
// não há segredo de outra pessoa envolvido. Para notificar OUTROS usuários,
// use os eventos `notifyXxx` abaixo, que passam pela Edge Function.
export async function sendWhatsApp(phone, apikey, message) {
  if (!phone || !apikey || !message) return false
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`
  try {
    await fetch(url, { mode: 'no-cors' })
    return true
  } catch { return false }
}

export async function sendEmail({ serviceId, templateId, publicKey, toEmail, subject, message }) {
  if (!serviceId || !templateId || !publicKey || !toEmail) return false
  try {
    const emailjs = (await import('@emailjs/browser')).default
    const r = await emailjs.send(serviceId, templateId, { to_email: toEmail, subject, message }, { publicKey })
    return r.status === 200
  } catch (e) {
    console.warn('[notify] email error:', e.message)
    return false
  }
}

// ─── Disparo (via Edge Function) ──────────────────────────────────────────────
async function sendEvent(event, payload) {
  if (IS_DEV) return
  try {
    const { error } = await supabase.functions.invoke('send-notification', { body: { event, payload } })
    if (error) console.warn('[notify] send-notification error:', error.message)
  } catch (e) {
    console.warn('[notify] send-notification error:', e?.message)
  }
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

// 1. Cliente se cadastrou (pendente) → notifica admin
export async function notifyClienteRegistered({ userId }) {
  await sendEvent('clienteRegistered', { userId })
}

// 2. Cliente solicitou desconto → notifica admin e confirma recebimento ao cliente
export async function notifyDescontoSolicitado({ quoteId }) {
  await sendEvent('descontoSolicitado', { quoteId })
}

// 3. Admin autorizou cadastro → notifica cliente
export async function notifyClienteApproved({ userId }) {
  await sendEvent('clienteApproved', { userId })
}

// 4. Admin respondeu ao desconto (aprovado) → notifica cliente com proposta revisada
export async function notifyDescontoAprovado({ quoteId }) {
  await sendEvent('descontoAprovado', { quoteId })
}

// 5. Admin recusou desconto → notifica cliente
export async function notifyDescontoRecusado({ quoteId }) {
  await sendEvent('descontoRecusado', { quoteId })
}

// 6. Status do kit fechado avançou (implantado/faturado/em_transporte) → notifica cliente
export async function notifyKitStatusChanged({ quoteId, status }) {
  await sendEvent('kitStatusChanged', { quoteId, status })
}

// 7. Admin travou o preço antigo numa cotação vencida → notifica cliente
export async function notifyPrecoTravado({ quoteId }) {
  await sendEvent('precoTravado', { quoteId })
}
