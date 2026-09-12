BEGIN;
CREATE TABLE IF NOT EXISTS gestao_conexao_oracle (
  id BIGSERIAL PRIMARY KEY, nome VARCHAR(120) NOT NULL UNIQUE,
  host VARCHAR(180) NOT NULL, porta INTEGER NOT NULL DEFAULT 1521,
  servico VARCHAR(120) NOT NULL, usuario VARCHAR(120) NOT NULL,
  senha_criptografada BYTEA NOT NULL, ativa BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_teste_em TIMESTAMPTZ, ultimo_teste_sucesso BOOLEAN,
  ultimo_teste_mensagem TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ
);
COMMIT;
