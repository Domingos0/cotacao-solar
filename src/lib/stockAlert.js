// Item 32: "Avise-me quando chegar" pra produto esgotado. Depende do item 1
// (effectiveEstoque) — a mesma regra de "Previsão já passada = Disponível"
// é replicada em SQL em check_stock_notifications (ver migração
// 20261126140000_stock_notifications.sql).
import { supabase } from './supabase'

export async function requestStockAlert({ userId, codigoSap, nome }) {
  const { error } = await supabase.from('stock_notifications').insert({
    user_id: userId,
    codigo_sap: codigoSap,
    produto_nome: nome || null,
  })
  // Unique index parcial (user_id, codigo_sap) where notified_at is null —
  // já tem um pedido pendente pra esse produto, trata como sucesso silencioso.
  if (error && error.code === '23505') return { error: null, alreadyRequested: true }
  return { error }
}

export async function cancelStockAlert({ userId, codigoSap }) {
  const { error } = await supabase.from('stock_notifications')
    .delete()
    .eq('user_id', userId)
    .eq('codigo_sap', codigoSap)
    .is('notified_at', null)
  return { error }
}

export async function hasStockAlert({ userId, codigoSap }) {
  const { data, error } = await supabase.from('stock_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('codigo_sap', codigoSap)
    .is('notified_at', null)
    .maybeSingle()
  if (error) return false
  return !!data
}
