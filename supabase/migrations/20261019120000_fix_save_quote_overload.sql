-- ============================================================
-- Corrige overload duplicada de save_quote_with_items
-- ============================================================
-- Contexto: a migração 20261016120000 adicionou o parâmetro
-- p_target_user_id (com default) à função save_quote_with_items. Como
-- isso mudou a assinatura (10 argumentos → 11), "create or replace
-- function" NÃO substituiu a função antiga — criou uma segunda função
-- em paralelo. Qualquer chamada passando só os 10 argumentos originais
-- (como a tela de revisão de cotação) ficou ambígua entre as duas
-- funções, e o Postgres passou a rejeitá-la com "function ... is not
-- unique", fazendo a tela de revisão travar silenciosamente ao salvar.
--
-- Esta migração remove a assinatura antiga (10 args), deixando só a
-- versão atual (11 args, com p_target_user_id default null) como única
-- save_quote_with_items no banco.

drop function if exists public.save_quote_with_items(
  uuid, text, text, numeric, numeric, text, numeric, text, jsonb, jsonb
);
