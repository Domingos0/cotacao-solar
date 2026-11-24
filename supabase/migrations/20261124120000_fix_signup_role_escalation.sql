-- ============================================================
-- Remove auto-promoção a admin via metadata do signUp
-- ============================================================
-- Contexto: handle_new_user() lia raw_user_meta_data->>'role' e criava o
-- perfil já como admin/ativo se esse campo viesse "admin". user_metadata é
-- escrito pelo PRÓPRIO usuário (supabase.auth.signUp aceita `options.data`
-- livremente, com a anon key, direto do navegador) — qualquer um podia abrir
-- o console e chamar supabase.auth.signUp({ email, password, options: {
-- data: { role: 'admin' } } }) pra nascer admin, sem precisar aprovação
-- nenhuma. Nenhuma tela do app usa esse metadata pra criar admin (grep
-- confirmou: só CadastroPage.jsx, que nunca manda `role`) — não existe
-- caso de uso legítimo pra essa confiança. Daqui pra frente, todo cadastro
-- nasce cliente/pendente sempre; promover alguém a admin só é possível via
-- UPDATE direto em profiles por quem já é admin (guard_profiles_self_update
-- já bloqueia um não-admin fazer isso sozinho).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, empresa, cnpj, telefone, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.raw_user_meta_data->>'empresa',
    new.raw_user_meta_data->>'cnpj',
    new.raw_user_meta_data->>'telefone',
    new.email,
    'cliente',
    'pendente'
  );
  return new;
end;
$$;
