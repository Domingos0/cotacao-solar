// Proposta comercial impressa/PDF (layout de design/imagens/Proposta_*.png).
// Uma função só monta tudo que as 2 páginas precisam — antes cada tela
// (Monte seu Kit, Minhas Cotações, revisões, Admin, proposta unificada) tinha
// a própria cópia do layout de impressão e do cálculo dos valores por linha,
// e elas já tinham divergido entre si.
import { round2, distributeTotal } from './money'
import { CARTAO_PARCELAS, totalComCartao, valorParcela } from './payment'
import kitCompositions from '../data/kitCompositions.json'
import { parseLocalDate } from './dates'

const VALIDADE_PADRAO_DIAS = 7

// kWh por unidade de cada bateria (mesmos valores do passo Baterias do Monte seu Kit)
const BAT_KWH = { CB050: 5.02, CB100: 10.07, 'SBW200 CB057': 5.76, 'SBW200 CB115': 11.52 }
const SBW300_KWH_POR_GRUPO = 6.9
const SBW400_KWH_POR_MODULO = 16.07

const isHybridInv = inv => /SIW\d*H/i.test(inv?.modelo || inv?.nome || '')
const fmtNum = (v, dec = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec })

export function statsFromKitData(kitData = {}, kwpFallback = null) {
  const stats = []
  const panel = kitData.panel
  const panelQty = kitData.panelQty || 1
  const kwp = panel ? (panelQty * (panel.potencia || 0)) / 1000 : Number(kwpFallback) || 0
  if (kwp > 0) stats.push({ label: 'Potência', valor: `${fmtNum(kwp)} kWp` })
  if (panel?.potencia) stats.push({ label: 'Módulos', valor: `${panelQty} × ${fmtNum(panel.potencia, 0)} Wp` })

  const invs = Array.isArray(kitData.inverters) && kitData.inverters.length
    ? kitData.inverters
    : kitData.inverter ? [{ inverter: kitData.inverter, qty: kitData.inverterQty || 1 }] : []
  if (invs.length) {
    const hibrido = invs.some(i => isHybridInv(i.inverter))
    const texto = invs.map(({ inverter, qty }) => `${qty > 1 ? `${qty}× ` : ''}${fmtNum(inverter?.potencia)} kW`).join(' + ')
    stats.push({ label: 'Inversor', valor: `${texto}${hibrido ? ' híbrido' : ''}` })
  }

  if (kitData.wantsBattery) {
    let kwh = 0
    if (kitData.batEco === 'CB') kwh = (BAT_KWH[kitData.batType] || 0) * (kitData.batQty || 0)
    else if (kitData.batEco === 'SBW300') kwh = SBW300_KWH_POR_GRUPO * (kitData.sbwGroups || 0)
    else if (kitData.batEco === 'SBW400') kwh = SBW400_KWH_POR_MODULO * (kitData.sbw400ModQty || 0)
    if (kwh > 0) stats.push({ label: 'Bateria', valor: `${fmtNum(kwh, 1)} kWh` })
  }
  return { kwp: round2(kwp), stats }
}

