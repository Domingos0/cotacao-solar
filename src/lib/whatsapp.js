// Item 29: enviar proposta por WhatsApp. O link de click-to-chat do
// WhatsApp (wa.me) só aceita texto pré-preenchido — não existe jeito de
// anexar um arquivo via URL. O PDF vai pelo ProposalOutput: no celular pelo
// menu nativo de compartilhar (arquivo + esta mensagem juntos); no computador
// o PDF é baixado e a conversa abre aqui com a mensagem pronta.

export function buildWaLink(phone, message) {
  const digits = (phone || '').replace(/\D/g, '')
  const withDdi = digits && digits.length <= 11 ? `55${digits}` : digits
  const base = withDdi ? `https://wa.me/${withDdi}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(message || '')}`
}

export function buildProposalMessage({ clienteNome, kitNome, totalFinal, numeroOrcamento }) {
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const saudacao = clienteNome ? `Olá, ${clienteNome}!` : 'Olá!'
  const ref = numeroOrcamento ? ` *${numeroOrcamento}*` : ''
  return `${saudacao} 👋\n\nSegue a proposta${ref} do kit *${kitNome}*, no valor de *${fmt(totalFinal)}*.\n\n📎 O PDF com a proposta completa (itens, formas de pagamento e condições) segue em anexo.\n\nQualquer dúvida, é só chamar!`
}

// Mensagem que vai junto com o PDF da proposta (texto do compartilhamento /
// wa.me). Monta tudo a partir do objeto da proposta (lib/proposal.js) pra
// bater exatamente com o que está no PDF. `link` (cotação no portal) só faz
// sentido quando quem recebe é o dono da cotação — quem chama decide.
export function buildShareMessage(proposal, { nome = '', link = '' } = {}) {
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const p = proposal || {}
  const ref = p.numero ? ` *${p.numero}${p.revisao ? ` · Rev. ${p.revisao}` : ''}*` : ''
  const linhas = [
    `${nome ? `Olá, ${nome}!` : 'Olá!'} 👋`,
    '',
    `Segue a proposta${ref} — *${p.titulo || 'Kit Solar'}*.`,
    '',
    `💰 À vista: *${fmt(p.totalFinal)}*`,
  ]
  if (p.opcaoCartao) {
    linhas.push(`💳 Cartão: *${p.opcaoCartao.parcelas}x de ${fmt(p.opcaoCartao.valorParcela)}*`)
  } else if (p.cartao?.length) {
    const ultima = p.cartao[p.cartao.length - 1]
    linhas.push(`💳 Ou em até ${ultima.parcelas}x de ${fmt(ultima.valorParcela)} no cartão`)
  }
  if (p.validaAte) linhas.push(`📅 Válida até ${new Date(p.validaAte).toLocaleDateString('pt-BR')}`)
  linhas.push('', '📎 O PDF com todos os itens, formas de pagamento e condições segue em anexo.')
  if (link) linhas.push(`🔗 Acesse a cotação online: ${link}`)
  linhas.push('', 'Qualquer dúvida, é só chamar!', 'Ernaniff Representações · (94) 9209-0380')
  return linhas.join('\n')
}
