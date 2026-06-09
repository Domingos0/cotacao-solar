import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('⚠ Supabase não configurado. Preencha .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

// sessionStorage → cada aba tem sessão independente (resolve conflito de sessões simultâneas)
export const supabase = createClient(url || '', key || '', {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
