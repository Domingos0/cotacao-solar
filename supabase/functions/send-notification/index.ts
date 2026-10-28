// ─── send-notification ─────────────────────────────────────────────────────
// Recebe { event, payload } do navegador (via supabase.functions.invoke) e
// dispara WhatsApp (CallMeBot) / Email (EmailJS) para admin e/ou cliente.
//
// Por que isso existe aqui e não no navegador: os segredos de notificação
// (API key do CallMeBot do admin, chaves do EmailJS) ficam só nesta function,
// lidos com a service_role key — nunca voltam para o navegador. E cada evento
// relê o estado atual do banco (com a service key) em vez de confiar no que o
// chamador mandou no payload, então não dá pra forjar uma mensagem de "pedido
// faturado" com número de NF falso, por exemplo — a function só repete o que
// já está gravado no banco por uma ação real de admin.

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

function fmt(v: number | null | undefined) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Client com a service_role key — só é usado dentro desta function, nunca sai daqui.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Client "como o usuário que chamou" — usa a mesma sessão (JWT) do navegador,
// então respeita RLS normalmente. É assim que confirmamos quem está chamando
// sem precisar confiar em nada que o payload declare sobre si mesmo.
function callerClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? ""
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
}

async function requireAdmin(req: Request): Promise<boolean> {
  const client = callerClient(req)
  const { data, error } = await client.rpc("is_admin")
  return !error && data === true
}

