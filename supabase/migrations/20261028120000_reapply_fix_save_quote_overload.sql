-- ============================================================
-- Reaplica a correção de overload duplicada de save_quote_with_items
-- ============================================================
-- Contexto: a migração 20261019120000_fix_save_quote_overload.sql já
-- tentou remover a assinatura antiga (10 args) de save_quote_with_items,
-- deixando só a versão atual (11 args, com p_target_user_id). Mas o erro
-- "Could not choose the best candidate function" voltou a aparecer na
-- tela de "Revisar cotação", mostrando as duas assinaturas (10 e 11
-- args) ainda presentes no banco — ou seja, aquela migração nunca
-- chegou a rodar de fato. Esta migração repete o drop (idempotente via
-- "if exists") pra garantir que só a versão com p_target_user_id
-- continue existindo.

drop function if exists public.save_quote_with_items(
  uuid, text, text, numeric, numeric, text, numeric, text, jsonb, jsonb
);
