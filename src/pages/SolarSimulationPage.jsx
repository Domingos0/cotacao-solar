import { useState, useMemo } from 'react'
import { Sun, Search, AlertTriangle, Plus, X, Info, MapPin, Calculator, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { sunPathForDay, SUN_PATH_DAYS, estimateHorizonShadingLoss, MONTH_NAMES } from '../lib/solarMath'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtKwh = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kWh'

// ─── Sun Path (SVG) ───────────────────────────────────────────────────────────
// Eixo X = azimute (0-360°, Norte ao centro pro Brasil fazer mais sentido
// visualmente — já que aqui o sol passa pelo Norte, não pelo Sul). Eixo Y =
// elevação (0-90°). As 3 curvas são dias reais (solstícios/equinócio),
// calculados por astronomia pura (ver solarMath.js) — não são ilustrativas.
function SunPathChart({ lat, lon, horizonProfile }) {
  const W = 640, H = 280, PAD = 36
  const xScale = az => PAD + (az / 360) * (W - 2 * PAD)
  const yScale = el => H - PAD - (el / 90) * (H - 2 * PAD)

  const curves = useMemo(() => {
    return SUN_PATH_DAYS.map(d => ({
      ...d,
      points: sunPathForDay(2025, d.month, d.day, lat, lon),
    }))
  }, [lat, lon])

  const horizonPath = useMemo(() => {
    if (!horizonProfile || horizonProfile.length === 0) return null
    const sorted = [...horizonProfile].sort((a, b) => a.azimuth - b.azimuth)
    const pts = sorted.map(p => `${xScale(p.azimuth)},${yScale(p.elevation)}`)
    return `M ${xScale(0)},${yScale(sorted[0]?.elevation || 0)} L ${pts.join(' L ')} L ${xScale(360)},${yScale(sorted[sorted.length - 1]?.elevation || 0)}`
  }, [horizonProfile])

  const colors = ['#f97316', '#2563eb', '#16a34a']

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grade */}
      {[0, 30, 60, 90].map(el => (
        <g key={el}>
          <line x1={PAD} y1={yScale(el)} x2={W - PAD} y2={yScale(el)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={4} y={yScale(el) + 4} fontSize="10" fill="#9ca3af">{el}°</text>
        </g>
      ))}
      {[0, 90, 180, 270, 360].map(az => (
        <g key={az}>
          <line x1={xScale(az)} y1={PAD} x2={xScale(az)} y2={H - PAD} stroke="#f3f4f6" strokeWidth="1" />
          <text x={xScale(az)} y={H - PAD + 14} fontSize="10" fill="#9ca3af" textAnchor="middle">
            {{ 0: 'N', 90: 'L', 180: 'S', 270: 'O', 360: 'N' }[az]}
          </text>
        </g>
      ))}

      {/* Área de sombreamento (abaixo do perfil de horizonte) */}
      {horizonPath && (
        <path d={`${horizonPath} L ${xScale(360)},${yScale(0)} L ${xScale(0)},${yScale(0)} Z`}
          fill="#78716c" fillOpacity="0.18" stroke="none" />
      )}
      {horizonPath && <path d={horizonPath} fill="none" stroke="#78716c" strokeWidth="2" strokeDasharray="4 3" />}

      {/* Curvas do sol */}
      {curves.map((c, i) => (
        <polyline
          key={c.label}
          points={c.points.map(p => `${xScale(p.azimuth)},${yScale(p.elevation)}`).join(' ')}
          fill="none" stroke={colors[i]} strokeWidth="2.5"
        />
      ))}
    </svg>
  )
}