async function callerUserId(req: Request): Promise<string | null> {
  const client = callerClient(req)
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

// ─── Envio ──────────────────────────────────────────────────────────────────
async function sendWhatsApp(phone?: string | null, apikey?: string | null, message?: string | null) {
  if (!phone || !apikey || !message) return
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`
  try { await fetch(url) } catch (e) { console.warn("[send-notification] whatsapp error:", e) }
}

// WA-AKG: gateway self-hosted (Baileys). Diferente do CallMeBot, não precisa
// de API key por cliente — manda direto pro número informado. Normaliza o
// telefone pra dígitos (DDI+DDD+número) antes de montar o JID.
function onlyDigits(v: string) {
  return v.replace(/\D/g, "")
}
// Bug conhecido do Baileys com números BR: a API aceita e retorna "sucesso"
// mesmo mandando pro JID errado, só que a mensagem nunca chega de verdade.
// Testado manualmente: 5599988230393 (13 dígitos, COM o 9º dígito) não
// entregava; 559988230393 (12 dígitos, SEM) entregou. Então sempre remove
// esse 9º dígito extra de celulares BR (DDI 55 + DDD 2 dígitos + 9 + 8
// dígitos = 13 → vira 12) antes de montar o JID.
function normalizeBrPhoneForWhatsApp(digits: string) {
  if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") {
    return digits.slice(0, 4) + digits.slice(5) // remove o "9" na posição 5
  }
  return digits
}
// Bloqueia tentativas óbvias de SSRF (baseUrl apontando pra localhost/rede
// interna) — só deixa passar hostname público por HTTPS. Não substitui uma
// allowlist real, mas corta o caso comum de abuso dessa rota como pivô.
function isPublicHttpsHost(urlStr: string): boolean {
  let u: URL
  try { u = new URL(urlStr) } catch { return false }
  if (u.protocol !== "https:") return false
  const h = u.hostname.toLowerCase()
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return false
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
  return true
}
// Retorna o resultado (ok/status/corpo) em vez de só logar — usado tanto
// pelo dispatch() normal (fire-and-forget) quanto pelo handler de teste do
// painel (que precisa mostrar erro real pro admin).
async function sendWhatsAppWaAkgRaw(baseUrl: string, apiKey: string, sessionId: string, phone: string, message: string) {
  if (!isPublicHttpsHost(baseUrl)) return { ok: false, status: 0, body: "baseUrl inválida (precisa ser https:// pública)" }
  const rawDigits = onlyDigits(phone)
  if (!rawDigits) return { ok: false, status: 0, body: "telefone vazio" }
  // Telefones salvos no sistema às vezes vêm sem o 55 (DDI Brasil) — completa se faltar.
  const withDdi = rawDigits.length <= 11 ? `55${rawDigits}` : rawDigits
  const digits = normalizeBrPhoneForWhatsApp(withDdi)
  const jid = `${digits}@s.whatsapp.net`
  const url = `${baseUrl.replace(/\/+$/, "")}/api/messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/send`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: { text: message } }),
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body }
  } catch (e) {
    return { ok: false, status: 0, body: String(e) }
  }
}
async function sendWhatsAppWaAkg(baseUrl?: string, apiKey?: string, sessionId?: string, phone?: string | null, message?: string | null) {
  if (!baseUrl || !apiKey || !sessionId || !phone || !message) return
  const r = await sendWhatsAppWaAkgRaw(baseUrl, apiKey, sessionId, phone, message)
  if (!r.ok) console.warn("[send-notification] wa-akg error:", r.status, r.body)
}

async function sendEmail(opts: {
  serviceId?: string; templateId?: string; publicKey?: string; privateKey?: string
  toEmail?: string; subject?: string; message?: string
}) {
  const { serviceId, templateId, publicKey, privateKey, toEmail, subject, message } = opts
  if (!serviceId || !templateId || !publicKey || !toEmail) return
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        ...(privateKey ? { accessToken: privateKey } : {}),
        template_params: { to_email: toEmail, subject, message },
      }),
    })
    if (!res.ok) console.warn("[send-notification] email error:", res.status, await res.text())
  } catch (e) { console.warn("[send-notification] email error:", e) }
}

async function getNotifySettings() {
  const { data } = await admin.from("app_settings").select("value").eq("key", "notify_settings").maybeSingle()
  return (data?.value ?? {}) as Record<string, string>
}

async function dispatch(adminMsg: string | null, clientMsg: string | null, clientEmail?: string | null, clientPhone?: string | null, clientWaKey?: string | null) {
  const s = await getNotifySettings()
  const tasks: Promise<void>[] = []
  const useWaAkg = s.waProvider === "wa_akg" && s.waAkgBaseUrl && s.waAkgApiKey && s.waAkgSessionId

  if (adminMsg) {
    if (useWaAkg && s.adminPhone) {
      tasks.push(sendWhatsAppWaAkg(s.waAkgBaseUrl, s.waAkgApiKey, s.waAkgSessionId, s.adminPhone, adminMsg))
    } else if (s.adminPhone && s.adminWaKey) {
      tasks.push(sendWhatsApp(s.adminPhone, s.adminWaKey, adminMsg))
    }
    if (s.emailServiceId && s.emailTemplateId && s.emailPublicKey && s.adminEmail) {
      tasks.push(sendEmail({
        serviceId: s.emailServiceId, templateId: s.emailTemplateId, publicKey: s.emailPublicKey, privateKey: s.emailPrivateKey,
        toEmail: s.adminEmail, subject: adminMsg.split("\n")[0].replace(/[*_]/g, ""), message: adminMsg,
      }))
    }
  }

  if (clientMsg) {
    // WA-AKG não precisa da apikey pessoal do cliente (clientWaKey) — manda
    // direto pro telefone cadastrado no perfil, bastando o gateway estar ativo.
    if (useWaAkg && clientPhone) {
      tasks.push(sendWhatsAppWaAkg(s.waAkgBaseUrl, s.waAkgApiKey, s.waAkgSessionId, clientPhone, clientMsg))
    } else if (clientPhone && clientWaKey) {
      tasks.push(sendWhatsApp(clientPhone, clientWaKey, clientMsg))
    }
    if (clientEmail && s.emailServiceId && s.emailTemplateId && s.emailPublicKey) {
      tasks.push(sendEmail({
        serviceId: s.emailServiceId, templateId: s.emailTemplateId, publicKey: s.emailPublicKey, privateKey: s.emailPrivateKey,
        toEmail: clientEmail, subject: clientMsg.split("\n")[0].replace(/[*_]/g, ""), message: clientMsg,
      }))
    }
  }

  await Promise.allSettled(tasks)
}

// ─── Eventos ────────────────────────────────────────────────────────────────
// Cada handler relê o estado real do banco (via `admin`) a partir só de um id
// do payload — nunca confia em texto/números soltos que o chamador mandou.

async function handleClienteRegistered(payload: { userId?: string }) {
  if (!payload.userId) return json({ error: "userId obrigatório" }, 400)
  const { data: p } = await admin.from("profiles").select("nome, empresa, telefone, email")
    .eq("id", payload.userId).eq("status", "pendente").maybeSingle()
  if (!p) return json({ ok: true }) // nada a notificar (id inválido ou já não está pendente)

  const msg = `🆕 *Novo cadastro pendente — Ernaniff*\n\nNome: ${p.nome}${p.empresa ? `\nEmpresa: ${p.empresa}` : ""}\nEmail: ${p.email}${p.telefone ? `\nTel: ${p.telefone}` : ""}\n\nAcesse o painel para aprovar.`
  await dispatch(msg, null)
  return json({ ok: true })
}

async function handleDescontoSolicitado(req: Request, payload: { quoteId?: string }) {
  if (!payload.quoteId) return json({ error: "quoteId obrigatório" }, 400)
  const userId = await callerUserId(req)
  if (!userId) return json({ error: "não autenticado" }, 401)

  const { data: q } = await admin.from("quotes")
    .select("user_id, status, desconto_motivo, total_final, nome_projeto, kwp")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q || q.user_id !== userId || q.status !== "aguardando_desconto") {
    return json({ error: "cotação inválida" }, 403)
  }

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", userId).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"

  const adminMsg = `💰 *Solicitação de desconto — Ernaniff*\n\nCliente: ${clienteNome}\nKit: ${kitNome}\nValor: ${fmt(q.total_final)}\n\nMotivo: ${q.desconto_motivo || ""}\n\nAcesse o painel para responder.`
  const clientMsg = `✅ *Desconto enviado — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua solicitação de desconto para o kit "${kitNome}" foi enviada com sucesso. O administrador irá analisar e responder em breve.`
  await dispatch(adminMsg, clientMsg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

async function handleClienteApproved(req: Request, payload: { userId?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  if (!payload.userId) return json({ error: "userId obrigatório" }, 400)

  const { data: p } = await admin.from("profiles").select("nome, telefone, email, status").eq("id", payload.userId).maybeSingle()
  if (!p || p.status !== "ativo") return json({ error: "perfil inválido" }, 400)
  const { data: authUser } = await admin.auth.admin.getUserById(payload.userId)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""

  const msg = `✅ *Cadastro autorizado — Ernaniff*\n\nOlá, ${p.nome}!\n\nVocê está autorizado! Agora você já pode seguir cotando seus kits solares no sistema. 🌞`
  await dispatch(null, msg, p.email, p.telefone, waKey)
  return json({ ok: true })
}

async function handleDescontoAprovado(req: Request, payload: { quoteId?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  if (!payload.quoteId) return json({ error: "quoteId obrigatório" }, 400)

  const { data: q } = await admin.from("quotes")
    .select("user_id, status, desconto_pct, desconto_resposta, total_final, nome_projeto, kwp, data")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q || q.status !== "aprovada") return json({ error: "cotação inválida" }, 400)

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", q.user_id).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(q.user_id)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"
  const totalOriginal = (q.data as Record<string, unknown> | null)?.total_antes_desconto as number | undefined

  const msg = `🎉 *Proposta revisada — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua solicitação de desconto foi respondida.\n\nKit: ${kitNome}\nDesconto aprovado: ${q.desconto_pct}%\nValor original: ${fmt(totalOriginal)}\nValor com desconto: ${fmt(q.total_final)}\n\nMensagem: ${q.desconto_resposta || ""}\n\nAcesse o sistema para ver a proposta atualizada. 🌞`
  const adminMsg = `✅ *Desconto aprovado — Ernaniff*\n\nCliente: ${clienteNome}\nKit: ${kitNome}\nDesconto: ${q.desconto_pct}%\nValor final: ${fmt(q.total_final)}`
  await dispatch(adminMsg, msg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

async function handleDescontoRecusado(req: Request, payload: { quoteId?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  if (!payload.quoteId) return json({ error: "quoteId obrigatório" }, 400)

  const { data: q } = await admin.from("quotes")
    .select("user_id, desconto_resposta, nome_projeto, kwp")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q) return json({ error: "cotação inválida" }, 400)

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", q.user_id).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(q.user_id)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"

  const msg = `📋 *Resposta sobre desconto — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua solicitação de desconto para o kit "${kitNome}" foi analisada.\n\nMensagem: ${q.desconto_resposta || ""}\n\nQualquer dúvida, entre em contato.`
  const adminMsg = `❌ *Desconto recusado — Ernaniff*\n\nCliente: ${clienteNome}\nKit: ${kitNome}\nMotivo: ${q.desconto_resposta || "—"}`
  await dispatch(adminMsg, msg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

async function handlePrecoTravado(req: Request, payload: { quoteId?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  if (!payload.quoteId) return json({ error: "quoteId obrigatório" }, 400)

  const { data: q } = await admin.from("quotes")
    .select("user_id, nome_projeto, kwp, total_final, valid_until")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q) return json({ error: "cotação inválida" }, 400)

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", q.user_id).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(q.user_id)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"

  const msg = `🔒 *Preço antigo mantido — Ernaniff*\n\nOlá, ${clienteNome}!\n\nMesmo com a cotação do kit "${kitNome}" vencida, decidimos manter o valor original: ${fmt(q.total_final)}.\n\nFale com a gente para fechar! 🌞`
  await dispatch(null, msg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

// Disparado pelo job agendado (pg_cron), sem sessão de usuário — por isso
// não passa por requireAdmin (não existe um "chamador" aqui, só o próprio banco).
async function handleCotacaoVencida(payload: { quoteId?: string }) {
  if (!payload.quoteId) return json({ error: "quoteId obrigatório" }, 400)

  const { data: q } = await admin.from("quotes")
    .select("user_id, status, nome_projeto, kwp, total_final, valid_until, price_locked")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q || q.price_locked) return json({ ok: true }) // já travada, nada a avisar

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", q.user_id).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(q.user_id)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"
  const dataVenc = q.valid_until ? new Date(q.valid_until as string).toLocaleDateString("pt-BR") : ""

  const msg = `⏰ *Cotação vencida — Ernaniff*\n\nOlá, ${clienteNome}!\n\nSua cotação do kit "${kitNome}" venceu em ${dataVenc}.\n\nOs preços podem ter mudado — reabra a cotação no sistema pra ver o valor atualizado, ou fale com a gente se quiser manter o valor anterior.`
  await dispatch(null, msg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

const KIT_STATUS_TEXT: Record<string, (d: { ovNumero?: string; nfNumero?: string }) => string> = {
  implantado: ({ ovNumero }) => `🔧 Seu pedido entrou em processo de implantação.${ovNumero ? `\nOV: ${ovNumero}` : ""}`,
  faturado: ({ ovNumero, nfNumero }) => `🧾 Seu pedido foi faturado.${ovNumero ? `\nOV: ${ovNumero}` : ""}${nfNumero ? `\nNF: ${nfNumero}` : ""}`,
  em_transporte: ({ nfNumero }) => `🚛 Seu pedido foi despachado e está a caminho!${nfNumero ? `\nNF: ${nfNumero}` : ""}`,
}

async function handleKitStatusChanged(req: Request, payload: { quoteId?: string; status?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  if (!payload.quoteId || !payload.status || !KIT_STATUS_TEXT[payload.status]) {
    return json({ error: "quoteId/status inválidos" }, 400)
  }

  const { data: q } = await admin.from("quotes")
    .select("user_id, status, nome_projeto, kwp, data")
    .eq("id", payload.quoteId).maybeSingle()
  if (!q || q.status !== payload.status) return json({ error: "cotação inválida" }, 400)

  const { data: profile } = await admin.from("profiles").select("nome, telefone, email").eq("id", q.user_id).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(q.user_id)
  const waKey = authUser?.user?.user_metadata?.whatsapp_apikey || ""
  const kitNome = q.nome_projeto || `Kit ${Number(q.kwp || 0).toFixed(2)} kWp`
  const clienteNome = profile?.nome || "Cliente"
  const d = (q.data as Record<string, unknown> | null) || {}
  const corpo = KIT_STATUS_TEXT[payload.status]({ ovNumero: d.ov_numero as string, nfNumero: d.nf_numero as string })

  const msg = `📦 *Atualização do pedido — Ernaniff*\n\nOlá, ${clienteNome}!\n\nKit: ${kitNome}\n\n${corpo}`
  await dispatch(null, msg, profile?.email, profile?.telefone, waKey)
  return json({ ok: true })
}

// Testa a config do WA-AKG direto do servidor (evita CORS, já que o gateway
// não manda os headers de Access-Control-Allow-Origin pra chamadas de browser).
// Exige admin autenticado + bloqueia IPs internos/privados como baseUrl —
// reduz o risco de um admin comprometido usar essa rota como pivô (SSRF)
// pra fazer a infraestrutura do Supabase acessar endereços internos.
async function handleTestWaAkg(req: Request, payload: { baseUrl?: string; apiKey?: string; sessionId?: string; phone?: string }) {
  if (!(await requireAdmin(req))) return json({ error: "somente admin" }, 403)
  const { baseUrl, apiKey, sessionId, phone } = payload
  if (!baseUrl || !apiKey || !sessionId || !phone) return json({ error: "dados incompletos" }, 400)
  if (!isPublicHttpsHost(baseUrl)) return json({ error: "URL do gateway precisa ser https:// pública (não local/interna)" }, 400)
  const r = await sendWhatsAppWaAkgRaw(baseUrl, apiKey, sessionId, phone, "✅ Teste — Ernaniff Solar (WA-AKG). Notificações funcionando!")
  if (!r.ok) return json({ error: `Gateway respondeu ${r.status}: ${r.body}` }, 502)
  return json({ ok: true })
}

// ─── Roteador ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  try {
    const { event, payload } = await req.json()
    switch (event) {
      case "clienteRegistered": return await handleClienteRegistered(payload || {})
      case "descontoSolicitado": return await handleDescontoSolicitado(req, payload || {})
      case "clienteApproved": return await handleClienteApproved(req, payload || {})
      case "descontoAprovado": return await handleDescontoAprovado(req, payload || {})
      case "descontoRecusado": return await handleDescontoRecusado(req, payload || {})
      case "kitStatusChanged": return await handleKitStatusChanged(req, payload || {})
      case "precoTravado": return await handlePrecoTravado(req, payload || {})
      case "cotacaoVencida": return await handleCotacaoVencida(payload || {})
      case "testWaAkg": return await handleTestWaAkg(req, payload || {})
      default: return json({ error: "evento desconhecido" }, 400)
    }
  } catch (e) {
    console.error("[send-notification]", e)
    return json({ error: "erro interno" }, 500)
  }
})
