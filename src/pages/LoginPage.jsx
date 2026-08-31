import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, AlertTriangle, Shield, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'

function ForgotPasswordForm({ onBack }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center space-y-4 py-2">
        <CheckCircle2 size={40} className="text-green-500 mx-auto" />
        <p className="text-sm text-gray-600">
          Se <strong>{email}</strong> estiver cadastrado, enviamos um link para redefinir a senha.
        </p>
        <button onClick={onBack} className="text-weg-blue text-sm font-semibold hover:underline">
          Voltar para o login
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-gray-400 text-sm text-center -mt-2 mb-2">
        Informe seu e-mail e enviaremos um link para redefinir a senha.
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            required
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="seu@email.com"
            autoFocus
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-xs flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <KeyRound size={16} />}
        {loading ? 'Enviando…' : 'Enviar link de recuperação'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-1"
      >
        <ArrowLeft size={12} /> Voltar para o login
      </button>
    </form>
  )
}

export default function LoginPage({ onGoToRegister }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : err.message
      )
    }
  }

  return (
    <div className="min-h-screen bg-weg-gray flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-ernaniff-horizontal.png" alt="Ernaniff" className="h-16 mb-4 object-contain" />
          <h2 className="text-xl font-bold text-gray-900">
            {forgotMode ? 'Recuperar senha' : 'Acesso ao Sistema'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Ernaniff Representações — Solar</p>
        </div>

        {forgotMode ? (
          <ForgotPasswordForm onBack={() => setForgotMode(false)} />
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="seu@email.com"
                    autoFocus
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Senha</label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError('') }}
                    className="text-[11px] text-weg-blue font-semibold hover:underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-xs flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="shrink-0" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Shield size={16} />}
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>

            <div className="mt-5 text-center border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400">
                Ainda não tem acesso?{' '}
                <button
                  onClick={onGoToRegister}
                  className="text-weg-blue font-semibold hover:underline"
                >
                  Solicitar cadastro
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
