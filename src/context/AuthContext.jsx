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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Limpeza total — garante zero dados do usuário anterior nesta aba
        setSession(null)
        setProfile(null)
        return
      }
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
    try {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        const meta = userMeta || {}
        if (meta.role === 'admin' && data.role !== 'admin') {
          setProfile({ ...data, role: 'admin', status: 'ativo' })
        } else {
          setProfile(data)
        }
        return
      }
    } catch (_) {}

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (data) { setProfile(data); return }
    } catch (_) {}

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

  // scope: 'local' — limpa apenas ESTA aba, não invalida sessões em outros dispositivos/abas
  const signOut = async () => {
    setProfile(null)
    await supabase.auth.signOut({ scope: 'local' })
  }

  const refreshProfile = () => {
    if (session?.user) fetchProfile(session.user.id, session.user.user_metadata)
  }

  // loading enquanto: sessão ainda não foi lida OU sessão existe mas perfil ainda não chegou
  const loading = session === undefined || (session !== null && profile === null)

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
