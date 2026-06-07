import { Sun, Zap, Battery, Droplets } from 'lucide-react'

const stats = [
  { icon: Sun, label: 'Módulos Fotovoltaicos', value: '6 modelos', color: 'text-amber-400' },
  { icon: Zap, label: 'Inversores On-Grid', value: '30+ modelos', color: 'text-blue-300' },
  { icon: Droplets, label: 'Inversores de Bombeamento', value: '30+ modelos', color: 'text-cyan-300' },
  { icon: Battery, label: 'Baterias e Armazenamento', value: '4 modelos', color: 'text-green-300' },
]

export default function HeroBanner() {
  return (
    <section className="bg-gradient-to-r from-weg-blue via-weg-blue-mid to-weg-blue-light text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-weg-orange/20 border border-weg-orange/40 rounded-full px-3 py-1.5 text-sm font-medium text-weg-orange mb-4">
              <span className="w-2 h-2 bg-weg-orange rounded-full animate-pulse" />
              Lista de Preços — Novembro 2025
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight mb-3">
              Catálogo WEG<br />
              <span className="text-weg-orange">Energia Solar</span>
            </h1>
            <p className="text-white/70 text-base max-w-lg leading-relaxed">
              Encontre inversores, módulos fotovoltaicos, baterias, estações de recarga e todos os produtos da linha solar WEG em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:shrink-0">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4">
                <Icon size={22} className={`${color} mb-2`} />
                <p className="text-white font-bold text-lg leading-none mb-1">{value}</p>
                <p className="text-white/60 text-xs leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="relative h-6 overflow-hidden">
        <svg viewBox="0 0 1440 24" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" fill="#F4F6F8">
          <path d="M0,0 C360,24 1080,24 1440,0 L1440,24 L0,24 Z" />
        </svg>
      </div>
    </section>
  )
}