export function structureFromKitData(kitData = {}) {
  if (!kitData.wantsEstrutura) return null
  const kits = [
    kitData.estruturaKit && (kitData.estruturaQty || 0) > 0 ? { kit: kitData.estruturaKit, qty: kitData.estruturaQty } : null,
    kitData.estruturaKit3 && (kitData.estruturaQty3 || 0) > 0 ? { kit: kitData.estruturaKit3, qty: kitData.estruturaQty3 } : null,
  ].filter(Boolean)
  if (!kits.length) return null
  const merged = {}
  kits.forEach(({ kit, qty }) => {
    ;(kitCompositions[kit.codigo] || []).forEach(c => {
      if (merged[c.sap]) merged[c.sap].qty += c.qty * qty
      else merged[c.sap] = { sap: c.sap, descricao: c.descricao, qty: c.qty * qty }
    })
  })
  const componentes = Object.values(merged)
  if (!componentes.length) return null
  return { nome: kits.map(k => k.kit.nome).join(' + '), componentes }
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Itens chegam com preço de tabela (preco_unit/total "brutos", como ficam em
// quote_items). O total final já inclui ajustes, desconto e frete — aplica o
// mesmo fator em cada linha e joga o resíduo de arredondamento na última
// linha com preço, pra soma das linhas bater exatamente com o total.
export function adjustItems(items, totalFinal) {
  const brutos = (items || []).map(it => (it.total != null ? it.total : (it.preco_unit || 0) * (it.qty || 0)))
  const somaBruta = brutos.reduce((s, v) => s + (v || 0), 0)
  const ratio = somaBruta ? (totalFinal || 0) / somaBruta : 1
  const totais = distributeTotal(
    (items || []).map((it, i) => (it.preco_unit ? brutos[i] * ratio : null)),
    totalFinal || 0
  )
  return (items || []).map((it, i) => ({
    label: it.label,
    produto: it.produto,
    codigo_sap: it.codigo_sap,
    qty: it.qty,
    unit: it.unit,
    preco_unit: it.preco_unit ? round2(it.preco_unit * ratio) : null,
    total: totais[i],
  }))
}

export function buildProposal({
  numero = null, revisao = 0, emitidaEm = new Date(), validaAte = null, listaNome = '',
  cliente = {}, referenciaCliente = '', freteNome = '', consultor = '',
  kitData = {}, kwp = null, titulo = null,
  items = [], totalFinal = 0, formaPagamento = 'avista', parcelas = null,
  condicoes = '', obs = '', descontoPacote = null,
  estrutura = undefined, kitsUnificados = null, stats: statsOverride = null,
} = {}) {
  const { kwp: kwpCalc, stats: statsKit } = statsFromKitData(kitData, kwp)
  const stats = statsOverride || statsKit
  const emitida = new Date(emitidaEm || Date.now())
  const validade = validaAte ? parseLocalDate(validaAte) : addDays(emitida, VALIDADE_PADRAO_DIAS)
  const forma = formaPagamento === 'cartao' ? 'cartao' : 'avista'
  const parcelasEscolhidas = forma === 'cartao' ? (parcelas || 1) : null

  const cartao = CARTAO_PARCELAS.map(o => ({
    parcelas: o.parcelas,
    pct: o.pct,
    valorParcela: valorParcela(totalFinal, o.parcelas),
    total: totalComCartao(totalFinal, o.parcelas),
    escolhida: o.parcelas === parcelasEscolhidas,
  }))
  const opcaoCartao = cartao.find(c => c.escolhida) || null

  return {
    titulo: titulo || (kwpCalc > 0 ? `Kit Solar ${fmtNum(kwpCalc)} kWp` : 'Kit Solar'),
    numero, revisao: revisao || 0,
    emitidaEm: emitida, validaAte: validade, listaNome,
    cliente, referenciaCliente, freteNome, consultor,
    stats, kwp: kwpCalc,
    itens: adjustItems(items, totalFinal),
    totalFinal: round2(totalFinal),
    descontoPacote,
    formaPagamento: forma,
    cartao, opcaoCartao,
    estrutura: estrutura !== undefined ? estrutura : structureFromKitData(kitData),
    kitsUnificados,
    condicoes, obs,
  }
}

// Soma a composição de estrutura de vários kits (mesmo SAP → qtd somada)
export function mergeStructures(list) {
  const validas = (list || []).filter(Boolean)
  if (!validas.length) return null
  const merged = {}
  validas.forEach(e => e.componentes.forEach(c => {
    if (merged[c.sap]) merged[c.sap].qty += c.qty
    else merged[c.sap] = { ...c }
  }))
  const nomes = [...new Set(validas.flatMap(e => e.nome.split(' + ')))]
  return { nome: nomes.join(' + '), componentes: Object.values(merged) }
}

// Proposta unificada (item 35): várias cotações do mesmo cliente viram uma
// proposta só — materiais somados por SAP, estrutura somada, e a lista dos
// kits que entraram (número, resumo, valor de cada um).
export function proposalFromUnified(quotes, unified, { ownerProfile, tableInfo, condicoes } = {}) {
  const qs = quotes || []
  const dono = qs[0]?.profiles || ownerProfile || {}
  const kd0 = qs[0]?.data || {}
  const kitsUnificados = qs.map(q => {
    const kd = q.data || {}
    const { stats } = statsFromKitData(kd, q.kwp)
    const resumo = stats.map(s => s.valor).join(' · ')
    return {
      numero: kd.numero_orcamento || String(q.id).slice(0, 8).toUpperCase(),
      revisao: kd.revisao || 0,
      resumo: resumo || `${fmtNum(q.kwp)} kWp`,
      referencia: kd.clienteNome && kd.clienteNome !== dono.nome ? kd.clienteNome : '',
      total: round2(q.total_final || 0),
    }
  })
  const referencias = [...new Set(kitsUnificados.map(k => k.referencia).filter(Boolean))]
  return buildProposal({
    titulo: `${qs.length} kits · ${fmtNum(unified.totalKwp)} kWp`,
    validaAte: unified.validadeMinima,
    listaNome: tableInfo?.nome || '',
    cliente: { nome: dono.nome, empresa: dono.empresa, cnpj: dono.cnpj, cidade: kd0.clienteCidade, uf: kd0.clienteUF },
    referenciaCliente: referencias.join(', '),
    freteNome: [...new Set(qs.map(q => q.frete_nome).filter(Boolean))].join(' / '),
    consultor: kd0.criadoPorAdminNome || '',
    kwp: unified.totalKwp,
    stats: [
      { label: 'Potência total', valor: `${fmtNum(unified.totalKwp)} kWp` },
      { label: 'Kits unificados', valor: String(qs.length) },
      { label: 'Itens', valor: String(unified.materiais.length) },
    ],
    items: unified.materiais,
    totalFinal: unified.totalComDesconto,
    descontoPacote: unified.descontoPct > 0 ? { pct: unified.descontoPct, bruto: unified.totalBruto } : null,
    estrutura: mergeStructures(qs.map(q => structureFromKitData(q.data || {}))),
    kitsUnificados,
    condicoes,
  })
}

// Cotação salva (ou uma revisão dela) → entrada do buildProposal. Usado por
// Minhas Cotações e pelo Admin, que leem do banco e não do estado do Monte seu Kit.
export function proposalFromQuote(quote, { ownerProfile, tableInfo, condicoes, revision } = {}) {
  const kitData = quote.data || quote.kit_data || {}
  const profile = ownerProfile || quote.profiles || {}
  const items = revision ? (revision.items || []) : (quote.quote_items || [])
  return buildProposal({
    numero: kitData.numero_orcamento || null,
    revisao: revision ? revision.revisao : (kitData.revisao || 0),
    emitidaEm: revision ? revision.data : (quote.updated_at || quote.created_at),
    validaAte: revision ? null : quote.valid_until,
    listaNome: tableInfo?.nome || '',
    cliente: {
      nome: profile.nome, empresa: profile.empresa, cnpj: profile.cnpj,
      cidade: kitData.clienteCidade, uf: kitData.clienteUF,
    },
    // clienteNome é o cliente final do integrador — se for o próprio dono
    // (cotação feita pelo admin pra cliente cadastrado), não repete.
    referenciaCliente: kitData.clienteNome && kitData.clienteNome !== profile.nome ? kitData.clienteNome : '',
    freteNome: revision ? revision.frete : quote.frete_nome,
    consultor: kitData.criadoPorAdminNome || '',
    kitData, kwp: quote.kwp,
    items,
    totalFinal: revision ? revision.total_final : quote.total_final,
    formaPagamento: kitData.formaPagamento, parcelas: kitData.parcelasCartao,
    condicoes, obs: kitData.proposta?.obs || '',
  })
}

export function proposalFileName(proposal) {
  const ref = proposal.numero ? `${proposal.numero}${proposal.revisao ? `-R${proposal.revisao}` : ''}` : 'Kit'
  return `Proposta ${ref}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
}