export default function SolarSimulationPage() {
  // ── Local ──
  const [endereco, setEndereco] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [lat, setLat] = useState(null)
  const [lon, setLon] = useState(null)
  const [displayName, setDisplayName] = useState('')

  const doGeocode = async () => {
    if (!endereco.trim()) return
    setGeocoding(true); setGeoError('')
    const { data, error } = await supabase.functions.invoke('solar-simulate', { body: { action: 'geocode', payload: { query: endereco } } })
    setGeocoding(false)
    if (error || data?.error) { setGeoError(data?.error || error?.message || 'Erro ao buscar endereço.'); return }
    setLat(data.lat); setLon(data.lon); setDisplayName(data.displayName)
    setTilt(Math.round(Math.abs(data.lat)))
  }

  // ── Parâmetros do sistema ──
  const [peakpower, setPeakpower] = useState(5)
  const [tilt, setTilt] = useState(10)
  const [orientacao, setOrientacao] = useState(0) // graus a partir do Norte

  // ── Geração (PVGIS) ──
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [result, setResult] = useState(null) // { monthly, annualKwh, ... }

  const calcular = async () => {
    if (lat == null || lon == null) { setCalcError('Busque um endereço válido primeiro.'); return }
    setCalculating(true); setCalcError('')
    const { data, error } = await supabase.functions.invoke('solar-simulate', {
      body: { action: 'generation', payload: { lat, lon, peakpower: Number(peakpower), tilt: Number(tilt), orientacaoNorte: Number(orientacao) } },
    })
    setCalculating(false)
    if (error || data?.error) { setCalcError(data?.error || error?.message || 'Erro ao calcular geração.'); return }
    setResult(data)
  }

  // ── Perfil de sombreamento (horizonte) ──
  const [horizonProfile, setHorizonProfile] = useState([])
  const addHorizonPoint = () => setHorizonProfile(h => [...h, { azimuth: 180, elevation: 0 }])
  const updateHorizonPoint = (i, field, v) => setHorizonProfile(h => h.map((p, idx) => idx === i ? { ...p, [field]: Number(v) } : p))
  const removeHorizonPoint = (i) => setHorizonProfile(h => h.filter((_, idx) => idx !== i))

  const shadingLossPct = useMemo(() => {
    if (lat == null || lon == null || horizonProfile.length === 0) return 0
    return estimateHorizonShadingLoss(horizonProfile, lat, lon)
  }, [horizonProfile, lat, lon])

  const annualAdjustedKwh = result ? result.annualKwh * (1 - shadingLossPct / 100) : 0

  // ── Economia / payback ──
  const [tarifa, setTarifa] = useState(0.95)
  const [custoSistema, setCustoSistema] = useState('')
  const economiaAnual = annualAdjustedKwh * Number(tarifa || 0)
  const paybackAnos = custoSistema && economiaAnual > 0 ? Number(custoSistema) / economiaAnual : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Sun size={22} className="text-weg-blue" /> Simulação Solar
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Geração estimada com dados reais de irradiância (PVGIS), trajetória solar e perda por sombreamento de horizonte.
        </p>
      </div>

      {/* ── Local ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><MapPin size={16} className="text-weg-blue" /> Local do projeto</h3>
        <div className="flex gap-2">
          <input
            value={endereco} onChange={e => setEndereco(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doGeocode()}
            placeholder="Endereço, cidade e estado (ex: Av. Paulista, São Paulo - SP)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-weg-blue"
          />
          <button onClick={doGeocode} disabled={geocoding} className="btn-primary px-4 py-2 flex items-center gap-1.5 text-sm disabled:opacity-60">
            <Search size={14} /> {geocoding ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {geoError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {geoError}</p>}
        {lat != null && (
          <div className="mt-3 bg-blue-50 border border-weg-blue/20 rounded-lg p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-800">{displayName}</p>
            <p className="mt-0.5">Lat: <input type="number" step="0.0001" value={lat} onChange={e => setLat(Number(e.target.value))} className="w-24 border border-gray-200 rounded px-1 py-0.5 mx-1" />
              Lon: <input type="number" step="0.0001" value={lon} onChange={e => setLon(Number(e.target.value))} className="w-24 border border-gray-200 rounded px-1 py-0.5 mx-1" />
              <span className="text-gray-400">(ajustável manualmente se o endereço não bater exato)</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Parâmetros do sistema ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Calculator size={16} className="text-weg-blue" /> Parâmetros do sistema</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-500">
            Potência (kWp)
            <input type="number" step="0.1" min="0.1" value={peakpower} onChange={e => setPeakpower(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            Inclinação do telhado (°)
            <input type="number" min="0" max="90" value={tilt} onChange={e => setTilt(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-gray-500">
            Orientação (° a partir do Norte)
            <input type="number" min="0" max="360" value={orientacao} onChange={e => setOrientacao(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <span className="text-[11px] text-gray-400">0° = voltado pro Norte (ideal no Brasil)</span>
          </label>
        </div>
        <button onClick={calcular} disabled={calculating || lat == null} className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-60">
          {calculating ? 'Calculando…' : 'Calcular geração (PVGIS)'}
        </button>
        {calcError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {calcError}</p>}
      </div>

      {/* ── Resultado: geração mensal ── */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-weg-blue" /> Geração mensal estimada</h3>
          <p className="text-xs text-gray-400 mb-4">Fonte: PVGIS (JRC/Comissão Europeia) — irradiância real por satélite pra essa latitude/longitude.</p>
          <div className="flex items-end gap-1.5 h-40">
            {result.monthly.map(m => {
              const maxKwh = Math.max(...result.monthly.map(x => x.kwh))
              const h = Math.max(4, (m.kwh / maxKwh) * 100)
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] text-gray-500 mb-1">{Math.round(m.kwh)}</span>
                  <div className="w-full bg-weg-blue/80 rounded-t" style={{ height: `${h}%` }} />
                  <span className="text-[10px] text-gray-400 mt-1">{MONTH_NAMES[m.month - 1]}</span>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">Geração anual (sem sombra)</p>
              <p className="font-bold text-gray-800">{fmtKwh(result.annualKwh)}/ano</p>
            </div>
            {shadingLossPct > 0 && (
              <div>
                <p className="text-xs text-gray-400">Perda por sombreamento</p>
                <p className="font-bold text-amber-600">-{shadingLossPct.toFixed(1)}%</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Geração anual ajustada</p>
              <p className="font-bold text-green-700">{fmtKwh(annualAdjustedKwh)}/ano</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Sun Path + Sombreamento ── */}
      {lat != null && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-1">Trajetória solar (Sun Path) e perfil de horizonte</h3>
          <p className="text-xs text-gray-400 mb-3">
            Linhas coloridas: posição real do sol ao longo do dia (solstícios e equinócio). Área cinza tracejada: obstáculos que você informar abaixo (árvore, prédio vizinho, caixa d'água) — onde a curva do sol passa por baixo dela, aquele período fica sombreado.
          </p>
          <SunPathChart lat={lat} lon={lon} horizonProfile={horizonProfile} />
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f97316] inline-block" /> Verão (21/dez)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#2563eb] inline-block" /> Equinócio</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#16a34a] inline-block" /> Inverno (21/jun)</span>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Perfil de obstáculos (opcional)</p>
            <div className="space-y-2">
              {horizonProfile.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 text-gray-500">Azimute
                    <input type="number" min="0" max="360" value={p.azimuth} onChange={e => updateHorizonPoint(i, 'azimuth', e.target.value)}
                      className="w-20 border border-gray-200 rounded px-2 py-1" />°
                  </label>
                  <label className="flex items-center gap-1 text-gray-500">Altura do obstáculo
                    <input type="number" min="0" max="90" value={p.elevation} onChange={e => updateHorizonPoint(i, 'elevation', e.target.value)}
                      className="w-20 border border-gray-200 rounded px-2 py-1" />°
                  </label>
                  <button onClick={() => removeHorizonPoint(i)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addHorizonPoint} className="mt-2 flex items-center gap-1 text-xs text-weg-blue hover:underline">
              <Plus size={13} /> Adicionar ponto do horizonte
            </button>
            <p className="text-[11px] text-gray-400 mt-2 flex items-start gap-1">
              <Info size={12} className="shrink-0 mt-0.5" /> Azimute: direção do obstáculo (0°=Norte, 90°=Leste, 180°=Sul, 270°=Oeste). Altura: ângulo do topo do obstáculo visto do painel (ex: uma árvore que cobre 15° de altura visual).
            </p>
          </div>
        </div>
      )}

      {/* ── Economia / payback ── */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3">Economia estimada</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Tarifa de energia (R$/kWh)
              <input type="number" step="0.01" value={tarifa} onChange={e => setTarifa(e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-gray-500">
              Custo do sistema (opcional, pra payback)
              <input type="number" step="100" value={custoSistema} onChange={e => setCustoSistema(e.target.value)}
                placeholder="R$"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">Economia mensal média</p>
              <p className="font-bold text-gray-800">{fmt(economiaAnual / 12)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Economia anual</p>
              <p className="font-bold text-green-700">{fmt(economiaAnual)}</p>
            </div>
            {paybackAnos != null && (
              <div>
                <p className="text-xs text-gray-400">Payback simples</p>
                <p className="font-bold text-gray-800">{paybackAnos.toFixed(1)} anos</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
