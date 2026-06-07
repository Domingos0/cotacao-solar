import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user.user_metadata)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user.user_metadata)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Realtime: detecta aprovação automática quando o perfil é atualizado no banco
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    // Limpa canal anterior
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        if (payload.new) setProfile(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [session?.user?.id])

  const metaToProfile = (userId, meta = {}) => ({
    id: userId,
    nome: meta.nome || meta.email || userId,
    role: meta.role || 'cliente',
    status: meta.role === 'admin' ? 'ativo' : 'pendente',
  })

  const fetchProfile = async (userId, userMeta) => {
    // Usa supabaseAdmin para bypasvar RLS e sempre ler o status atualizado do banco
    try {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        // Merge: se o metadata tem role=admin mas o DB ainda não, prioriza admin
        const meta = userMeta || {}
        if (meta.role === 'admin' && data.role !== 'admin') {
          setProfile({ ...data, role: 'admin', status: 'ativo' })
        } else {
          setProfile(data)
        }
        return
      }
    } catch (_) {
      // Falhou mesmo com admin — tenta anon como fallback
    }

    // Fallback: tenta com cliente anon
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (data) { setProfile(data); return }
    } catch (_) {}

    // Último recurso: JWT metadata
    const meta = userMeta || {}
    setProfile(metaToProfile(userId, meta))
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signUp = async ({ email, password, nome, empresa, cnpj, telefone, whatsapp_apikey }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome, empresa, cnpj, telefone, ...(whatsapp_apikey ? { whatsapp_apikey } : {}) } },
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = () => {
    if (session?.user) fetchProfile(session.user.id, session.user.user_metadata)
  }

  const loading = session === undefined

  // isAdmin: DB profile OU JWT metadata (garante acesso mesmo com RLS quebrado)
  const metaRole = session?.user?.user_metadata?.role
  const isAdmin = profile?.role === 'admin' || metaRole === 'admin'
  const isAtivo = profile?.status === 'ativo' || isAdmin

  return (
    <AuthContext.Provider value={{
      session, profile, loading,
      isAdmin, isAtivo,
      signIn, signUp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
