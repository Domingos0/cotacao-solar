-- ============================================================
-- Remove de vez a unique index em price_catalog_products
-- ============================================================
-- Contexto: a migração anterior (20261118120000) trocou a constraint
-- `unique(version_id, codigo)` por uma mais permissiva, `unique(version_id,
-- codigo, nome)`, pra permitir o caso legítimo de SAP compartilhado entre
-- produtos com nomes diferentes (ex: estruturas Solo). Mas a planilha real
-- tem linhas genuinamente duplicadas — mesmo SAP E mesmo nome (ex: um
-- produto listado tanto em "Estruturas Metálicas" quanto em "Estruturas –
-- Componentes Avulsos") — e o erro "duplicate key" voltou a acontecer,
-- agora na nova constraint.
--
-- replace_catalog_products() já apaga TODAS as linhas da versão e
-- reinsere a lista completa a cada import — não existe nenhuma regra de
-- negócio real que exija um produto único por SAP (nem por SAP+nome)
-- dentro de uma versão; o `id` (uuid, chave primária) já identifica cada
-- linha. Remove a restrição de vez, em vez de tentar adivinhar outra
-- combinação de colunas "única o suficiente".

drop index if exists public.price_catalog_products_version_codigo_nome_idx;
alter table public.price_catalog_products
  drop constraint if exists price_catalog_products_version_id_codigo_key;
