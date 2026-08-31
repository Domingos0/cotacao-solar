import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Lock, AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await updatePassword(password)
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-weg-gray flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-ernaniff-horizontal.png" alt="Ernaniff" className="h-16 mb-4 object-contain" />
          <h2 className="text-xl font-bold text-gray-900">Definir nova senha</h2>
          <p className="text-gray-400 text-sm mt-1 text-center">Escolha uma nova senha de acesso.</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 size={40} className="text-green-500 mx-auto" />
            <p className="text-sm text-gray-600">Senha alterada com sucesso!</p>
            <button onClick={signOut} className="w-full btn-primary py-3">
              Entrar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nova senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
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
                : <KeyRound size={16} />}
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
