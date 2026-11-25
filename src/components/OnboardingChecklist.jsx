import { useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { ONBOARDING_STEPS, getOnboarding, isOnboardingComplete, isOnboardingDismissed, dismissOnboarding } from '../lib/tour'

// Checklist "Primeiros passos" (item 26) — só aparece pra quem ainda não
// completou os 3 passos básicos (montar kit → salvar → pedir desconto) e
// não dispensou o cartão. Lido do localStorage no momento em que o
// Catálogo monta — como o Catálogo remonta a cada navegação de volta pra
// ele, isso já é suficiente pra refletir progresso feito no Kit Builder.
export default function OnboardingChecklist({ userId }) {
  const [onboarding] = useState(() => getOnboarding(userId))
  const [dismissed, setDismissed] = useState(() => isOnboardingDismissed(userId))

  if (dismissed || isOnboardingComplete(userId)) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Primeiros passos</p>
          <p className="text-xs text-gray-400">Conclua os passos abaixo pra conhecer o fluxo completo de cotação.</p>
        </div>
        <button
          onClick={() => { dismissOnboarding(userId); setDismissed(true) }}
          className="text-gray-300 hover:text-gray-500 shrink-0"
          aria-label="Dispensar checklist"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {ONBOARDING_STEPS.map(s => {
          const done = !!onboarding[s.key]
          return (
            <div
              key={s.key}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg flex-1 ${
                done ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {done ? <CheckCircle2 size={16} className="shrink-0" /> : <Circle size={16} className="shrink-0 text-gray-300" />}
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
