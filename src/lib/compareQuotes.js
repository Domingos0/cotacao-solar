// Item 37: comparar 2 ou 3 cotações (kits diferentes, não revisões da mesma
// cotação — isso já existe no item 34/diffRevisions) lado a lado. Extrai só
// os campos relevantes pra comparação, sem acoplar a nenhum componente.
import { valorParcela } from './payment'

export function extractQuoteSummary(quote) {
  const kitData = quote.data || {}
  const items = quote.quote_items || quote.items || []
  const modulo = items.find(i => /módulo|painel/i.test(i.label || ''))
  const inversor = items.find(i => /inversor|micro/i.test(i.label || ''))
  const formaPagamento = kitData.formaPagamento || 'avista'
  const parcelas = kitData.parcelasCartao || null

  return {
    id: quote.id,
    numero: kitData.numero_orcamento || (quote.id ? quote.id.slice(0, 8).toUpperCase() : '—'),
    cliente: kitData.clienteNome || '—',
    kwp: quote.kwp || null,
    modulo: modulo ? `${modulo.qty}× ${modulo.produto}` : '—',
    inversor: inversor ? `${inversor.qty}× ${inversor.produto}` : '—',
    moduloItem: modulo ? { label: modulo.label, produto: modulo.produto } : null,
    inversorItem: inversor ? { label: inversor.label, produto: inversor.produto } : null,
    totalFinal: quote.total_final || 0,
    formaPagamento,
    parcelas,
    valorParcela: formaPagamento === 'cartao' && parcelas ? valorParcela(quote.total_final || 0, parcelas) : null,
    frete: quote.frete_nome || '—',
    validade: quote.valid_until || null,
    status: quote.status,
  }
}
