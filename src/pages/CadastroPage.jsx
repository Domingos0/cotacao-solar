import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { notifyClienteRegistered } from '../lib/notify'
import { User, Building2, Hash, Phone, Mail, Lock, MessageCircle, CheckCircle2, AlertTriangle, ArrowLeft, ChevronDown } from 'lucide-react'

// ─── Validação de CNPJ (algoritmo Receita Federal) ───────────────────────────
function validateCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false
  const calc = (len) => {
    let sum = 0, pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13])
}

function formatCNPJ(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function CadastroPage({ onGoToLogin }) {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ nome: '', empresa: '', cnpj: '', telefone: '', email: '', password: '', confirm: '', whatsapp_apikey: '' })
  const [showWaSetup, setShowWaSetup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.cnpj.trim()) { setError('CNPJ é obrigatório.'); return }
    if (!validateCNPJ(form.cnpj)) { setError('CNPJ inválido. Verifique os dígitos.'); return }
    if (!form.telefone.trim()) { setError('WhatsApp é obrigatório.'); return }
    if (form.password !== form.confirm) { setError('As senhas não conferem.'); return }
    if (form.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    setError('')
    const { error } = await signUp({ ...form, whatsapp_apikey: form.whatsapp_apikey })
    setLoading(false)
    if (error) { setError(error.message); return }
    notifyClienteRegistered({ nome: form.nome, userEmail: form.email, empresa: form.empresa, telefone: form.telefone })
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-weg-gray flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-8 text-center">
          <CheckCircle2 size={52} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cadastro enviado!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Seu cadastro foi registrado e está <strong>aguardando aprovação</strong> do administrador.
            Você receberá acesso em breve.
          </p>
          <button onClick={onGoToLogin} className="btn-primary w-full py-3">
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-weg-gray flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-ernaniff-horizontal.png" alt="Ernaniff" className="h-12 mb-3 object-contain" />
          <h2 className="text-xl font-bold text-gray-900">Solicitar Acesso</h2>
          <p className="text-gray-400 text-sm mt-1">Preencha seus dados — o admin aprovará seu acesso</p>
        </div>

        <form onSubmit={submit} className="space-y-3">

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo *</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" required value={form.nome} onChange={set('nome')} placeholder="Seu nome"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* Empresa */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Empresa</label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={form.empresa} onChange={set('empresa')} placeholder="Nome da empresa"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* CNPJ — obrigatório + validação */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CNPJ *
              {form.cnpj.replace(/\D/g, '').length === 14 && (
                validateCNPJ(form.cnpj)
                  ? <span className="ml-2 text-green-600 font-semibold">✓ válido</span>
                  : <span className="ml-2 text-red-500 font-semibold">✗ inválido</span>
              )}
            </label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={form.cnpj}
                onChange={e => setForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue font-mono"
              />
            </div>
          </div>

          {/* WhatsApp — obrigatório */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp *</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" required value={form.telefone} onChange={set('telefone')} placeholder="+55 (00) 00000-0000"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-mail *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" required value={form.email} onChange={set('email')} placeholder="seu@email.com"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Senha *</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar senha *</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required value={form.confirm} onChange={set('confirm')} placeholder="Repita a senha"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue" />
            </div>
          </div>

          {/* WhatsApp API — opcional */}
          <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-2">
            <button type="button" onClick={() => setShowWaSetup(v => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-weg-blue">
              <span className="flex items-center gap-1.5">
                <MessageCircle size={13} className="text-green-500" />
                Ativar notificações por WhatsApp <span className="text-gray-300">(opcional)</span>
              </span>
              <ChevronDown size={13} className={`transition-transform ${showWaSetup ? 'rotate-180' : ''}`} />
            </button>

            {showWaSetup && (
              <div className="space-y-2 pt-1">
                <div className="bg-green-50 rounded-lg p-2.5 text-xs text-green-700 space-y-0.5">
                  <p className="font-semibold">3 passos para ativar:</p>
                  <p>1. Adicione <strong>+34 644 97 74 49</strong> como "CallMeBot" no WhatsApp</p>
                  <p>2. Envie: <code className="bg-green-100 px-1 rounded">I allow callmebot to send me messages</code></p>
                  <p>3. Receba seu API Key e cole abaixo</p>
                </div>
                <div className="relative">
                  <MessageCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.whatsapp_apikey}
                    onChange={e => setForm(f => ({ ...f, whatsapp_apikey: e.target.value }))}
                    placeholder="API Key do CallMeBot (ex: 123456)"
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-xs flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60 !mt-4"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Enviando…' : 'Solicitar cadastro'}
          </button>
        </form>

        <div className="mt-4 text-center border-t border-gray-100 pt-4">
          <button
            onClick={onGoToLogin}
            className="text-xs text-gray-400 hover:text-weg-blue flex items-center gap-1 mx-auto"
          >
            <ArrowLeft size={12} /> Voltar para o login
          </button>
        </div>
      </div>
    </div>
  )
}
