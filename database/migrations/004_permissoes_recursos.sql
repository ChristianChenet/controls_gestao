BEGIN;
CREATE TABLE IF NOT EXISTS gestao_perfil_recurso (
  id BIGSERIAL PRIMARY KEY,
  perfil_id BIGINT NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  empresa_id BIGINT REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_recurso VARCHAR(30) NOT NULL,
  recurso_codigo VARCHAR(180) NOT NULL,
  permitido BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(perfil_id,empresa_id,tipo_recurso,recurso_codigo)
);
ALTER TABLE empresas ALTER COLUMN caminho_logo TYPE TEXT;
UPDATE telas SET nome='Fluxo de Caixa' WHERE codigo='GESTAO_FLUXO_CAIXA';
COMMIT;
