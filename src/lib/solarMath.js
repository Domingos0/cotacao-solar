// ─── Posição solar (astronomia pura) ──────────────────────────────────────────
// Implementação do algoritmo NOAA (baseado em Jean Meeus, "Astronomical
// Algorithms") — o mesmo usado na calculadora solar oficial da NOAA. Preciso
// a menos de ~0.01° sem precisar de nenhum dado externo (só data/hora UTC e
// lat/lon). É a base real por trás do diagrama de Sun Path e do cálculo de
// perda por sombreamento — não é aproximação arbitrária.

const toRad = d => d * Math.PI / 180
const toDeg = r => r * 180 / Math.PI

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5
}

// Retorna { elevation, azimuth } em graus. azimuth medido a partir do Norte
// (0°), sentido horário (Norte=0, Leste=90, Sul=180, Oeste=270).
// lon: positivo a Leste de Greenwich (ex: Brasil é negativo).
export function sunPosition(date, lat, lon) {
  const jd = julianDay(date)
  const T = (jd - 2451545.0) / 36525

  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
  const Mrad = toRad(M)

  const C = Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
            Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
            Math.sin(3 * Mrad) * 0.000289

  const trueLong = L0 + C
  const omega = 125.04 - 1934.136 * T
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(toRad(omega))

  const epsilon0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const epsilonCorr = epsilon0 + 0.00256 * Math.cos(toRad(omega))

  const declination = toDeg(Math.asin(Math.sin(toRad(epsilonCorr)) * Math.sin(toRad(lambda))))

  const y = Math.pow(Math.tan(toRad(epsilonCorr / 2)), 2)
  const eot = 4 * toDeg(
    y * Math.sin(2 * toRad(L0))
    - 2 * e * Math.sin(Mrad)
    + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * toRad(L0))
    - 0.5 * y * y * Math.sin(4 * toRad(L0))
    - 1.25 * e * e * Math.sin(2 * Mrad)
  )

  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  let trueSolarTime = (utcMinutes + eot + 4 * lon) % 1440
  if (trueSolarTime < 0) trueSolarTime += 1440

  let hourAngle = trueSolarTime / 4 - 180
  if (hourAngle < -180) hourAngle += 360

  const latRad = toRad(lat)
  const decRad = toRad(declination)
  const haRad = toRad(hourAngle)

  const cosZenith = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  const zenith = toDeg(Math.acos(Math.max(-1, Math.min(1, cosZenith))))
  const elevation = 90 - zenith

  const sinZenith = Math.sin(toRad(zenith))
  let azimuth
  if (Math.abs(sinZenith) < 1e-6) {
    azimuth = 0
  } else {
    const cosAz = (Math.sin(latRad) * Math.cos(toRad(zenith)) - Math.sin(decRad)) / (Math.cos(latRad) * sinZenith)
    const acosAz = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))))
    // Fórmula NOAA: sem esse deslocamento de 180°, o azimute sai espelhado
    // (apontando pro lado errado da trajetória) — confirmado comparando
    // contra pontos de referência conhecidos (meio-dia solar = Sul no
    // hemisfério norte, Norte no hemisfério sul).
    azimuth = hourAngle > 0 ? (acosAz + 180) % 360 : (540 - acosAz) % 360
  }

  return { elevation, azimuth, declination }
}

// Trajetória do sol num dia (passo de 15 min), só pontos acima do horizonte.
export function sunPathForDay(year, month, day, lat, lon) {
  const points = []
  for (let m = 0; m < 24 * 60; m += 15) {
    const date = new Date(Date.UTC(year, month - 1, day, 0, m))
    const { elevation, azimuth } = sunPosition(date, lat, lon)
    if (elevation > 0) points.push({ minute: m, elevation, azimuth })
  }
  return points
}

// Dias representativos: solstícios + equinócios (ano não-bissexto fixo,
// suficiente pra desenhar as curvas características do sun path).
export const SUN_PATH_DAYS = [
  { label: 'Solstício de verão (21/dez)', month: 12, day: 21 },
  { label: 'Equinócio (21/mar e 23/set)', month: 3, day: 21 },
  { label: 'Solstício de inverno (21/jun)', month: 6, day: 21 },
]

// Interpola a elevação do perfil de horizonte (obstáculos) numa dada azimute.
// horizonProfile: [{ azimuth, elevation }], não precisa estar ordenado.
function horizonElevationAt(horizonProfile, azimuth) {
  if (!horizonProfile || horizonProfile.length === 0) return 0
  const sorted = [...horizonProfile].sort((a, b) => a.azimuth - b.azimuth)
  if (azimuth <= sorted[0].azimuth) return sorted[0].elevation
  if (azimuth >= sorted[sorted.length - 1].azimuth) return sorted[sorted.length - 1].elevation
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (azimuth >= a.azimuth && azimuth <= b.azimuth) {
      const t = (azimuth - a.azimuth) / (b.azimuth - a.azimuth)
      return a.elevation + t * (b.elevation - a.elevation)
    }
  }
  return 0
}

// Estima a perda de geração por sombreamento do horizonte (0-100%), varrendo
// 12 dias representativos (dia 15 de cada mês) em passos de 30min. Pondera
// cada hora pelo seno da elevação solar (proxy de irradiância direta num céu
// limpo) — é uma aproximação real (mesma lógica de ferramentas de horizonte
// de softwares PV profissionais), não um chute: horas com sol baixo pesam
// menos que horas de meio-dia, como fisicamente esperado.
export function estimateHorizonShadingLoss(horizonProfile, lat, lon) {
  if (!horizonProfile || horizonProfile.length === 0) return 0
  let totalWeight = 0
  let blockedWeight = 0
  for (let month = 1; month <= 12; month++) {
    for (let m = 0; m < 24 * 60; m += 30) {
      const date = new Date(Date.UTC(2025, month - 1, 15, 0, m))
      const { elevation, azimuth } = sunPosition(date, lat, lon)
      if (elevation <= 0) continue
      const weight = Math.sin(toRad(elevation))
      totalWeight += weight
      const obstruction = horizonElevationAt(horizonProfile, azimuth)
      if (elevation < obstruction) blockedWeight += weight
    }
  }
  if (totalWeight === 0) return 0
  return (blockedWeight / totalWeight) * 100
}

export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
