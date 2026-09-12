-- CONTROL S HUB
-- Migration inicial do banco CONTROLSHUB.
-- Regra fixa: todos os objetos fisicos ficam em portugues e os comandos SQL em maiusculo.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS empresas (
  id BIGSERIAL PRIMARY KEY,
  codigo_empresa VARCHAR(30) NOT NULL,
  razao_social VARCHAR(180) NOT NULL,
  nome_fantasia VARCHAR(140) NOT NULL,
  cnpj VARCHAR(20),
  dominio_publico VARCHAR(180),
  nome_exibido VARCHAR(140),
  caminho_logo VARCHAR(260),
  caminho_imagem_fundo VARCHAR(260),
  cor_primaria VARCHAR(20) DEFAULT '#2EE66F',
  cor_secundaria VARCHAR(20) DEFAULT '#101827',
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_usuario_id BIGINT,
  alterado_em TIMESTAMPTZ,
  alterado_por_usuario_id BIGINT,
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por_usuario_id BIGINT,
  CONSTRAINT empresas_codigo_empresa_unico UNIQUE (codigo_empresa),
  CONSTRAINT empresas_cnpj_unico UNIQUE (cnpj)
);

CREATE TABLE IF NOT EXISTS modulos (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  icone VARCHAR(80),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT modulos_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS menus (
  id BIGSERIAL PRIMARY KEY,
  modulo_id BIGINT NOT NULL REFERENCES modulos(id),
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  rota VARCHAR(180) NOT NULL,
  icone VARCHAR(80),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menus_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS telas (
  id BIGSERIAL PRIMARY KEY,
  modulo_id BIGINT NOT NULL REFERENCES modulos(id),
  menu_id BIGINT REFERENCES menus(id),
  codigo VARCHAR(100) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  rota VARCHAR(180) NOT NULL,
  arquivo_fonte VARCHAR(260) NOT NULL,
  componentes_principais TEXT,
  endpoints_usados TEXT,
  tabelas_principais TEXT,
  rotinas_relacionadas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT telas_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS botoes (
  id BIGSERIAL PRIMARY KEY,
  tela_id BIGINT NOT NULL REFERENCES telas(id),
  codigo VARCHAR(100) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  acao_tecnica VARCHAR(120) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT botoes_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS acoes (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT acoes_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS perfis (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  administrador BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_usuario_id BIGINT,
  alterado_em TIMESTAMPTZ,
  alterado_por_usuario_id BIGINT,
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por_usuario_id BIGINT,
  CONSTRAINT perfis_codigo_unico UNIQUE (codigo)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  perfil_id BIGINT REFERENCES perfis(id),
  nome VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  administrador BOOLEAN NOT NULL DEFAULT FALSE,
  superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_acesso_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_usuario_id BIGINT,
  alterado_em TIMESTAMPTZ,
  alterado_por_usuario_id BIGINT,
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por_usuario_id BIGINT,
  CONSTRAINT usuarios_email_unico UNIQUE (email)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresas_criado_por_usuario_fk'
  ) THEN
    ALTER TABLE empresas
      ADD CONSTRAINT empresas_criado_por_usuario_fk FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_criado_por_usuario_fk'
  ) THEN
    ALTER TABLE perfis
      ADD CONSTRAINT perfis_criado_por_usuario_fk FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS usuarios_empresas (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT usuarios_empresas_unico UNIQUE (usuario_id, empresa_id)
);

CREATE TABLE IF NOT EXISTS perfis_permissoes (
  id BIGSERIAL PRIMARY KEY,
  perfil_id BIGINT NOT NULL REFERENCES perfis(id),
  empresa_id BIGINT REFERENCES empresas(id),
  modulo_id BIGINT REFERENCES modulos(id),
  menu_id BIGINT REFERENCES menus(id),
  tela_id BIGINT REFERENCES telas(id),
  botao_id BIGINT REFERENCES botoes(id),
  acao_id BIGINT REFERENCES acoes(id),
  etapa_kanban_id BIGINT,
  permitido BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios_permissoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  empresa_id BIGINT REFERENCES empresas(id),
  modulo_id BIGINT REFERENCES modulos(id),
  menu_id BIGINT REFERENCES menus(id),
  tela_id BIGINT REFERENCES telas(id),
  botao_id BIGINT REFERENCES botoes(id),
  acao_id BIGINT REFERENCES acoes(id),
  etapa_kanban_id BIGINT,
  permitido BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parametros_sistema (
  id BIGSERIAL PRIMARY KEY,
  chave VARCHAR(120) NOT NULL,
  valor TEXT,
  descricao TEXT,
  sensivel BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_em TIMESTAMPTZ,
  CONSTRAINT parametros_sistema_chave_unica UNIQUE (chave)
);

CREATE TABLE IF NOT EXISTS parametros_empresa (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  chave VARCHAR(120) NOT NULL,
  valor TEXT,
  descricao TEXT,
  sensivel BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_em TIMESTAMPTZ,
  CONSTRAINT parametros_empresa_chave_unica UNIQUE (empresa_id, chave)
);

CREATE TABLE IF NOT EXISTS sessoes_usuario (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  empresa_id BIGINT REFERENCES empresas(id),
  token_hash TEXT NOT NULL,
  ip_origem INET,
  agente_usuario TEXT,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  login_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auditorias (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT REFERENCES empresas(id),
  usuario_id BIGINT REFERENCES usuarios(id),
  modulo_codigo VARCHAR(100),
  tela_codigo VARCHAR(100),
  tipo_evento VARCHAR(80) NOT NULL,
  tabela_afetada VARCHAR(120),
  registro_id BIGINT,
  descricao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_origem INET,
  agente_usuario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transportadoras (
  id BIGSERIAL PRIMARY KEY,
  codigo_interno VARCHAR(60) NOT NULL,
  razao_social VARCHAR(180) NOT NULL,
  nome_fantasia VARCHAR(140),
  documento VARCHAR(20),
  email VARCHAR(180),
  telefone VARCHAR(40),
  responsavel VARCHAR(140),
  aceita_cotacao_externa BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_usuario_id BIGINT REFERENCES usuarios(id),
  alterado_em TIMESTAMPTZ,
  alterado_por_usuario_id BIGINT REFERENCES usuarios(id),
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por_usuario_id BIGINT REFERENCES usuarios(id),
  CONSTRAINT transportadoras_codigo_unico UNIQUE (codigo_interno)
);

CREATE TABLE IF NOT EXISTS transportadoras_empresas (
  id BIGSERIAL PRIMARY KEY,
  transportadora_id BIGINT NOT NULL REFERENCES transportadoras(id),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transportadoras_empresas_unico UNIQUE (transportadora_id, empresa_id)
);

CREATE TABLE IF NOT EXISTS etapas_kanban (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT REFERENCES empresas(id),
  modulo_id BIGINT NOT NULL REFERENCES modulos(id),
  codigo VARCHAR(100) NOT NULL,
  nome VARCHAR(140) NOT NULL,
  descricao TEXT,
  cor VARCHAR(20) NOT NULL DEFAULT '#2EE66F',
  ordem INTEGER NOT NULL DEFAULT 0,
  permite_arrastar BOOLEAN NOT NULL DEFAULT TRUE,
  etapa_final BOOLEAN NOT NULL DEFAULT FALSE,
  etapa_bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
  obriga_feedback BOOLEAN NOT NULL DEFAULT FALSE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT etapas_kanban_codigo_empresa_unico UNIQUE (empresa_id, modulo_id, codigo)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_permissoes_etapa_fk'
  ) THEN
    ALTER TABLE perfis_permissoes
      ADD CONSTRAINT perfis_permissoes_etapa_fk FOREIGN KEY (etapa_kanban_id) REFERENCES etapas_kanban(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_permissoes_etapa_fk'
  ) THEN
    ALTER TABLE usuarios_permissoes
      ADD CONSTRAINT usuarios_permissoes_etapa_fk FOREIGN KEY (etapa_kanban_id) REFERENCES etapas_kanban(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cotacoes_frete (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  etapa_kanban_id BIGINT REFERENCES etapas_kanban(id),
  tipo_documento VARCHAR(30) NOT NULL,
  numero_documento VARCHAR(80) NOT NULL,
  chave_nfe VARCHAR(60),
  numero_pedido VARCHAR(80),
  data_documento DATE,
  status VARCHAR(60) NOT NULL DEFAULT 'RECEBIDO_ERP',
  loja_origem VARCHAR(120),
  loja_destino VARCHAR(120),
  valor_mercadoria NUMERIC(15, 2) NOT NULL DEFAULT 0,
  peso_real NUMERIC(15, 4) NOT NULL DEFAULT 0,
  volumes_total NUMERIC(15, 4) NOT NULL DEFAULT 0,
  cubagem_total NUMERIC(15, 4) NOT NULL DEFAULT 0,
  percentual_sobre_nf NUMERIC(10, 4),
  valor_solicitado NUMERIC(15, 2),
  cep_destino VARCHAR(12),
  uf_destino CHAR(2),
  cidade_destino VARCHAR(120),
  endereco_destinatario TEXT,
  nome_destinatario VARCHAR(180),
  documento_destinatario VARCHAR(20),
  destino_zona_rural BOOLEAN NOT NULL DEFAULT FALSE,
  destinatario_pessoa_fisica BOOLEAN NOT NULL DEFAULT FALSE,
  recebido_do_erp BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_no_erp BOOLEAN NOT NULL DEFAULT FALSE,
  atualizado_no_erp_em TIMESTAMPTZ,
  bloqueado_para_alteracao BOOLEAN NOT NULL DEFAULT FALSE,
  identificador_externo VARCHAR(160),
  payload_recebido JSONB,
  payload_retorno JSONB,
  transportadora_escolhida_id BIGINT REFERENCES transportadoras(id),
  escolhido_por_usuario_id BIGINT REFERENCES usuarios(id),
  escolhido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_usuario_id BIGINT REFERENCES usuarios(id),
  alterado_em TIMESTAMPTZ,
  alterado_por_usuario_id BIGINT REFERENCES usuarios(id),
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por_usuario_id BIGINT REFERENCES usuarios(id),
  CONSTRAINT cotacoes_frete_documento_unico UNIQUE (empresa_id, tipo_documento, numero_documento)
);

CREATE TABLE IF NOT EXISTS cotacoes_frete_itens (
  id BIGSERIAL PRIMARY KEY,
  cotacao_frete_id BIGINT NOT NULL REFERENCES cotacoes_frete(id),
  codigo_item VARCHAR(80),
  descricao_item VARCHAR(260) NOT NULL,
  quantidade NUMERIC(15, 4) NOT NULL DEFAULT 0,
  cubagem_item NUMERIC(15, 4) NOT NULL DEFAULT 0,
  largura NUMERIC(15, 4) NOT NULL DEFAULT 0,
  altura NUMERIC(15, 4) NOT NULL DEFAULT 0,
  comprimento NUMERIC(15, 4) NOT NULL DEFAULT 0,
  peso_item NUMERIC(15, 4) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_em TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS cotacoes_frete_transportadoras (
  id BIGSERIAL PRIMARY KEY,
  cotacao_frete_id BIGINT NOT NULL REFERENCES cotacoes_frete(id),
  transportadora_id BIGINT NOT NULL REFERENCES transportadoras(id),
  codigo_transportadora VARCHAR(80),
  sequencia INTEGER,
  valor_frete NUMERIC(15, 2) NOT NULL DEFAULT 0,
  percentual_frete NUMERIC(10, 4),
  ranking_frete INTEGER,
  origem_cotacao VARCHAR(40) NOT NULL DEFAULT 'ERP',
  observacao TEXT,
  validada BOOLEAN NOT NULL DEFAULT FALSE,
  selecionada BOOLEAN NOT NULL DEFAULT FALSE,
  escolhida_plataforma BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(60) NOT NULL DEFAULT 'RECEBIDA',
  cotada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validada_por_usuario_id BIGINT REFERENCES usuarios(id),
  validada_em TIMESTAMPTZ,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cotacoes_frete_transportadoras_unico UNIQUE (cotacao_frete_id, transportadora_id, origem_cotacao)
);

CREATE TABLE IF NOT EXISTS cotacoes_frete_tokens (
  id BIGSERIAL PRIMARY KEY,
  cotacao_frete_id BIGINT NOT NULL REFERENCES cotacoes_frete(id),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  transportadora_id BIGINT NOT NULL REFERENCES transportadoras(id),
  token_hash TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ATIVO',
  utilizado BOOLEAN NOT NULL DEFAULT FALSE,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ,
  utilizado_em TIMESTAMPTZ,
  ip_geracao INET,
  ip_utilizacao INET,
  agente_usuario_utilizacao TEXT,
  gerado_por_usuario_id BIGINT REFERENCES usuarios(id),
  CONSTRAINT cotacoes_frete_tokens_hash_unico UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS cotacoes_frete_historicos (
  id BIGSERIAL PRIMARY KEY,
  cotacao_frete_id BIGINT NOT NULL REFERENCES cotacoes_frete(id),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario_id BIGINT REFERENCES usuarios(id),
  tipo_evento VARCHAR(80) NOT NULL,
  descricao TEXT NOT NULL,
  etapa_origem_id BIGINT REFERENCES etapas_kanban(id),
  etapa_destino_id BIGINT REFERENCES etapas_kanban(id),
  dados_evento JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integracoes_erp (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  cotacao_frete_id BIGINT REFERENCES cotacoes_frete(id),
  tipo_integracao VARCHAR(80) NOT NULL,
  identificador_externo VARCHAR(160),
  status VARCHAR(60) NOT NULL DEFAULT 'PENDENTE',
  payload_recebido JSONB,
  payload_retorno JSONB,
  mensagem TEXT,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_usuario ON usuarios_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_empresa ON usuarios_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_empresa_data ON auditorias(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_transportadoras_empresas_empresa ON transportadoras_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_etapas_kanban_empresa_modulo ON etapas_kanban(empresa_id, modulo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_empresa_status ON cotacoes_frete(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_etapa ON cotacoes_frete(etapa_kanban_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_bloqueio ON cotacoes_frete(bloqueado_para_alteracao);
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_transportadoras_cotacao ON cotacoes_frete_transportadoras(cotacao_frete_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_tokens_cotacao ON cotacoes_frete_tokens(cotacao_frete_id);
CREATE INDEX IF NOT EXISTS idx_integracoes_erp_status ON integracoes_erp(status, criado_em DESC);
