-- ============================================================
-- FIX: Recursão RLS + habilitar Realtime em profiles
-- Rodar no Supabase > SQL Editor
-- ============================================================

-- 1. Cria função SECURITY DEFINER para checar admin sem recursão
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Remove políticas antigas com recursão
DROP POLICY IF EXISTS "admin_ver_todos_perfis"   ON public.profiles;
DROP POLICY IF EXISTS "perfil_proprio"            ON public.profiles;
DROP POLICY IF EXISTS "perfil_update_proprio"     ON public.profiles;
DROP POLICY IF EXISTS "cliente_proprias_quotes"   ON public.quotes;
DROP POLICY IF EXISTS "items_via_quote"           ON public.quote_items;
DROP POLICY IF EXISTS "admin_ver_logs"            ON public.activity_logs;

-- 3. Recria políticas usando a função (sem recursão)
CREATE POLICY "perfil_proprio" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "perfil_update_proprio" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admin_gerenciar_perfis" ON public.profiles
  FOR ALL USING (public.is_admin());

CREATE POLICY "cliente_proprias_quotes" ON public.quotes
  FOR ALL USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "items_via_quote" ON public.quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "admin_ver_logs" ON public.activity_logs
  FOR SELECT USING (public.is_admin());

-- 4. Habilita Realtime para profiles (notificação automática de aprovação)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
