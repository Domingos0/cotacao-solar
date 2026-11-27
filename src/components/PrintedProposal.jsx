// Proposta comercial — 2 páginas A4 no layout de design/design-ernaniff/imagens/
// Proposta_Main.png e Proposta_Pagina2.png. Componente único usado tanto pra
// imprimir quanto pra gerar o PDF do WhatsApp; recebe o objeto pronto de
// buildProposal (lib/proposal.js). Estilos inline de propósito: o html2canvas
// e a impressão precisam render idêntico, sem depender de classes do Tailwind.
import { useState } from 'react'
import { getProductImage, guessCategoria } from '../data/productImages'

const MARCA = '#16307A'
const LARANJA = '#F07D00'
const MARROM = '#8A4300'
const FUNDO_SUAVE = '#EEF2FA'
const BORDA = '#E2E8F0'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')
const fmtPct = v => `${(v * 100).toFixed(2).replace('.', ',')}%`

const rotulo = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748B', margin: 0 }
const p0 = { margin: 0 }

function Thumb({ label, produto }) {
  const [err, setErr] = useState(false)
  const nome = `${label || ''} ${produto || ''}`.trim()
  const src = getProductImage({ nome, categoria: guessCategoria(label) })
  return (
    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {src && !err
        ? <img src={src} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3, boxSizing: 'border-box' }} onError={() => setErr(true)} />
        : <span style={{ fontSize: 14 }}>📦</span>}
    </div>
  )
}

