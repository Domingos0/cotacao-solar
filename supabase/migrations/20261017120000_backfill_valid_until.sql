-- ============================================================
-- Backfill de valid_until para cotações antigas
-- ============================================================
-- Contexto: a coluna quotes.valid_until só passou a ser preenchida a
-- partir da migração 20261007190004 (quote_versioning_validity_audit),
-- e só no momento em que a cotação é salva/revisada via
-- save_quote_with_items. Cotações criadas antes disso (ou que nunca
-- foram resalvas desde então) ficaram com valid_until = null, então a
-- badge "Vencida" nunca aparece pra elas mesmo estando com meses de
-- atraso. Esse backfill corrige os registros existentes, usando os
-- mesmos 7 dias de validade padrão que a função sempre usou como
-- fallback (coalesce(validity_days, 7)).

update public.quotes
set valid_until = (created_at::date + 7)
where valid_until is null;
