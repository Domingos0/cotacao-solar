-- ============================================================
-- Corrige unique constraint errada em price_catalog_products
-- ============================================================
-- Contexto: a migração original (20261007190000) criou
-- price_catalog_products com `unique (version_id, codigo)` — assumindo
-- um produto por código SAP por versão. Isso está errado pro domínio
-- real: estruturas Solo, por exemplo, têm várias dezenas de linhas
-- compartilhando o MESMO código SAP (ex: 15288210), uma pra cada
-- combinação de módulo/marca de referência — o próprio código de
-- importação (AdminPage.jsx) já trata isso explicitamente, casando por
-- "SAP + nome" em vez de só SAP (ver comentário "SAP duplicado... →
-- match por SAP+nome").
--
-- Na prática, isso fazia replace_catalog_products() falhar com
-- "duplicate key value violates unique constraint
-- price_catalog_products_version_id_codigo_key" toda vez que o admin
-- importava "Substituir catálogo completo" (que manda a lista inteira,
-- incluindo essas variantes de Solo com SAP repetido). Como o front-end
-- atualizava o estado local otimisticamente ANTES de saber se a escrita
-- no servidor tinha dado certo, esse erro ficava invisível — a tela do
-- admin mostrava a lista nova (só no navegador dele), mas nada era
-- gravado no banco, e por isso nenhum outro usuário via a atualização.
--
-- Fix: troca a constraint por uma que inclui o nome do produto (dentro
-- do jsonb `data`), preservando alguma proteção contra duplicata real
-- (mesmo SAP + mesmo nome) sem bloquear o caso legítimo de SAP
-- compartilhado entre produtos com nomes diferentes.

alter table public.price_catalog_products
  drop constraint if exists price_catalog_products_version_id_codigo_key;

create unique index if not exists price_catalog_products_version_codigo_nome_idx
  on public.price_catalog_products (version_id, codigo, ((data->>'nome')));
