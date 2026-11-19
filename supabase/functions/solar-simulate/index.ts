// ─── solar-simulate ─────────────────────────────────────────────────────────
// Proxy server-side pra duas APIs públicas gratuitas usadas na Simulação
// Solar do Admin:
//
// - Nominatim (OpenStreetMap): geocodifica um endereço em lat/lon. A política
//   de uso deles pede um User-Agent identificável e no máx. 1 req/s por
//   cliente — por isso passa pelo servidor em vez de bater direto do
//   navegador (evita múltiplos admins/abas estourando o limite com o mesmo
//   IP/sem identificação, e corta o risco de CORS).
// - PVGIS (Comissão Europeia, JRC): geração estimada mensal/anual de um
//   sistema fotovoltaico a partir de lat/lon + potência + inclinação +
//   orientação, usando dados reais de irradiância por satélite. Essa é a
//   mesma base de dados que ferramentas profissionais (PVsol etc.) usam
//   pra validar simulações — aqui é consumida direto, sem reinventar o
//   cálculo de irradiância.
//
// Nenhuma das duas precisa de API key — por isso dá pra ativar a Simulação
// Solar sem configurar nada novo além do deploy desta function.

import "@supabase/functions-js/edge-runtime.d.ts"

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

// Identificação exigida pela política de uso do Nominatim — um User-Agent
// genérico de browser seria rejeitado/bloqueado.
const NOMINATIM_UA = "ErnaniffSolarApp/1.0 (vendas@ernaniff.com.br)"

async function handleGeocode(payload: { query?: string }) {
  const query = (payload.query || "").trim()
  if (!query) return json({ error: "endereço vazio" }, 400)

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } })
    if (!res.ok) return json({ error: `Nominatim respondeu ${res.status}` }, 502)
    const arr = await res.json()
    if (!Array.isArray(arr) || arr.length === 0) {
      return json({ error: "Endereço não encontrado. Tente ser mais específico (rua, cidade, estado)." }, 404)
    }
    const r = arr[0]
    return json({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name as string,
    })
  } catch (e) {
    return json({ error: `Erro ao geocodificar: ${String(e)}` }, 502)
  }
}

// PVGIS aspect: 0 = Sul, 90 = Oeste, -90 = Leste, independente do hemisfério
// (não se auto-ajusta pro hemisfério sul). No Brasil o ideal é o painel
// voltado pro Norte — a UI pede "orientação a partir do Norte" (0-360,
// sentido horário) e aqui convertemos pra convenção do PVGIS.
function orientacaoNorteToAspect(orientacaoNorte: number): number {
  let aspect = orientacaoNorte - 180
  while (aspect > 180) aspect -= 360
  while (aspect < -180) aspect += 360
  return aspect
}

async function handleGeneration(payload: {
  lat?: number; lon?: number; peakpower?: number; tilt?: number; orientacaoNorte?: number; loss?: number
}) {
  const { lat, lon, peakpower, tilt, orientacaoNorte, loss } = payload
  if (lat == null || lon == null || !peakpower) return json({ error: "lat/lon/peakpower obrigatórios" }, 400)

  const aspect = orientacaoNorteToAspect(orientacaoNorte ?? 0)
  const angle = tilt ?? Math.round(Math.abs(lat))
  const lossPct = loss ?? 14 // perdas de sistema padrão PVGIS (cabos, inversor, sujeira etc.)

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon),
    peakpower: String(peakpower),
    loss: String(lossPct),
    angle: String(angle),
    aspect: String(aspect),
    outputformat: "json",
    pvtechchoice: "crystSi",
    mountingplace: "building",
  })
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?${params.toString()}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    const text = await res.text()
    if (!res.ok) return json({ error: `PVGIS respondeu ${res.status}: ${text.slice(0, 300)}` }, 502)
    const data = JSON.parse(text)
    const monthly = data?.outputs?.monthly?.fixed as Array<{ month: number; E_m: number; H_m: number }> | undefined
    const totals = data?.outputs?.totals?.fixed as { E_y: number; H_y: number } | undefined
    if (!monthly || !totals) return json({ error: "PVGIS não retornou os dados esperados." }, 502)

    return json({
      monthly: monthly.map(m => ({ month: m.month, kwh: m.E_m, irradiance: m.H_m })),
      annualKwh: totals.E_y,
      annualIrradiance: totals.H_y,
      angle, aspect, lossPct,
    })
  } catch (e) {
    return json({ error: `Erro ao consultar PVGIS: ${String(e)}` }, 502)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  try {
    const { action, payload } = await req.json()
    switch (action) {
      case "geocode": return await handleGeocode(payload || {})
      case "generation": return await handleGeneration(payload || {})
      default: return json({ error: "ação desconhecida" }, 400)
    }
  } catch (e) {
    console.error("[solar-simulate]", e)
    return json({ error: "erro interno" }, 500)
  }
})
