import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY

// Storage vazio — impede que o cliente admin leia a sessão do usuário logado
const noStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

// Service role client — bypassa RLS completamente
export const supabaseAdmin = createClient(url || '', key || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storage: noStorage,
  },
  global: {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  },
})
