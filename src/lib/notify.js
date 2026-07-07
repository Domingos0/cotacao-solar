// ─── Notification Service ─────────────────────────────────────────────────────
// WhatsApp: CallMeBot (gratuito, requer ativação pelo destinatário)
// Email: EmailJS (gratuito, 200 emails/mês, client-side)

import { supabaseAdmin } from './supabaseAdmin'

const STORAGE_KEY = 'ernaniff_notify_v1'
const REMOTE_KEY  = 'notify_settings'
const IS_DEV = import.meta.env.DEV

// As configs do admin (telefone/API key/email) precisam estar disponíveis também
// no navegador do CLIENTE, que é quem dispara os eventos de cadastro/desconto.
// localStorage é só o cache local do próprio dispositivo — a fonte compartilhada
// entre todos os navegadores é a tabela app_settings do Supabase.
export function getNotifySettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}
export function saveNotifySettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  if (!IS_DEV) {
    supabaseAdmin.from('app_settings')
      .upsert({ key: REMOTE_KEY, value: s, updated_at: new Date().toISOString() })
      .then(() => {}, e => console.warn('[notify] settings sync error:', e?.message))
  }
}

export async function getRemoteNotifySettings() {
  if (IS_DEV) return {}
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', REMOTE_KEY).maybeSingle()
    return data?.value || {}
  } catch { return {} }
}

