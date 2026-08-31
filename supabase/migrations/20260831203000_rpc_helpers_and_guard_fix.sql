-- ============================================================
-- Ajustes descobertos ao migrar o front-end para sair da service_role key:
-- 1) cliente pode legitimamente fechar/perder seu próprio kit (não é um
--    privilégio de admin — a trava anterior bloquearia essa ação real).
-- 2) numeração global de orçamento (EFF-YYYY-NNN) precisa ler todas as
--    cotações, o que RLS agora impede para não-admin — vira uma RPC.
-- 3) "meus colegas de equipe" (mesmo CNPJ) precisa ler outros perfis —
--    vira uma RPC estreita em vez de abrir profiles inteiro entre colegas.
-- ============================================================

create or replace function public.guard_quotes_self_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
     and new.status not in ('rascunho', 'enviada', 'aguardando_desconto', 'fechado', 'perdida') then
    new.status := old.status;
  end if;
  if coalesce(new.desconto_pct, 0) > coalesce(old.desconto_pct, 0) then
    new.desconto_pct := old.desconto_pct;
  end if;
  new.desconto_resposta := old.desconto_resposta;
  return new;
end;
$$;

create or replace function public.next_orcamento_number()
returns text
language plpgsql
security definer
as $$
declare
  yr text := to_char(now(), 'YYYY');
  prefix text := 'EFF-' || yr || '-';
  max_seq int;
begin
  select coalesce(max(
    case when (data->>'numero_orcamento') like prefix || '%'
      then nullif(substring(data->>'numero_orcamento' from length(prefix) + 1), '')::int
      else null end
  ), 0) into max_seq
  from public.quotes;
  return prefix || lpad((max_seq + 1)::text, 3, '0');
end;
$$;

revoke all on function public.next_orcamento_number() from public;
grant execute on function public.next_orcamento_number() to authenticated;

create or replace function public.list_team_members()
returns table(id uuid, nome text, empresa text, telefone text, status text, created_at timestamptz)
language sql
security definer
stable
as $$
  select p.id, p.nome, p.empresa, p.telefone, p.status, p.created_at
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where me.cnpj is not null and p.cnpj = me.cnpj and p.id <> auth.uid();
$$;

revoke all on function public.list_team_members() from public;
grant execute on function public.list_team_members() to authenticated;
