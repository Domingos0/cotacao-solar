// ─── Notification Service ─────────────────────────────────────────────────────
// WhatsApp: CallMeBot (gratuito, requer ativação pelo destinatário)
// Email: EmailJS (gratuito, 200 emails/mês, client-side)

const STORAGE_KEY = 'ernaniff_notify_v1'

export function getNotifySettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}
export function saveNotifySettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
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
  const s = getNotifySettings()
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
      const s2 = getNotifySettings()
      if (s2.emailServiceId && s2.emailTemplateId && s2.emailPublicKey)
        tasks.push(sendEmail({ serviceId: s2.emailServiceId, templateId: s2.emailTemplateId, publicKey: s2.emailPublicKey, toEmail: clientEmail, subject: clientMsg.split('\n')[0].replace(/[*_]/g, ''), message: clientMsg }))
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

// 2. Cliente solicitou desconto → notifica admin
export async function notifyDescontoSolicitado({ clienteNome, kitNome, totalFinal, motivo }) {
  const msg = `💰 *Solicitação de desconto — Ernaniff*\n\nCliente: ${clienteNome}\nKit: ${kitNome}\nValor: ${fmt(totalFinal)}\n\nMotivo: ${motivo}\n\nAcesse o painel para responder.`
  await dispatchNotifications(msg, null, null, null, null)
}

// 3. Admin aprovou cadastro → notifica cliente
export async function notifyClienteApproved({ clienteNome, clienteEmail, clientePhone, clienteWaKey }) {
  const msg = `✅ *Cadastro aprovado — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSeu cadastro foi aprovado. Acesse agora o sistema e monte seu kit solar! 🌞`
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

