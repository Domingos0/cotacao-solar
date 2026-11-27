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
