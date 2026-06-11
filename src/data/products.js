import rawProducts from './allProducts.json'

// Kit roles for the kit builder
export const KIT_ROLE = {
  PANEL:      'panel',
  INVERTER:   'inverter',
  MC4:        'mc4',
  CABLE_POS:  'cable_pos',
  CABLE_NEG:  'cable_neg',
  SURGE_DC:   'surge_dc',
  SURGE_AC:   'surge_ac',
  BREAKER:    'breaker',
  STRING_BOX: 'string_box',
}

export const CATEGORIES = {
  MODULOS:                'Módulos Fotovoltaicos',
  INVERSORES_MONO:        'Inversores Monofásicos',
  INVERSORES_TRI:         'Inversores Trifásicos',
  MICROINVERSORES:        'Microinversores',
  INVERSORES_BOMBEAMENTO: 'Inversores de Bombeamento',
  BATERIAS:               'Baterias e Armazenamento',
  ESTACOES_RECARGA:       'Estações de Recarga EV',
  SMART_HOME:             'WEG Smart Home',
  CABOS_CONECTORES:       'Cabos e Conectores',
  ESTRUTURAS:             'Estruturas Metálicas',
  ESTRUTURAS_AVULSOS:     'Estruturas – Componentes Avulsos',
  MONITORAMENTO:          'Monitoramento',
  PROTECAO:               'Proteção e Acessórios',
  OTIMIZADOR:             'Otimizador',
  CAPACITORES:            'Banco de Capacitores',
}

// Auto-assign kitRole based on produto tipo/nome/categoria
export function assignKitRole(p) {
  const nome = (p.nome || '').toLowerCase()
  const tipo = (p.tipo || '').toLowerCase()
  const cat  = (p.categoria || '')

  if (cat === CATEGORIES.MODULOS) return KIT_ROLE.PANEL

  if (cat === CATEGORIES.MICROINVERSORES ||
      cat === CATEGORIES.INVERSORES_MONO ||
      cat === CATEGORIES.INVERSORES_TRI)  return KIT_ROLE.INVERTER

  if (nome.includes('mc4') || tipo === 'conector') return KIT_ROLE.MC4

  if (nome.includes('vermelho') && (tipo === 'cabo cc' || nome.includes('unipolar')))
    return KIT_ROLE.CABLE_POS

  if (nome.includes('preto') && (tipo === 'cabo cc' || nome.includes('unipolar')))
    return KIT_ROLE.CABLE_NEG

  if (tipo === 'protetor de surto cc' || tipo === 'protetor surto cc' ||
      nome.includes('spw12'))
    return KIT_ROLE.SURGE_DC

  if (tipo === 'protetor de surto ca' || tipo === 'protetor surto ca' ||
      nome.includes('spw02'))
    return KIT_ROLE.SURGE_AC

  if (tipo === 'disjuntor ca' || nome.match(/^mdwp-|^mdwh-|^dwb/))
    return KIT_ROLE.BREAKER

  if (tipo === 'string box cc' || nome.includes('string box') || nome.includes('sb-2e'))
    return KIT_ROLE.STRING_BOX

  return null
}

