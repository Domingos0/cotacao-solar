// Item 45: datasheet de cada inversor. Dois níveis de link:
// 1. Por LINHA (ex: "SIW300H" → url) — tabela public.inverter_datasheets,
//    cobre a maioria dos modelos de uma vez.
// 2. Por MODELO específico (override, ex: um SAP que usa um datasheet
//    diferente do padrão da linha) — product.datasheetUrl, dentro do
//    próprio jsonb do produto no catálogo (sem tabela nova).
import { supabase } from './supabase'
import { getInverterSpecs } from '../data/inverterSpecs'

export function getDatasheetLinha(product) {
  return getInverterSpecs(product)?.linha || null
}

// `datasheetsByLinha` é o mapa {linha: url} já carregado (ver listDatasheets).
export function resolveDatasheetUrl(product, datasheetsByLinha) {
  if (product?.datasheetUrl) return product.datasheetUrl
  const linha = getDatasheetLinha(product)
  return linha ? (datasheetsByLinha?.[linha] || null) : null
}

export async function listDatasheets() {
  const { data, error } = await supabase.from('inverter_datasheets').select('linha, url').order('linha')
  return { data: data || [], error }
}

export async function upsertDatasheet(linha, url) {
  const { error } = await supabase.from('inverter_datasheets').upsert({ linha, url, updated_at: new Date().toISOString() })
  return { error }
}

export async function deleteDatasheet(linha) {
  const { error } = await supabase.from('inverter_datasheets').delete().eq('linha', linha)
  return { error }
}

// Importação por planilha (item 45): linhas [{linha, link}] — aceita
// "link" ou "url" como nome de coluna, pra não travar em planilha com
// cabeçalho diferente.
export async function importDatasheetsFromRows(rows) {
  const payload = rows
    .map(r => ({
      linha: String(r.linha || r.Linha || '').trim(),
      url: String(r.link || r.Link || r.url || r.URL || '').trim(),
    }))
    .filter(r => r.linha && r.url)
    .map(r => ({ ...r, updated_at: new Date().toISOString() }))
  if (!payload.length) return { error: null, count: 0 }
  const { error } = await supabase.from('inverter_datasheets').upsert(payload)
  return { error, count: payload.length }
}

// Sobe o PDF pro bucket público 'datasheets' e devolve a URL pública —
// usado tanto pelo upload por linha quanto pelo override por modelo.
export async function uploadDatasheetFile(file, pathHint) {
  const safeName = pathHint.replace(/[^\w.-]+/g, '_')
  const path = `${safeName}-${Date.now()}.pdf`
  const { error } = await supabase.storage.from('datasheets').upload(path, file, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('datasheets').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
