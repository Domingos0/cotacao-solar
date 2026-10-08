-- ============================================================
-- Integração com o CRM: dispara a Edge Function sync-crm sempre
-- que o status de uma cotação muda (exceto rascunho).
-- ============================================================
-- Contexto: o CRM já previa (ver migração 0040 do projeto CRM) um campo
-- `numero_cotacao` pra receber isso de sistemas externos, mas nunca foi
-- implementado. Aqui o banco chama a Edge Function via pg_net sempre que
-- o status muda — cobre automaticamente todos os pontos do código que já
-- mudam status (save_quote_with_items, approve/reject_quote_discount,
-- KitsFechadosPanel, drag-and-drop) sem precisar alterar nenhum deles.

-- ── 1. Motivo de perda (mesmos valores "reais" que o CRM usa hoje — ver
-- CRM/supabase/migrations/0022_motivo_perda_real.sql; os valores antigos
-- de 0006 ainda são aceitos lá só por compatibilidade, não usamos aqui) ────
alter table public.quotes add column if not exists motivo_perda text;
alter table public.quotes drop constraint if exists quotes_motivo_perda_check;
alter table public.quotes add constraint quotes_motivo_perda_check
  check (motivo_perda is null or motivo_perda in (
    'cancelado', 'atraso_faturamento', 'falha_envio_proposta',
    'falta_followup_prazo', 'preco', 'restricao_tecnica', 'outro'
  ));

-- ── 2. pg_net — permite o banco fazer chamadas HTTP assíncronas ────────────
create extension if not exists pg_net;

-- ── 3. Trigger: notifica a Edge Function a cada mudança de status ─────────
-- A URL da function fica hardcoded aqui (é pública, só a Edge Function exige
-- o secret de integração) — troque "<PROJECT_REF>" pelo ref real do projeto
-- ao aplicar esta migração.
create or replace function public.notify_crm_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'rascunho' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  perform net.http_post(
    url := 'https://cfnnvnqnpsdtbokglwwv.supabase.co/functions/v1/sync-crm',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('quote_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists quotes_notify_crm_sync on public.quotes;
create trigger quotes_notify_crm_sync
  after insert or update on public.quotes
  for each row execute procedure public.notify_crm_sync();
