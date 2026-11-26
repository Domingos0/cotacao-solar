// Item 41: kits favoritos e modelos prontos — qualquer cotação já montada
// pode virar um modelo reutilizável (sanitizado, sem dado pessoal do
// cliente original), e cada usuário pode favoritar os modelos que mais usa.
import { supabase } from './supabase'

// Campos pessoais/transacionais da cotação de origem que não fazem sentido
// num modelo reutilizável — um modelo é um PONTO DE PARTIDA, não a cotação
// de um cliente específico.
const CAMPOS_PESSOAIS = [
  'clienteNome', 'clienteUF', 'clienteCidade', 'clienteLocal', 'clienteEmpresa', 'targetClientId',
  'numero_orcamento', 'revisao', 'revisoes', 'motivo',
  'criadoPorAdmin', 'criadoPorAdminNome',
  'origemEstudo', 'estudoSnapshot', 'origemPromo', 'promoKitId', 'templateId',
  'desconto_motivo',
]

export function sanitizeKitDataForTemplate(kitData) {
  const clean = { ...(kitData || {}) }
  CAMPOS_PESSOAIS.forEach(k => { delete clean[k] })
  return clean
}

function calcKwpFromKitData(kitData) {
  if (!kitData?.panel) return null
  return Number((((kitData.panelQty || 1) * (kitData.panel.potencia || 0)) / 1000).toFixed(2))
}

export async function listKitTemplates() {
  const { data, error } = await supabase
    .from('kit_templates')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  return { data: data || [], error }
}

export async function createTemplateFromQuote(nome, kitData, { userId, isAdmin }) {
  const payload = {
    nome,
    kwp: calcKwpFromKitData(kitData),
    kit_data: sanitizeKitDataForTemplate(kitData),
    created_by: userId,
    global: !!isAdmin,
  }
  const { data, error } = await supabase.from('kit_templates').insert(payload).select().single()
  return { data, error }
}

export async function deleteKitTemplate(id) {
  const { error } = await supabase.from('kit_templates').delete().eq('id', id)
  return { error }
}

export async function listFavoriteIds(userId) {
  if (!userId) return { data: new Set(), error: null }
  const { data, error } = await supabase
    .from('kit_template_favoritos')
    .select('template_id')
    .eq('user_id', userId)
  return { data: new Set((data || []).map(r => r.template_id)), error }
}

export async function toggleFavorite(userId, templateId, isFav) {
  if (isFav) {
    const { error } = await supabase.from('kit_template_favoritos').delete().eq('user_id', userId).eq('template_id', templateId)
    return { error }
  }
  const { error } = await supabase.from('kit_template_favoritos').insert({ user_id: userId, template_id: templateId })
  return { error }
}
