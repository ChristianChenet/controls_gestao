BEGIN;

INSERT INTO acoes(codigo,nome,descricao)
VALUES (
  'gestao.indicador.editar_fonte',
  'Permite editar fonte de dados pelo Indicador',
  'Habilita o botão direito nos indicadores para alterar rapidamente a consulta vinculada'
)
ON CONFLICT(codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo = TRUE;

CREATE TABLE IF NOT EXISTS gestao_fluxo_saldo_detalhe (
  id BIGSERIAL PRIMARY KEY,
  processo_id BIGINT NOT NULL REFERENCES gestao_fluxo_processo(id) ON DELETE CASCADE,
  estab_oracle INTEGER,
  id_portador_oracle INTEGER,
  portador VARCHAR(180),
  tipo_saldo VARCHAR(30) NOT NULL,
  valor NUMERIC(18,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gestao_fluxo_saldo_detalhe_01
  ON gestao_fluxo_saldo_detalhe(processo_id,estab_oracle,id_portador_oracle);

ALTER TABLE gestao_fluxo_processo
  DROP CONSTRAINT IF EXISTS gestao_fluxo_processo_grupo_filial_id_fkey;

COMMIT;
