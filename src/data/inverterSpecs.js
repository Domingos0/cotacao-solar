// Inverter technical specifications extracted from PORTFOLIO_WEG_SOLAR.pdf
// Used by ProductDetail to enrich the modal with official WEG data

const SPECS = {
  siw100g_m010: {
    title: 'SIW100G M010',
    subtitulo: 'Microinversor 1000 W',
    image: '/img/inversores/siw100g_m010.jpg',
    specs: {
      'Potência CA':       '1000 W',
      'Tensão da Rede':    '220 V monofásico',
      'Entradas CC':       '2 entradas (até 670 Wp)',
      'MPPT':              '2 MPPT individuais',
      'Proteção':          'IP67',
      'Comunicação':       'WiFi integrado',
      'Garantia':          '15 anos',
    },
    badges: ['IP67', 'WiFi', '15 anos'],
  },
  siw100g_m024: {
    title: 'SIW100G M024',
    subtitulo: 'Microinversor 2400 W — LANÇAMENTO',
    image: '/img/inversores/siw100g_m024.jpg',
    specs: {
      'Potência CA':       '2400 W',
      'Tensão da Rede':    '220 V monofásico',
      'Entradas CC':       '4 entradas (até 700 Wp cada)',
      'MPPT':              '4 MPPT individuais',
      'Proteção':          'IP67',
      'Comunicação':       'WiFi integrado',
      'Garantia':          '10 anos',
    },
    badges: ['IP67', 'WiFi', 'LANÇAMENTO'],
  },
  siw200g: {
    title: 'SIW200G W1',
    subtitulo: 'Inversor Monofásico 3–10,5 kW',
    image: '/img/inversores/siw200g_w1.jpg',
    specs: {
      'Potência CA':       '3 – 10,5 kW',
      'Tensão da Rede':    '220 V monofásico',
      'MPPT / Entradas':   '2–3 MPPT / 2–6 entradas',
      'Carregamento CC':   '150% (oversizing)',
      'Proteção':          'IP65 / IP66',
      'Comunicação':       'WiFi integrado',
      'Compatibilidade':   'Baterias e otimizadores',
    },
    badges: ['WiFi', 'IP66', '150% CC'],
  },
  siw300h: {
    title: 'SIW300H W00',
    subtitulo: 'Inversor Monofásico 3–10 kW',
    image: '/img/inversores/siw300h_w00.jpg',
    specs: {
      'Potência CA':       '3 – 10 kW',
      'Tensão da Rede':    '220 V monofásico',
      'MPPT':              'Múltiplos MPPT',
      'Proteção':          'IP65 / IP66',
      'Funções':           'AFCI, Rapid Shutdown',
      'Compatibilidade':   'Baterias WEG e otimizadores',
    },
    badges: ['AFCI', 'Rapid Shutdown', 'IP66'],
  },
  siw400g_s: {
    title: 'SIW400G W1',
    subtitulo: 'Inversor Trifásico 12–25 kW',
    image: '/img/inversores/siw400g_w1.jpg',
    specs: {
      'Potência CA':       '12 – 25 kW',
      'Tensão da Rede':    '380 V trifásico',
      'MPPT / Entradas':   '2 MPPT / 4 entradas CC',
      'Corrente por MPPT': '15 A',
      'Proteção':          'IP65',
      'Comunicação':       'WiFi integrado',
      'Funções':           'AFCI',
    },
    badges: ['AFCI', 'WiFi', 'Tri 380 V'],
  },
  siw400g_m: {
    title: 'SIW400G W00',
    subtitulo: 'Inversor Trifásico 15–37 kW',
    image: '/img/inversores/siw400g_w00.jpg',
    specs: {
      'Potência CA':       '15 – 37 kW',
      'Tensão da Rede':    '380 V trifásico',
      'MPPT / Entradas':   '4 MPPT / 8 entradas CC',
      'Corrente por MPPT': '40 A',
      'Proteção':          'IP66',
      'Comunicação':       'RS485 / WiFi',
      'Funções':           'AFCI, Rapid Shutdown',
    },
    badges: ['AFCI', 'IP66', '4 MPPT'],
  },
  siw400g_l: {
    title: 'SIW400G W1',
    subtitulo: 'Inversor Trifásico 75–100 kW',
    image: '/img/inversores/siw400g_large.jpg',
    specs: {
      'Potência CA':       '75 – 100 kW',
      'Tensão da Rede':    '380 V trifásico',
      'MPPT / Entradas':   '2 MPPT / 4 entradas CC',
      'Proteção':          'IP65',
      'Comunicação':       'RS485 / Ethernet',
    },
    badges: ['Tri 380 V', 'IP65'],
  },
  siw500h: {
    title: 'SIW500H',
    subtitulo: 'Inversor String Trifásico 20–100 kW',
    image: '/img/inversores/siw500h.jpg',
    specs: {
      'Potência CA':       '20 – 100 kW',
      'Tensão da Rede':    '220 / 380 V trifásico',
      'MPPT / Entradas':   '4–10 MPPT / 8–20 entradas CC',
      'Proteção':          'IP65 / IP66',
      'Comunicação':       'RS485 / WiFi / Ethernet',
    },
    badges: ['IP66', 'Multi-MPPT', 'String'],
  },
  siw610: {
    title: 'SIW610',
    subtitulo: 'Inversor String Trifásico 18–75 kW',
    image: '/img/inversores/siw610.jpg',
    specs: {
      'Potência CA':       '18 – 75 kW',
      'Tensão da Rede':    '220 / 380 V trifásico',
      'MPPT / Entradas':   '2–6 MPPT / 2–12 entradas CC',
      'Proteção':          'IP66',
      'Comunicação':       'RS485 / Ethernet',
      'Financiamento':     'FINAME / BNDES',
      'Origem':            'Fabricado no Brasil',
    },
    badges: ['FINAME', 'IP66', 'Made in Brazil'],
  },
  cfw500: {
    title: 'CFW500 Solar Drive',
    subtitulo: 'Inversor de Frequência para Bombeamento Solar',
    image: '/img/inversores/cfw500.jpg',
    specs: {
      'Potência':          '0,3 – 150 cv',
      'Modo':              'Híbrido (solar + rede) ou Off-grid',
      'Tensão da Rede':    '220 / 380 V',
      'Controle':          'Automático por tensão CC do painel',
      'Proteção':          'IP20 / IP55 (opcional)',
      'Compatibilidade':   'Bombas centrífugas e submersas',
    },
    badges: ['Híbrido', 'Off-grid', 'Bombeamento'],
  },
  siw200h: {
    title: 'SIW200H',
    subtitulo: 'Inversor Híbrido Monofásico',
    image: '/img/inversores/siw200h.jpg',
    specs: {
      'Tensão da Rede':    '220 V monofásico',
      'Modo':              'On-grid, Off-grid, Backup',
      'Compatibilidade':   'Baterias SBW WEG',
      'Comunicação':       'WiFi integrado',
    },
    badges: ['Híbrido', 'Backup', 'WiFi'],
  },
  siw400h: {
    title: 'SIW400H',
    subtitulo: 'Inversor Híbrido Trifásico',
    image: '/img/inversores/siw400h.jpg',
    specs: {
      'Tensão da Rede':    '380 V trifásico',
      'Modo':              'On-grid, Off-grid, Backup',
      'Compatibilidade':   'Baterias SBW WEG',
      'Comunicação':       'WiFi integrado',
    },
    badges: ['Híbrido', 'Backup', 'Tri 380 V'],
  },
  sbw_battery: {
    title: 'SBW — Baterias WEG',
    subtitulo: 'Armazenamento de Energia Solar',
    image: '/img/inversores/sbw_battery.jpg',
    specs: {
      'Modelos':           'CB050 / CB100 / SBW300',
      'Capacidade':        '5 – 30 kWh (expansível)',
      'Química':           'Lítio (LiFePO4)',
      'Compatibilidade':   'Inversores híbridos WEG SIW',
      'Proteção':          'BMS integrado',
    },
    badges: ['LiFePO4', 'BMS', 'Expansível'],
  },
}