function Pagina({ children }) {
  return (
    <section
      className="proposta-pagina"
      style={{ width: 794, minHeight: 1123, background: 'white', color: '#0F172A', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", boxSizing: 'border-box' }}
    >
      {children}
    </section>
  )
}

function Rodape({ esquerda, pagina }) {
  return (
    <div style={{ marginTop: 'auto', borderTop: `1px solid ${BORDA}`, padding: '14px 48px', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
      <span>{esquerda}</span>
      <span>Página {pagina} de 2</span>
    </div>
  )
}

const th = { padding: '7px 8px', fontSize: 9.5, letterSpacing: '0.1em', fontWeight: 700 }
const linhaTot = { display: 'flex', justifyContent: 'space-between', padding: '3px 0' }

export default function PrintedProposal({ proposal: p }) {
  const ref = p.numero ? `${p.numero} · Rev. ${p.revisao || 0}` : null
  const cliente = p.cliente || {}
  const local = [cliente.cidade, cliente.uf].filter(Boolean).join(' / ')
  const opc = p.opcaoCartao
  const doze = p.cartao[p.cartao.length - 1]
  const textoFormaEscolhida = opc ? `Cartão ${opc.parcelas}x de ${fmt(opc.valorParcela)}` : `À vista ${fmt(p.totalFinal)}`
  const clienteMaiusc = cliente.nome ? cliente.nome.toUpperCase() : ''

  return (
    <div className="proposta">
      {/* ══════════════ PÁGINA 1 ══════════════ */}
      <Pagina>
        <div style={{ background: MARCA, color: 'white', padding: '26px 48px', display: 'flex', alignItems: 'center', gap: 22 }}>
          <img src="/logo-ernaniff-branco.png" alt="Ernaniff" style={{ height: 52, objectFit: 'contain' }} />
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...p0, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', opacity: 0.85 }}>{p.descontoPacote || p.kitsUnificados?.length ? 'PROPOSTA UNIFICADA' : 'PROPOSTA COMERCIAL'}</p>
            <p style={{ ...p0, fontSize: 22, fontWeight: 800, lineHeight: 1.25, margin: '2px 0' }}>{p.titulo}</p>
            {ref && <p style={{ ...p0, fontSize: 11.5, opacity: 0.85 }}>Ref. {ref}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, lineHeight: 1.7 }}>
            <p style={p0}>Emitida em <strong>{fmtData(p.emitidaEm)}</strong></p>
            <p style={p0}>Válida até <strong>{fmtData(p.validaAte)}</strong></p>
            {p.listaNome && <p style={{ ...p0, opacity: 0.85 }}>{p.listaNome}</p>}
          </div>
        </div>

        <div style={{ padding: '22px 48px 18px' }}>
          {/* Cliente + Entrega */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, padding: '13px 16px' }}>
              <p style={rotulo}>Cliente</p>
              <p style={{ ...p0, fontSize: 15, fontWeight: 800, marginTop: 4 }}>{clienteMaiusc || '—'}</p>
              {(cliente.empresa || cliente.cnpj) && (
                <p style={{ ...p0, fontSize: 11, color: '#475569' }}>{[cliente.empresa, cliente.cnpj && `CNPJ ${cliente.cnpj}`].filter(Boolean).join(' · ')}</p>
              )}
              {local && <p style={{ ...p0, fontSize: 11, color: '#475569' }}>{local}</p>}
              {p.referenciaCliente && <p style={{ ...p0, fontSize: 11, color: '#475569' }}>Cliente final: <strong>{p.referenciaCliente}</strong></p>}
            </div>
            <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, padding: '13px 16px' }}>
              <p style={rotulo}>Entrega e atendimento</p>
              {p.freteNome && <p style={{ ...p0, fontSize: 11.5, color: '#475569', marginTop: 4 }}>Frete: <strong style={{ color: '#0F172A' }}>{p.freteNome}</strong></p>}
              {p.consultor && <p style={{ ...p0, fontSize: 11.5, color: '#475569' }}>Consultor: <strong style={{ color: '#0F172A' }}>{p.consultor}</strong></p>}
              <p style={{ ...p0, fontSize: 11.5, color: '#475569', marginTop: p.freteNome || p.consultor ? 0 : 4 }}>(94) 9209-0380 · vendas@ernaniff.com.br</p>
            </div>
          </div>

          {/* Quadros de resumo */}
          {p.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.stats.length}, 1fr)`, gap: 10, marginTop: 12 }}>
              {p.stats.map(s => (
                <div key={s.label} style={{ background: FUNDO_SUAVE, borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ ...p0, fontSize: 10, color: '#475569' }}>{s.label}</p>
                  <p style={{ ...p0, fontSize: 15, fontWeight: 800, color: MARCA }}>{s.valor}</p>
                </div>
              ))}
            </div>
          )}

          {/* Proposta unificada: quais cotações entraram */}
          {p.kitsUnificados?.length > 0 && (
            <>
              <p style={{ ...p0, fontSize: 12, fontWeight: 800, color: MARCA, margin: '18px 0 6px', letterSpacing: '0.04em' }}>KITS INCLUÍDOS NESTA PROPOSTA</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {p.kitsUnificados.map(k => (
                    <tr key={k.numero} style={{ borderBottom: `1px solid ${BORDA}` }}>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 800, color: MARCA }}>
                        {k.numero}{k.revisao ? ` · Rev. ${k.revisao}` : ''}
                      </td>
                      <td style={{ padding: '6px 8px', color: '#334155' }}>
                        {k.resumo}
                        {k.referencia && <span style={{ color: '#64748B' }}> · cliente final: {k.referencia}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{fmt(k.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Itens */}
          <p style={{ ...p0, fontSize: 12, fontWeight: 800, color: MARCA, margin: '18px 0 6px', letterSpacing: '0.04em' }}>
            {p.kitsUnificados?.length > 0 ? 'MATERIAIS CONSOLIDADOS (SOMADOS POR SAP)' : 'ITENS DO KIT'}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: MARCA, color: 'white' }}>
                <th style={{ ...th, textAlign: 'left', width: 24 }}>#</th>
                <th style={{ width: 42 }} />
                <th style={{ ...th, textAlign: 'left' }}>PRODUTO / CÓDIGO SAP</th>
                <th style={{ ...th, textAlign: 'right', whiteSpace: 'nowrap' }}>QTD</th>
                <th style={{ ...th, textAlign: 'right' }}>UNIT.</th>
                <th style={{ ...th, textAlign: 'right' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {p.itens.map((it, i) => {
                const ehEstrutura = /estrutura|fixação|fixacao/i.test(it.label || '')
                const temSap = it.codigo_sap && it.codigo_sap !== '—'
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDA}` }}>
                    <td style={{ padding: '6px 8px', color: '#475569' }}>{i + 1}</td>
                    <td style={{ padding: '4px 0' }}><Thumb label={it.label} produto={it.produto} /></td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontWeight: 700 }}>{it.label}</span>
                      {it.produto && it.produto !== it.label && <span> · {it.produto}</span>}
                      {(temSap || (ehEstrutura && p.estrutura)) && (
                        <p style={{ ...p0, fontSize: 9.5, color: '#64748B' }}>
                          {[temSap && `SAP ${it.codigo_sap}`, ehEstrutura && p.estrutura && 'composição na página 2'].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{it.qty} {it.unit || ''}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{it.preco_unit != null ? fmt(it.preco_unit) : 'Sob consulta'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{it.total != null ? fmt(it.total) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Subtotais */}
          <div style={{ marginLeft: 'auto', width: 320, marginTop: 10, fontSize: 11.5, color: '#475569' }}>
            {p.descontoPacote ? (
              <>
                <div style={linhaTot}><span>Subtotal dos kits</span><span>{fmt(p.descontoPacote.bruto)}</span></div>
                <div style={{ ...linhaTot, color: '#15803D' }}><span>Desconto do pacote ({p.descontoPacote.pct}%)</span><span>−{fmt(p.descontoPacote.bruto - p.totalFinal)}</span></div>
              </>
            ) : (
              <div style={linhaTot}><span>Subtotal dos itens</span><span>{fmt(p.totalFinal)}</span></div>
            )}
            {p.freteNome && (
              <div style={{ ...linhaTot, borderBottom: `1px solid ${BORDA}` }}>
                <span>Frete {String(p.freteNome).split(/[–-]/)[0].trim()}</span><span>incluso nos itens</span>
              </div>
            )}
          </div>

          {/* Total à vista */}
          <div style={{ background: MARCA, color: 'white', borderRadius: 14, padding: '16px 24px', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ ...p0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', opacity: 0.85 }}>TOTAL À VISTA</p>
              <p style={{ ...p0, fontSize: 11.5, opacity: 0.85 }}>PIX, boleto ou transferência</p>
            </div>
            <p style={{ ...p0, fontSize: 28, fontWeight: 900 }}>{fmt(p.totalFinal)}</p>
          </div>

          {/* Cartão */}
          <div style={{ border: `1.5px solid ${LARANJA}`, background: '#FFF7ED', borderRadius: 12, padding: '10px 20px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 11.5, color: MARROM }}>
            <span>
              <strong>Ou no cartão em até 12x</strong>
              {opc
                ? <> · opção escolhida: <strong>{opc.parcelas}x de {fmt(opc.valorParcela)}</strong></>
                : <> · a partir de <strong>12x de {fmt(doze.valorParcela)}</strong></>}
            </span>
            <strong style={{ whiteSpace: 'nowrap' }}>Tabela completa na página 2 →</strong>
          </div>
        </div>

        <Rodape esquerda="Ernaniff Representações · Representante WEG Energia Solar · Marabá – PA" pagina={1} />
      </Pagina>

      {/* ══════════════ PÁGINA 2 ══════════════ */}
      <Pagina>
        <div style={{ padding: '22px 48px 16px', borderBottom: `4px solid ${MARCA}`, display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src="/logo-ernaniff-horizontal.png" alt="Ernaniff" style={{ height: 42, objectFit: 'contain' }} />
          <p style={{ ...p0, fontSize: 13, fontWeight: 800, color: MARCA, flex: 1 }}>{ref ? `Proposta ${ref}` : p.titulo}</p>
          <p style={{ ...p0, fontSize: 10.5, color: '#64748B', textAlign: 'right' }}>
            {[clienteMaiusc, p.titulo, `válida até ${fmtData(p.validaAte)}`].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div style={{ padding: '18px 48px 18px' }}>
          <p style={{ ...p0, fontSize: 12, fontWeight: 800, color: MARCA, letterSpacing: '0.04em', marginBottom: 8 }}>FORMAS DE PAGAMENTO</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ border: `1.5px solid ${MARCA}`, borderRadius: 12, padding: '13px 16px' }}>
              <p style={{ ...rotulo, color: MARCA }}>À vista · {opc ? 'melhor preço' : 'opção escolhida'}</p>
              <p style={{ ...p0, fontSize: 22, fontWeight: 900, marginTop: 2 }}>{fmt(p.totalFinal)}</p>
              <p style={{ ...p0, fontSize: 10.5, color: '#475569' }}>PIX, boleto ou transferência na confirmação do pedido</p>
            </div>
            <div style={{ border: `1.5px solid ${LARANJA}`, background: '#FFF7ED', borderRadius: 12, padding: '13px 16px', color: MARROM }}>
              <p style={{ ...rotulo, color: '#C2570C' }}>Cartão · {opc ? 'opção escolhida' : 'parcelado'}</p>
              {opc ? (
                <>
                  <p style={{ ...p0, fontSize: 22, fontWeight: 900, marginTop: 2 }}>{opc.parcelas}x de {fmt(opc.valorParcela)}</p>
                  <p style={{ ...p0, fontSize: 10.5 }}>Total no cartão {fmt(opc.total)} (acréscimo de {fmtPct(opc.pct)})</p>
                </>
              ) : (
                <>
                  <p style={{ ...p0, fontSize: 22, fontWeight: 900, marginTop: 2 }}>até 12x de {fmt(doze.valorParcela)}</p>
                  <p style={{ ...p0, fontSize: 10.5 }}>Veja todas as opções na tabela abaixo</p>
                </>
              )}
            </div>
          </div>

          <p style={{ ...p0, fontSize: 11.5, fontWeight: 700, color: '#334155', margin: '14px 0 6px' }}>Simulação no cartão de crédito (sobre o total à vista)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: MARCA, color: 'white' }}>
                <th style={{ ...th, textAlign: 'left', padding: '7px 10px' }}>PARCELAS</th>
                <th style={{ ...th, textAlign: 'left', padding: '7px 10px' }}>VENCIMENTOS</th>
                <th style={{ ...th, textAlign: 'right', padding: '7px 10px' }}>ACRÉSCIMO</th>
                <th style={{ ...th, textAlign: 'right', padding: '7px 10px' }}>VALOR DA PARCELA</th>
                <th style={{ ...th, textAlign: 'right', padding: '7px 10px' }}>TOTAL NO CARTÃO</th>
              </tr>
            </thead>
            <tbody>
              {p.cartao.map(c => (
                <tr key={c.parcelas} style={{ borderBottom: `1px solid ${BORDA}`, background: c.escolhida ? '#FDF1E3' : 'white', color: c.escolhida ? MARROM : '#0F172A', fontWeight: c.escolhida ? 700 : 400 }}>
                  <td style={{ padding: '5px 10px', fontWeight: 700 }}>{c.parcelas}x{c.escolhida ? ' ★' : ''}</td>
                  <td style={{ padding: '5px 10px', color: c.escolhida ? MARROM : '#64748B' }}>{c.parcelas === 1 ? '30 dias' : `30 a ${c.parcelas * 30} dias`}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmtPct(c.pct)}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.valorParcela)}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...p0, fontSize: 9.5, color: '#64748B', marginTop: 4 }}>Parcelamento sujeito à aprovação da operadora. Acréscimo conforme tabela vigente de custos do cartão de crédito.</p>

          {p.estrutura && (
            <>
              <p style={{ ...p0, fontSize: 11.5, fontWeight: 700, color: '#334155', margin: '14px 0 4px' }}>Composição da estrutura de fixação · {p.estrutura.nome}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {p.estrutura.componentes.map(c => (
                    <tr key={c.sap} style={{ borderBottom: `1px solid ${BORDA}` }}>
                      <td style={{ padding: '5px 10px' }}>{c.descricao}</td>
                      <td style={{ padding: '5px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>SAP {c.sap}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.qty} un</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(p.condicoes || p.obs) && (
            <div style={{ background: FUNDO_SUAVE, borderRadius: 12, padding: '12px 18px', marginTop: 14, fontSize: 10.5, color: '#334155', lineHeight: 1.6 }}>
              {p.condicoes && <p style={{ ...p0, whiteSpace: 'pre-line' }}><strong style={{ color: MARCA }}>Condições comerciais: </strong>{p.condicoes}</p>}
              {p.obs && <p style={{ ...p0, whiteSpace: 'pre-line', marginTop: p.condicoes ? 6 : 0 }}><strong style={{ color: MARCA }}>Observações: </strong>{p.obs}</p>}
            </div>
          )}

          <p style={{ ...p0, fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 18 }}>
            Aceite da proposta · forma de pagamento: <span style={{ color: MARROM }}>{textoFormaEscolhida}</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 42, fontSize: 11, color: '#475569' }}>
            <div style={{ borderTop: '1px solid #94A3B8', paddingTop: 6 }}>
              <p style={p0}>{[clienteMaiusc, cliente.empresa && cliente.empresa.toUpperCase()].filter(Boolean).join(' · ') || 'Cliente'}</p>
              <p style={p0}>Data: ____/____/______</p>
            </div>
            <div style={{ borderTop: '1px solid #94A3B8', paddingTop: 6 }}>
              <p style={p0}>Ernaniff Representações</p>
              {p.consultor && <p style={p0}>{p.consultor}</p>}
            </div>
          </div>
        </div>

        <Rodape esquerda="(94) 9209-0380 · vendas@ernaniff.com.br · ernaniffsolar.online" pagina={2} />
      </Pagina>
    </div>
  )
}
