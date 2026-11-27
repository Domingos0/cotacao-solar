import { describe, it, expect } from 'vitest'
import { buildWaLink, buildProposalMessage, buildShareMessage } from './whatsapp'

describe('buildWaLink', () => {
  it('completa o DDI 55 quando o telefone não tem', () => {
    expect(buildWaLink('94992090380', 'oi')).toBe('https://wa.me/5594992090380?text=oi')
  })
  it('não duplica o DDI quando o telefone já tem', () => {
    expect(buildWaLink('5594992090380', 'oi')).toBe('https://wa.me/5594992090380?text=oi')
  })
  it('remove caracteres não numéricos do telefone', () => {
    expect(buildWaLink('(94) 99209-0380', 'oi')).toBe('https://wa.me/5594992090380?text=oi')
  })
  it('sem telefone, ainda abre o wa.me genérico com a mensagem', () => {
    expect(buildWaLink('', 'oi')).toBe('https://wa.me/?text=oi')
  })
})

describe('buildProposalMessage', () => {
  it('inclui nome do cliente, kit, total e referência do orçamento', () => {
    const msg = buildProposalMessage({
      clienteNome: 'Maria', kitNome: 'Kit 8.12 kWp', totalFinal: 25000, numeroOrcamento: 'EFF-2026-001',
    })
    expect(msg).toContain('Maria')
    expect(msg).toContain('Kit 8.12 kWp')
    expect(msg).toContain('EFF-2026-001')
    expect(msg).toContain('25.000,00')
  })
  it('sem nome do cliente, usa saudação genérica', () => {
    expect(buildProposalMessage({ kitNome: 'Kit X', totalFinal: 100 })).toContain('Olá!')
  })
})

describe('buildShareMessage', () => {
  const proposal = {
    numero: 'EFF-2026-202', revisao: 1, titulo: 'Kit Solar 5,54 kWp', totalFinal: 19625.17,
    opcaoCartao: { parcelas: 6, valorParcela: 3470.06 }, cartao: [], validaAte: new Date(2026, 11, 4),
  }
  it('traz referência, total, opção de cartão, validade e o link', () => {
    const msg = buildShareMessage(proposal, { nome: 'Ana', link: 'https://x/minhas-cotacoes/1' })
    expect(msg).toContain('Olá, Ana!')
    expect(msg).toContain('EFF-2026-202 · Rev. 1')
    expect(msg).toContain('19.625,17')
    expect(msg).toContain('6x de R$')
    expect(msg).toContain('04/12/2026')
    expect(msg).toContain('https://x/minhas-cotacoes/1')
  })
  it('sem link, não mostra a linha do link', () => {
    expect(buildShareMessage(proposal)).not.toContain('🔗')
  })
})