/** Returns spec block for a product, or null if not found */
export function getInverterSpecs(product) {
  const nome = (product.nome || '').toLowerCase()
  const pot  = product.potencia || 0

  if (nome.includes('siw100g') && nome.includes('m010')) return SPECS.siw100g_m010
  if (nome.includes('siw100g') && nome.includes('m024')) return SPECS.siw100g_m024
  if (nome.includes('siw100'))                            return SPECS.siw100g_m010

  if (nome.includes('siw200h'))                           return SPECS.siw200h
  if (nome.includes('siw400h'))                           return SPECS.siw400h

  if (nome.includes('siw200'))                            return SPECS.siw200g
  if (nome.includes('siw300'))                            return SPECS.siw300h

  if (nome.includes('siw400')) {
    if (pot >= 75)  return SPECS.siw400g_l
    if (pot >= 15)  return SPECS.siw400g_m
    return SPECS.siw400g_s
  }
  if (nome.includes('siw420'))                            return SPECS.siw400g_m
  if (nome.includes('siw500'))                            return SPECS.siw500h
  if (nome.includes('siw610') || nome.includes('siw600')) return SPECS.siw610
  if (nome.includes('siw700') || nome.includes('siw750')) return SPECS.siw610

  if (nome.includes('cfw500'))                            return SPECS.cfw500

  if (nome.includes('sbw') || nome.includes('bateria') || nome.includes('battery'))
    return SPECS.sbw_battery

  return null
}
