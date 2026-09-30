-- Mondepars Intelligence (novo projeto): no-op intencional.
-- A versão original desta migração limpava dados de uma instalação anterior (reset pedido em 2026-09-29)
-- e está preservada em docs/historico/0003_real_world_reset.sql. Ela não deve rodar como bootstrap de um banco novo.
SELECT 1;