// Merge Smart Home products (not in Composição Preços as separate section)
const smartHomeProducts = [
  { id: 9001, codigo: '16754677', nome: 'Câmera Externa IP65 Wi-Fi FULL HD',       modelo: 'Câmera Externa IP65',       categoria: CATEGORIES.SMART_HOME, tipo: 'Câmera de Monitoramento',   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9002, codigo: '15718932', nome: 'Câmera Interna WI-FI FHD PTZ INT 10',     modelo: 'Câmera PTZ',                 categoria: CATEGORIES.SMART_HOME, tipo: 'Câmera de Monitoramento',   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9003, codigo: '16016210', nome: 'Câmera Interna Fixa Wi-Fi HD FD INT 10',  modelo: 'Câmera Fixa',                categoria: CATEGORIES.SMART_HOME, tipo: 'Câmera de Monitoramento',   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9004, codigo: '15719001', nome: 'Plugue 10 A Wi-Fi',                        modelo: 'Plugue 10A Wi-Fi',           categoria: CATEGORIES.SMART_HOME, tipo: 'Plugue',                    fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9005, codigo: '15718999', nome: 'Controle Universal Wi-Fi',                 modelo: 'Controle Universal',         categoria: CATEGORIES.SMART_HOME, tipo: 'Controle Universal',        fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9006, codigo: '16177519', nome: 'Fonte USB – 1A',                           modelo: 'Fonte USB 1A',               categoria: CATEGORIES.SMART_HOME, tipo: 'Fonte USB',                 fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9007, codigo: '16177520', nome: 'Fonte USB – 2A',                           modelo: 'Fonte USB 2A',               categoria: CATEGORIES.SMART_HOME, tipo: 'Fonte USB',                 fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9008, codigo: '15718998', nome: 'Sensor de Movimento Wi-Fi',               modelo: 'Sensor Movimento',           categoria: CATEGORIES.SMART_HOME, tipo: 'Sensor',                    fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9009, codigo: '15718937', nome: 'Sensor para Porta ou Janela Wi-Fi',        modelo: 'Sensor Porta/Janela',        categoria: CATEGORIES.SMART_HOME, tipo: 'Sensor',                    fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9010, codigo: '15718935', nome: 'Módulo Dimmer Wi-Fi',                      modelo: 'Módulo Dimmer',              categoria: CATEGORIES.SMART_HOME, tipo: 'Módulo Inteligente',        fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9011, codigo: '15718934', nome: 'Módulo Interruptor Wi-Fi + RF',            modelo: 'Módulo Interruptor',         categoria: CATEGORIES.SMART_HOME, tipo: 'Módulo Inteligente',        fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9012, codigo: '15718936', nome: 'Módulo Relé Cortina Wi-Fi + RF',           modelo: 'Módulo Cortina',             categoria: CATEGORIES.SMART_HOME, tipo: 'Módulo Inteligente',        fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9013, codigo: '16016209', nome: 'Controle Remoto RF',                       modelo: 'Controle RF',                categoria: CATEGORIES.SMART_HOME, tipo: 'Controle Remoto',           fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9014, codigo: '16638091', nome: 'Interruptor Touch 4x2 – 1 Botão Preto',   modelo: 'Touch 4x2-1B PT',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9015, codigo: '16637832', nome: 'Interruptor Touch 4x2 – 1 Botão Branco',  modelo: 'Touch 4x2-1B BR',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9016, codigo: '16638092', nome: 'Interruptor Touch 4x2 – 2 Botões Preto',  modelo: 'Touch 4x2-2B PT',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9017, codigo: '16638047', nome: 'Interruptor Touch 4x2 – 2 Botões Branco', modelo: 'Touch 4x2-2B BR',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9018, codigo: '16638139', nome: 'Interruptor Touch 4x2 – 3 Botões Preto',  modelo: 'Touch 4x2-3B PT',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9019, codigo: '16638088', nome: 'Interruptor Touch 4x2 – 3 Botões Branco', modelo: 'Touch 4x2-3B BR',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9020, codigo: '16638140', nome: 'Interruptor Touch 4x2 – 4 Botões Preto',  modelo: 'Touch 4x2-4B PT',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9021, codigo: '16638089', nome: 'Interruptor Touch 4x2 – 4 Botões Branco', modelo: 'Touch 4x2-4B BR',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9022, codigo: '16638141', nome: 'Interruptor Touch 4x4 – 6 Botões Preto',  modelo: 'Touch 4x4-6B PT',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9023, codigo: '16638090', nome: 'Interruptor Touch 4x4 – 6 Botões Branco', modelo: 'Touch 4x4-6B BR',            categoria: CATEGORIES.SMART_HOME, tipo: 'Interruptor',               fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9024, codigo: '15586583', nome: 'Nobreak HOME012051090200',                 modelo: 'HOME012051090200',           categoria: CATEGORIES.SMART_HOME, tipo: 'Nobreak',                   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9025, codigo: '15002063', nome: 'Nobreak HOME008051030200',                 modelo: 'HOME008051030200',           categoria: CATEGORIES.SMART_HOME, tipo: 'Nobreak',                   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
  { id: 9026, codigo: '15002058', nome: 'Nobreak HOME006051030200',                 modelo: 'HOME006051030200',           categoria: CATEGORIES.SMART_HOME, tipo: 'Nobreak',                   fabricante: 'WEG', preco: null, precoFrete: null, estoque: 'Sob consulta', potencia: null, unidadePotencia: '' },
]

// Process raw products: add descriptions, kitRole, normalize
const processed = rawProducts.map(p => ({
  ...p,
  preco:      p.preco === 0 ? null : p.preco,
  modelo:     p.modelo || p.nome,
  kitRole:    assignKitRole(p),
  descricao:  buildDescription(p),
  specs:      buildSpecs(p),
  estoque:    p.preco && p.preco > 0 ? 'Disponível' : 'Sob consulta',
}))

function buildDescription(p) {
  const partes = []
  if (p.tipo)       partes.push(p.tipo)
  if (p.fabricante && p.fabricante !== 'WEG') partes.push(`Fabricante: ${p.fabricante}`)
  if (p.potencia)   partes.push(`${p.potencia} ${p.unidadePotencia}`)
  if (p.categoria)  partes.push(p.categoria)
  return partes.join(' — ')
}

function buildSpecs(p) {
  const s = {}
  if (p.potencia)        s['Potência'] = `${p.potencia} ${p.unidadePotencia}`
  if (p.tipo)            s['Tipo'] = p.tipo
  if (p.fabricante)      s['Fabricante'] = p.fabricante
  if (p.precoFrete && p.precoFrete !== p.preco)
    s['Preço c/ Frete'] = `R$ ${p.precoFrete.toFixed(2).replace('.', ',')}`
  return s
}

// Solo Fixo structures — preço por módulo, mesa dupla (número par obrigatório)
// Dois tiers: soloTier 'ate20' (≤20 módulos) e 'acima20' (>20 módulos)
const soloFixoProducts = [
  // ── Tier: até 20 módulos ──────────────────────────────────────────────────
  { id: 8001, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (615 Wp - WEG BIFACIAL)',              modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.80, precoFrete: 0.89, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8002, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (615 Wp - WEG BIFACIAL)',          modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.81, precoFrete: 0.89, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8003, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (615 Wp - WEG BIFACIAL)',          modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.86, precoFrete: 0.96, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8004, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (710 Wp - ASTRONERGY BIFACIAL)',       modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.77, precoFrete: 0.86, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8005, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (710 Wp - ASTRONERGY BIFACIAL)',   modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.84, precoFrete: 0.93, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8006, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (710 Wp - ASTRONERGY BIFACIAL)',   modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.89, precoFrete: 0.99, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8007, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (635 Wp - LONGI)',                     modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.77, precoFrete: 0.86, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8008, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (635 Wp - LONGI)',                 modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.78, precoFrete: 0.86, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8009, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (635 Wp - LONGI)',                 modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.83, precoFrete: 0.92, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8010, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.80, precoFrete: 0.89, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8011, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.81, precoFrete: 0.89, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  { id: 8012, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.86, precoFrete: 0.96, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'ate20' },
  // ── Tier: acima de 20 módulos ─────────────────────────────────────────────
  { id: 8013, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (615 Wp - WEG BIFACIAL)',              modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.56, precoFrete: 0.62, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8014, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (615 Wp - WEG BIFACIAL)',          modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.62, precoFrete: 0.69, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8015, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (615 Wp - WEG BIFACIAL)',          modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.76, precoFrete: 0.84, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8016, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (710 Wp - ASTRONERGY BIFACIAL)',       modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.55, precoFrete: 0.61, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8017, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (710 Wp - ASTRONERGY BIFACIAL)',   modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.61, precoFrete: 0.67, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8018, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (710 Wp - ASTRONERGY BIFACIAL)',   modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.74, precoFrete: 0.82, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8019, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (635 Wp - LONGI)',                     modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.54, precoFrete: 0.60, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8020, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (635 Wp - LONGI)',                 modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.60, precoFrete: 0.67, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8021, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (635 Wp - LONGI)',                 modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.74, precoFrete: 0.82, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8022, codigo: '15288210', nome: 'Região 1 - ESP-30-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-30-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.56, precoFrete: 0.62, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8023, codigo: '15288210', nome: 'Região 2 e 3 - ESP-40-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-40-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.62, precoFrete: 0.69, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
  { id: 8024, codigo: '15288210', nome: 'Região 4 e 5 - ESP-50-G20 (625 Wp - JA BIFACIAL [CD Nordeste])', modelo: 'ESP-50-G20', categoria: CATEGORIES.ESTRUTURAS, tipo: 'Estrutura para solo fixo', fabricante: 'WEG', preco: 0.76, precoFrete: 0.84, estoque: 'Disponível', potencia: 1, unidadePotencia: 'módulo', soloTier: 'acima20' },
]

// Produtos fixos hardcoded — nunca vêm de importação Excel, sempre preservados
export const fixedProducts = [...smartHomeProducts, ...soloFixoProducts]

// Combined final list: processed raw + smart home + solo fixo
export const products = [...processed, ...fixedProducts]

export const getCategoryIcon = (cat) => {
  const icons = {
    [CATEGORIES.MODULOS]:                '☀️',
    [CATEGORIES.INVERSORES_MONO]:        '⚡',
    [CATEGORIES.INVERSORES_TRI]:         '⚡',
    [CATEGORIES.MICROINVERSORES]:        '🔌',
    [CATEGORIES.INVERSORES_BOMBEAMENTO]: '💧',
    [CATEGORIES.BATERIAS]:              '🔋',
    [CATEGORIES.ESTACOES_RECARGA]:      '🚗',
    [CATEGORIES.SMART_HOME]:            '🏠',
    [CATEGORIES.CABOS_CONECTORES]:      '🔗',
    [CATEGORIES.ESTRUTURAS]:            '🏗️',
    [CATEGORIES.ESTRUTURAS_AVULSOS]:    '🔩',
    [CATEGORIES.MONITORAMENTO]:         '📡',
    [CATEGORIES.PROTECAO]:              '🛡️',
    [CATEGORIES.OTIMIZADOR]:            '⚙️',
    [CATEGORIES.CAPACITORES]:           '🔆',
  }
  return icons[cat] || '📦'
}