// ─── WhatsApp via CallMeBot ───────────────────────────────────────────────────
export async function sendWhatsApp(phone, apikey, message) {
  if (!phone || !apikey || !message) return false
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`
  try {
    await fetch(url, { mode: 'no-cors' })
    return true
  } catch { return false }
}

// ─── Email via EmailJS ────────────────────────────────────────────────────────
export async function sendEmail({ serviceId, templateId, publicKey, toEmail, subject, message }) {
  if (!serviceId || !templateId || !publicKey || !toEmail) return false
  try {
    const emailjs = (await import('@emailjs/browser')).default
    const r = await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      subject,
      message,
    }, { publicKey })
    return r.status === 200
  } catch (e) {
    console.warn('[notify] email error:', e.message)
    return false
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function dispatchNotifications(adminMsg, clientMsg, clientEmail, clientPhone, clientWaKey) {
  const s = { ...getNotifySettings(), ...(await getRemoteNotifySettings()) }
  const tasks = []

  // Notificações para o ADMIN
  if (adminMsg) {
    if (s.adminPhone && s.adminWaKey)
      tasks.push(sendWhatsApp(s.adminPhone, s.adminWaKey, adminMsg))
    if (s.emailServiceId && s.emailTemplateId && s.emailPublicKey && s.adminEmail)
      tasks.push(sendEmail({ serviceId: s.emailServiceId, templateId: s.emailTemplateId, publicKey: s.emailPublicKey, toEmail: s.adminEmail, subject: adminMsg.split('\n')[0].replace(/[*_]/g, ''), message: adminMsg }))
  }

  // Notificações para o CLIENTE
  if (clientMsg) {
    if (clientPhone && clientWaKey)
      tasks.push(sendWhatsApp(clientPhone, clientWaKey, clientMsg))
    if (clientEmail) {
      if (s.emailServiceId && s.emailTemplateId && s.emailPublicKey)
        tasks.push(sendEmail({ serviceId: s.emailServiceId, templateId: s.emailTemplateId, publicKey: s.emailPublicKey, toEmail: clientEmail, subject: clientMsg.split('\n')[0].replace(/[*_]/g, ''), message: clientMsg }))
    }
  }

  await Promise.allSettled(tasks)
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

// 1. Cliente se cadastrou (pendente) → notifica admin
export async function notifyClienteRegistered({ nome, userEmail, empresa, telefone }) {
  const msg = `🆕 *Novo cadastro pendente — Ernaniff*\n\nNome: ${nome}${empresa ? `\nEmpresa: ${empresa}` : ''}\nEmail: ${userEmail}${telefone ? `\nTel: ${telefone}` : ''}\n\nAcesse o painel para aprovar.`
  await dispatchNotifications(msg, null, null, null, null)
}

// 2. Cliente solicitou desconto → notifica admin e confirma recebimento ao cliente
export async function notifyDescontoSolicitado({ clienteNome, revendedorNome, revendedorEmail, revendedorPhone, revendedorWaKey, kitNome, totalFinal, motivo }) {
  const adminMsg  = `💰 *Solicitação de desconto — Ernaniff*\n\nCliente: ${clienteNome}\nKit: ${kitNome}\nValor: ${fmt(totalFinal)}\n\nMotivo: ${motivo}\n\nAcesse o painel para responder.`
  const clientMsg = `✅ *Desconto enviado — Ernaniff*\n\nOlá, ${revendedorNome || clienteNome}!\n\nSua solicitação de desconto para o kit "${kitNome}" foi enviada com sucesso. O administrador irá analisar e responder em breve.`
  await dispatchNotifications(adminMsg, clientMsg, revendedorEmail, revendedorPhone, revendedorWaKey)
}

// 3. Admin autorizou cadastro → notifica cliente
export async function notifyClienteApproved({ clienteNome, clienteEmail, clientePhone, clienteWaKey }) {
  const msg = `✅ *Cadastro autorizado — Ernaniff*\n\nOlá, ${clienteNome}!\n\nVocê está autorizado! Agora você já pode seguir cotando seus kits solares no sistema. 🌞`
  await dispatchNotifications(null, msg, clienteEmail, clientePhone, clienteWaKey)
}

// 4. Admin respondeu ao desconto → notifica cliente com proposta revisada
export async function notifyDescontoAprovado({ clienteNome, clienteEmail, clientePhone, clienteWaKey, kitNome, descontoPct, totalOriginal, totalFinal, resposta }) {
  const msg = `🎉 *Proposta revisada — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua solicitação de desconto foi respondida.\n\nKit: ${kitNome}\nDesconto aprovado: ${descontoPct}%\nValor original: ${fmt(totalOriginal)}\nValor com desconto: ${fmt(totalFinal)}\n\nMensagem: ${resposta}\n\nAcesse o sistema para ver a proposta atualizada. 🌞`
  await dispatchNotifications(null, msg, clienteEmail, clientePhone, clienteWaKey)
}

// 5. Admin recusou desconto → notifica cliente
export async function notifyDescontoRecusado({ clienteNome, clienteEmail, clientePhone, clienteWaKey, kitNome, resposta }) {
  const msg = `📋 *Resposta sobre desconto — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua solicitação de desconto para o kit "${kitNome}" foi analisada.\n\nMensagem: ${resposta}\n\nQualquer dúvida, entre em contato.`
  await dispatchNotifications(null, msg, clienteEmail, clientePhone, clienteWaKey)
}

// 6. Status do kit fechado avançou (implantado/faturado/em transporte) → notifica cliente
const KIT_STATUS_TEXT = {
  implantado:    ({ ovNumero }) => `🔧 Seu pedido entrou em processo de implantação.${ovNumero ? `\nOV: ${ovNumero}` : ''}`,
  faturado:      ({ ovNumero, nfNumero }) => `🧾 Seu pedido foi faturado.${ovNumero ? `\nOV: ${ovNumero}` : ''}${nfNumero ? `\nNF: ${nfNumero}` : ''}`,
  em_transporte: ({ nfNumero }) => `🚛 Seu pedido foi despachado e está a caminho!${nfNumero ? `\nNF: ${nfNumero}` : ''}`,
}
export async function notifyKitStatusChanged({ clienteNome, clienteEmail, clientePhone, clienteWaKey, kitNome, status, ovNumero, nfNumero }) {
  const buildCorpo = KIT_STATUS_TEXT[status]
  if (!buildCorpo) return
  const msg = `📦 *Atualização do pedido — Ernaniff*\n\nOlá, ${clienteNome}!\n\nKit: ${kitNome}\n\n${buildCorpo({ ovNumero, nfNumero })}`
  await dispatchNotifications(null, msg, clienteEmail, clientePhone, clienteWaKey)
}

