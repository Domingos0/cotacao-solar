import { Phone, Mail, MapPin, Globe } from 'lucide-react'
import { useProducts } from '../context/ProductsContext'

export default function Footer() {
  const { tableInfo } = useProducts()

  return (
    <footer id="contato" className="bg-weg-dark text-white mt-16">
      {/* Orange accent bar */}
      <div className="h-1 bg-weg-orange" />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/Logo_ErnaniFF_branco sem fundo.PNG" alt="Ernaniff Representações" className="w-48 h-auto object-contain" />
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Escritório de representação comercial especializado em soluções de energia solar WEG para o Brasil.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4 border-b border-white/20 pb-2">Contato Comercial</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-white/70">
                <Phone size={15} className="mt-0.5 text-weg-orange shrink-0" />
                <span>0800 727 0800 (Brasil)</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/70">
                <Mail size={15} className="mt-0.5 text-weg-orange shrink-0" />
                <span>energia.solar@weg.net</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/70">
                <Globe size={15} className="mt-0.5 text-weg-orange shrink-0" />
                <span>www.weg.net/br/energia-solar</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/70">
                <MapPin size={15} className="mt-0.5 text-weg-orange shrink-0" />
                <span>Jaraguá do Sul – SC, Brasil</span>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-white mb-4 border-b border-white/20 pb-2">Linha de Produtos</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>☀️ Módulos Fotovoltaicos</li>
              <li>⚡ Inversores On-Grid (Mono e Tri)</li>
              <li>🔌 Microinversores</li>
              <li>💧 Inversores de Bombeamento</li>
              <li>🔋 Baterias e Armazenamento</li>
              <li>🚗 Estações de Recarga EV</li>
              <li>🏠 WEG Smart Home</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/40">
          <p>© 2026 Ernaniff Representações — Todos os direitos reservados</p>
          <p>
            {tableInfo?.nome || 'Lista de Preços'} — {tableInfo?.observacao || 'Preços sujeitos a alteração sem aviso prévio'}
          </p>
        </div>
      </div>
    </footer>
  )
}
