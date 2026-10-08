// Mesmos valores "reais" que o CRM usa hoje para motivo de perda
// (crm.propostas.motivo_perda — ver CRM/supabase/migrations/0022_motivo_perda_real.sql)
export const MOTIVOS_PERDA = [
  { value: 'preco',                label: 'Preço' },
  { value: 'restricao_tecnica',    label: 'Restrição técnica' },
  { value: 'atraso_faturamento',   label: 'Atraso no faturamento' },
  { value: 'falha_envio_proposta', label: 'Falha no envio da proposta' },
  { value: 'falta_followup_prazo', label: 'Falta de follow-up / prazo' },
  { value: 'cancelado',            label: 'Projeto cancelado' },
  { value: 'outro',                label: 'Outro' },
]
