// ─── sync-crm ───────────────────────────────────────────────────────────────
// Chamada pelo trigger public.notify_crm_sync() (via pg_net) sempre que o
// status de uma cotação muda. Relê a cotação com a service_role key — nunca
// confia em nada vindo de fora — e envia pro CRM (projeto Supabase diferente)
// via um segredo compartilhado, igual ao padrão usado pelo CRM em suas
// próprias rotas internas (cron-auth / api_tokens).

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const CRM_INTEGRATION_URL = Deno.env.get("CRM_INTEGRATION_URL")!
const CRM_INTEGRATION_SECRET = Deno.env.get("COTACAO_SOLAR_INTEGRATION_SECRET")!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

// Statuses que fazem sentido mandar pro CRM — rascunho fica de fora (o
// trigger já filtra isso, mas reforça aqui caso a function seja chamada
// diretamente por engano).
const SYNCABLE_STATUS = new Set([
  "enviada", "aguardando_desconto", "aprovada", "recusada",
  "fechado", "faturado", "em_transporte", "implantado", "perdida",
])

Deno.serve(async (req) => {
  try {
    const { quote_id } = await req.json()
    if (!quote_id) return json({ error: "quote_id obrigatório" }, 400)

    const { data: q, error: qErr } = await admin
      .from("quotes")
      .select("id, user_id, nome_projeto, status, total_final, valid_until, motivo_perda, data")
      .eq("id", quote_id)
      .maybeSingle()
    if (qErr || !q) return json({ error: "cotação não encontrada" }, 404)
    if (!SYNCABLE_STATUS.has(q.status)) return json({ ok: true, skipped: true })

    const { data: profile } = await admin
      .from("profiles")
      .select("nome, empresa, cnpj, telefone, email")
      .eq("id", q.user_id)
      .maybeSingle()
    if (!profile?.cnpj) {
      // sem CNPJ não dá pra vincular a uma Empresa no CRM — não bloqueia o
      // save da cotação, só não sincroniza
      return json({ ok: true, skipped: true, reason: "cliente sem CNPJ" })
    }

    const { data: items } = await admin
      .from("quote_items")
      .select("label, produto, qty, preco_unit")
      .eq("quote_id", quote_id)

    const kitData = (q.data as Record<string, unknown> | null) || {}
    const numeroCotacao = (kitData.numero_orcamento as string) || null
    if (!numeroCotacao) return json({ ok: true, skipped: true, reason: "sem número de orçamento" })

    const kitNome = q.nome_projeto || `Kit ${quote_id}`

    const payload = {
      numero_cotacao: numeroCotacao,
      status: q.status,
      titulo: kitNome,
      cliente: {
        cnpj: profile.cnpj,
        nome: profile.nome,
        empresa: profile.empresa,
        telefone: profile.telefone,
        email: profile.email,
      },
      itens: (items || []).map(i => ({
        descricao: i.label || i.produto || "Item",
        quantidade: i.qty,
        valor_unitario: i.preco_unit,
      })),
      valor_total: q.total_final,
      validade: q.valid_until,
      motivo_perda: q.status === "perdida" ? q.motivo_perda : null,
    }

    const res = await fetch(CRM_INTEGRATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRM_INTEGRATION_SECRET}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.warn("[sync-crm] CRM respondeu com erro:", res.status, text)
      return json({ ok: false, crmStatus: res.status }, 502)
    }

    return json({ ok: true })
  } catch (e) {
    console.error("[sync-crm]", e)
    return json({ error: "erro interno" }, 500)
  }
})
