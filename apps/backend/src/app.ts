import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import ExcelJS from "exceljs";
import { ambiente } from "./configuracao/ambiente.js";
import { consultar, consultarUm } from "./banco/conexao.js";
import { executarOracle } from "./banco/oracle.js";
import { autenticar, exigir } from "./seguranca/sessao.js";
import {
  carregarFiltrosOracle,
  garantirFontes,
  processarFluxo,
} from "./modulos/gestao/servicoFluxoCaixa.js";
import {
  alterarSenhaUsuario,
  buscarUsuariosPorLogin,
  excluirLogico,
  listarEmpresas,
  listarEmpresasDoUsuario,
  listarPerfis,
  listarPermissoesPerfil,
  listarUsuarios,
  listarConexoesOracle,
  permissoesUsuario,
  podeAcessarRecurso,
  salvarEmpresa,
  salvarPerfil,
  salvarPermissoesPerfil,
  salvarUsuario,
  salvarConexaoOracle,
  testarConexaoOracle,
  verificarSenhaUsuario,
} from "./modulos/administracao.js";

const sucesso = <T>(dados: T) => ({ sucesso: true, dados });
const falha = (codigo: string, mensagem: string) => ({
  sucesso: false,
  erro: { codigo, mensagem },
});

export async function criarApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: ambiente.jwtSecret });
  app.get("/saude", async () => ({ status: "ok", modulo: "Control S Gestão" }));
  async function resolver(login: string) {
    const usuarios = await buscarUsuariosPorLogin(login);
    if (usuarios.length > 1)
      throw new Error(
        "Mais de um usuário encontrado. Informe o e-mail completo.",
      );
    return usuarios[0] ?? null;
  }
  async function autenticarLogin(login: string, senha: string) {
    const usuario = await resolver(login);
    if (!usuario || !(await verificarSenhaUsuario(usuario.id, senha)))
      return null;
    let empresas = await listarEmpresasDoUsuario(usuario.id);
    if (!empresas.length && (usuario.administrador || usuario.superadmin)) {
      const empresaPadrao = await consultarUm<any>(
        "SELECT id,codigo_empresa,razao_social,nome_fantasia,nome_exibido,caminho_logo,caminho_imagem_fundo,dominio_publico,TRUE padrao FROM empresas WHERE ativa=TRUE AND excluido=FALSE ORDER BY id LIMIT 1",
      );
      empresas = empresaPadrao ? [empresaPadrao] : [];
    }
    const empresa = empresas.find((x: any) => x.padrao) ?? empresas[0];
    const permissoes = usuario.administrador || usuario.superadmin
      ? ["*"]
      : empresa
        ? await permissoesUsuario(usuario.id, empresa.id)
        : [];
    return { usuario, empresas, empresa, permissoes };
  }
  app.post("/api/auth/login", async (req, res) => {
    const b = req.body as any;
    if (!b.email || !b.senha)
      return res
        .code(400)
        .send(falha("CREDENCIAIS_OBRIGATORIAS", "Informe e-mail e senha."));
    try {
      const a = await autenticarLogin(b.email, b.senha);
      if (!a)
        return res
          .code(401)
          .send(falha("CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos."));
      const token = app.jwt.sign({
        id: a.usuario.id,
        nome: a.usuario.nome,
        email: a.usuario.email,
        administrador: a.usuario.administrador,
        superadmin: a.usuario.superadmin,
        empresaId: a.empresa?.id,
        empresaAtivaId: a.empresa?.id,
        permissoes: a.permissoes,
      });
      return sucesso({
        token,
        usuario: { ...a.usuario, empresaAtivaId: a.empresa?.id },
        empresas: a.empresas,
        permissoes: a.permissoes,
      });
    } catch (e: any) {
      app.log.error(e, "Falha durante o login");
      const ambiguo = e?.message === "Mais de um usuário encontrado. Informe o e-mail completo.";
      return res
        .code(ambiguo ? 409 : 500)
        .send(falha(ambiguo ? "LOGIN_AMBIGUO" : "ERRO_LOGIN", ambiguo ? e.message : "Não foi possível concluir o login. Consulte o log do serviço."));
    }
  });
  app.post("/api/auth/validar-credenciais", async (req, res) => {
    const b = req.body as any;
    const a = await autenticarLogin(b.email, b.senha);
    return a
      ? sucesso({ valido: true })
      : res
          .code(401)
          .send(falha("CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos."));
  });
  app.post("/api/auth/alterar-senha-login", async (req, res) => {
    const b = req.body as any;
    if (String(b.nova_senha ?? "").length < 6)
      return res
        .code(400)
        .send(
          falha(
            "SENHA_INVALIDA",
            "A nova senha deve ter ao menos 6 caracteres.",
          ),
        );
    const a = await autenticarLogin(b.email, b.senha_atual);
    if (!a)
      return res
        .code(401)
        .send(
          falha("CREDENCIAIS_INVALIDAS", "E-mail ou senha atual inválidos."),
        );
    await alterarSenhaUsuario(a.usuario.id, b.nova_senha);
    return sucesso({ alterada: true });
  });
  app.get("/api/auth/sessao", { preHandler: autenticar }, async (req) => {
    const empresas = await listarEmpresasDoUsuario(req.user.id),
      permissoes = await permissoesUsuario(
        req.user.id,
        req.user.empresaAtivaId,
      );
    return sucesso({ usuario: req.user, empresas, permissoes });
  });
  app.post(
    "/api/auth/trocar-empresa",
    { preHandler: autenticar },
    async (req, res) => {
      const b = req.body as any,
        empresas = await listarEmpresasDoUsuario(req.user.id),
        empresa = empresas.find((x: any) => x.id === Number(b.empresa_id));
      if (!empresa)
        return res
          .code(403)
          .send(
            falha("EMPRESA_NAO_LIBERADA", "Empresa não vinculada ao usuário."),
          );
      const permissoes = await permissoesUsuario(req.user.id, empresa.id),
        token = app.jwt.sign({
          ...req.user,
          empresaId: empresa.id,
          empresaAtivaId: empresa.id,
          permissoes,
        });
      return sucesso({ token, empresa, permissoes });
    },
  );
  app.post("/autenticacao/entrar", async (req, res) => {
    const b = req.body as any;
    const a = await autenticarLogin(b.login, b.senha);
    if (!a)
      return res.code(401).send({ mensagem: "Usuário ou senha inválidos." });
    return {
      token: app.jwt.sign({
        id: a.usuario.id,
        nome: a.usuario.nome,
        email: a.usuario.email,
        administrador: a.usuario.administrador,
        superadmin: a.usuario.superadmin,
        empresaId: a.empresa?.id,
        empresaAtivaId: a.empresa?.id,
        permissoes: a.permissoes,
      }),
      usuario: {
        ...a.usuario,
        empresaId: a.empresa?.id,
        permissoes: a.permissoes,
      },
    };
  });
  const admin = async (req: any, res: any) => {
    await autenticar(req, res);
    if (res.sent) return;
    if (!req.user.superadmin && !req.user.administrador)
      return res
        .code(403)
        .send(falha("ACESSO_NEGADO", "Acesso restrito à administração."));
  };
  app.get("/api/admin/empresas", { preHandler: admin }, async () =>
    sucesso(await listarEmpresas()),
  );
  app.post("/api/admin/empresas", { preHandler: admin }, async (req) =>
    sucesso(await salvarEmpresa(req.body, req.user.id)),
  );
  app.delete("/api/admin/empresas/:id", { preHandler: admin }, async (req) =>
    sucesso(
      await excluirLogico(
        "empresas",
        Number((req.params as any).id),
        req.user.id,
      ),
    ),
  );
  app.get("/api/admin/perfis", { preHandler: admin }, async () =>
    sucesso(await listarPerfis()),
  );
  app.post("/api/admin/perfis", { preHandler: admin }, async (req) =>
    sucesso(await salvarPerfil(req.body, req.user.id)),
  );
  app.delete("/api/admin/perfis/:id", { preHandler: admin }, async (req) =>
    sucesso(
      await excluirLogico(
        "perfis",
        Number((req.params as any).id),
        req.user.id,
      ),
    ),
  );
  app.get("/api/admin/usuarios", { preHandler: admin }, async () =>
    sucesso(await listarUsuarios()),
  );
  app.post("/api/admin/usuarios", { preHandler: admin }, async (req) =>
    sucesso(await salvarUsuario(req.body, req.user.id)),
  );
  app.delete("/api/admin/usuarios/:id", { preHandler: admin }, async (req) =>
    sucesso(
      await excluirLogico(
        "usuarios",
        Number((req.params as any).id),
        req.user.id,
      ),
    ),
  );
  app.get(
    "/api/admin/perfis/:id/permissoes",
    { preHandler: admin },
    async (req) =>
      sucesso(
        await listarPermissoesPerfil(
          Number((req.params as any).id),
          Number((req.query as any)?.empresa_id ?? req.user.empresaAtivaId),
        ),
      ),
  );
  app.post(
    "/api/admin/perfis/:id/permissoes",
    { preHandler: admin },
    async (req, res) => {
      const b = req.body as any;
      await salvarPermissoesPerfil(
        Number((req.params as any).id),
        Number(b.empresa_id ?? req.user.empresaAtivaId),
        b.itens ?? [],
      );
      return sucesso({ salvo: true });
    },
  );
  app.get("/api/admin/conexoes-oracle", { preHandler: admin }, async () =>
    sucesso(await listarConexoesOracle()),
  );
  app.post("/api/admin/conexoes-oracle", { preHandler: admin }, async (req) =>
    sucesso(await salvarConexaoOracle(req.body)),
  );
  app.post(
    "/api/admin/conexoes-oracle/:id/testar",
    { preHandler: admin },
    async (req, res) => {
      try {
        return sucesso(
          await testarConexaoOracle(Number((req.params as any).id)),
        );
      } catch (e: any) {
        return res.code(422).send(falha("ORACLE_INDISPONIVEL", e.message));
      }
    },
  );
  app.get(
    "/gestao/fluxo-caixa/filtros-opcoes",
    { preHandler: exigir("gestao.fluxo_caixa.visualizar") },
    async (req, res) => {
      try {
        await garantirFontes(req.user.id);
        return (
          (await carregarFiltrosOracle()) ?? {
            grupos: [],
            filiais: [],
            portadores: [],
            situacoes: [],
            analiticas: [],
          }
        );
      } catch (e: any) {
        return res.code(422).send({ mensagem: e.message });
      }
    },
  );
  app.get(
    "/gestao/fluxo-caixa/configuracoes",
    { preHandler: exigir("gestao.fluxo_caixa.visualizar") },
    async (req) => {
      await garantirFontes(req.user.id);
      const [grupos, classificacoes, mapas] = await Promise.all([
        consultar(
          "SELECT * FROM gestao_grupo_filial WHERE ativo=TRUE ORDER BY nome",
        ),
        consultar(
          "SELECT * FROM gestao_fluxo_classificacao WHERE ativo=TRUE ORDER BY nome",
        ),
        consultar(
          "SELECT * FROM gestao_fluxo_finalizador_mapa WHERE ativo=TRUE ORDER BY tipo_finalizador",
        ),
      ]);
      return { grupos, classificacoes, mapas };
    },
  );
  app.post(
    "/gestao/fluxo-caixa/processar",
    { preHandler: exigir("gestao.fluxo_caixa.processar") },
    async (req, res) => {
      try {
        const id = await processarFluxo(req.body as any, req.user.id);
        return { id, status: "CONCLUIDO" };
      } catch (e: any) {
        return res.code(422).send({ mensagem: e.message });
      }
    },
  );
  for (const [rota, sql] of [
    [
      "dias",
      "SELECT * FROM gestao_fluxo_dia WHERE processo_id=$1 ORDER BY data_fluxo",
    ],
    [
      "detalhes",
      "SELECT * FROM gestao_fluxo_detalhe WHERE processo_id=$1 ORDER BY data_fluxo,tipo_movimento,pessoa,documento",
    ],
    [
      "insights",
      "SELECT * FROM gestao_fluxo_insight WHERE processo_id=$1 ORDER BY CASE severidade WHEN 'CRITICO' THEN 1 WHEN 'ATENCAO' THEN 2 ELSE 3 END,criado_em",
    ],
  ] as const)
    app.get(
      `/gestao/fluxo-caixa/processos/:id/${rota}`,
      {
        preHandler: exigir(
          rota === "detalhes"
            ? "gestao.fluxo_caixa.ver_detalhe"
            : rota === "insights"
              ? "gestao.fluxo_caixa.ver_insights"
              : "gestao.fluxo_caixa.visualizar",
        ),
      },
      async (req) => consultar(sql, [Number((req.params as any).id)]),
    );
  app.get(
    "/gestao/fluxo-caixa/processos/:id/resumo",
    { preHandler: exigir("gestao.fluxo_caixa.visualizar") },
    async (req) =>
      consultarUm(
        `SELECT p.*,MIN(d.saldo_projetado) menor_saldo,MIN(d.data_fluxo) FILTER(WHERE d.saldo_projetado<0) primeiro_dia_negativo,SUM(d.entradas_previstas) entradas_previstas,SUM(d.saidas_previstas) saidas_previstas,SUM(d.previsao_inteligente) previsao_inteligente,MAX(d.saldo_projetado) FILTER(WHERE d.data_fluxo=p.data_final) saldo_final FROM gestao_fluxo_processo p LEFT JOIN gestao_fluxo_dia d ON d.processo_id=p.id WHERE p.id=$1 GROUP BY p.id`,
        [Number((req.params as any).id)],
      ),
  );
  app.get(
    "/gestao/fluxo-caixa/processos/:id/semanas",
    { preHandler: exigir("gestao.fluxo_caixa.visualizar") },
    async (req) =>
      consultar(
        `SELECT date_trunc('week',data_fluxo)::date periodo,SUM(entradas_previstas) entradas,SUM(saidas_previstas) saidas,MIN(saldo_projetado) menor_saldo,MAX(saldo_projetado) FILTER(WHERE data_fluxo=(SELECT MAX(x.data_fluxo) FROM gestao_fluxo_dia x WHERE x.processo_id=$1 AND date_trunc('week',x.data_fluxo)=date_trunc('week',gestao_fluxo_dia.data_fluxo))) saldo_final FROM gestao_fluxo_dia WHERE processo_id=$1 GROUP BY 1 ORDER BY 1`,
        [Number((req.params as any).id)],
      ),
  );
  app.get(
    "/gestao/fluxo-caixa/processos/:id/meses",
    { preHandler: exigir("gestao.fluxo_caixa.visualizar") },
    async (req) =>
      consultar(
        `SELECT date_trunc('month',data_fluxo)::date periodo,SUM(entradas_previstas) entradas,SUM(saidas_previstas) saidas,MIN(saldo_projetado) menor_saldo FROM gestao_fluxo_dia WHERE processo_id=$1 GROUP BY 1 ORDER BY 1`,
        [Number((req.params as any).id)],
      ),
  );
  app.get(
    "/gestao/fontes-dados",
    { preHandler: exigir("gestao.fonte_dados.visualizar") },
    async (req) => {
      await garantirFontes(req.user.id);
      const todas = await consultar<any>(
        "SELECT id,nome,descricao,categoria,banco_origem,tipo,ativo,editavel,atualizado_em FROM gestao_fonte_dados ORDER BY categoria,nome",
      );
      const permitidas = [];
      for (const fonte of todas)
        if (
          await podeAcessarRecurso(
            req.user.id,
            req.user.empresaAtivaId,
            "FONTE",
            fonte.nome,
          )
        )
          permitidas.push(fonte);
      return permitidas;
    },
  );
  app.get(
    "/gestao/fontes-dados/:id",
    { preHandler: exigir("gestao.fonte_dados.ver_sql") },
    async (req, res) => {
      const fonte = await consultarUm<any>(
        "SELECT * FROM gestao_fonte_dados WHERE id=$1",
        [Number((req.params as any).id)],
      );
      if (
        !fonte ||
        !(await podeAcessarRecurso(
          req.user.id,
          req.user.empresaAtivaId,
          "FONTE",
          fonte.nome,
        ))
      )
        return res
          .code(403)
          .send({ mensagem: "Fonte de dados não liberada para este perfil." });
      return fonte;
    },
  );
  app.put(
    "/gestao/fontes-dados/:id",
    { preHandler: exigir("gestao.fonte_dados.editar") },
    async (req, res) => {
      const id = Number((req.params as any).id),
        b = req.body as any,
        atual = await consultarUm<any>(
          "SELECT * FROM gestao_fonte_dados WHERE id=$1",
          [id],
        );
      if (
        !atual ||
        !(await podeAcessarRecurso(
          req.user.id,
          req.user.empresaAtivaId,
          "FONTE",
          atual.nome,
        ))
      )
        return res
          .code(403)
          .send({ mensagem: "Fonte de dados não liberada para este perfil." });
      await consultar(
        "INSERT INTO gestao_fonte_dados_versao(fonte_dados_id,versao,sql_texto,parametros_json,alterado_por,observacao) VALUES($1,COALESCE((SELECT MAX(versao)+1 FROM gestao_fonte_dados_versao WHERE fonte_dados_id=$1),1),$2,$3,$4,$5)",
        [
          id,
          atual.sql_texto,
          JSON.stringify(atual.parametros_json),
          req.user.id,
          b.observacao ?? "Versão automática antes da edição",
        ],
      );
      return consultarUm(
        "UPDATE gestao_fonte_dados SET nome=$2,descricao=$3,sql_texto=$4,parametros_json=$5,atualizado_por=$6,atualizado_em=NOW() WHERE id=$1 RETURNING *",
        [
          id,
          b.nome,
          b.descricao,
          b.sqlTexto,
          JSON.stringify(b.parametros ?? {}),
          req.user.id,
        ],
      );
    },
  );
  app.post(
    "/gestao/fontes-dados/:id/testar",
    { preHandler: exigir("gestao.fonte_dados.executar") },
    async (req, res) => {
      const id = Number((req.params as any).id),
        b = req.body as any,
        f = await consultarUm<any>(
          "SELECT * FROM gestao_fonte_dados WHERE id=$1",
          [id],
        ),
        inicio = Date.now();
      if (
        !f ||
        !(await podeAcessarRecurso(
          req.user.id,
          req.user.empresaAtivaId,
          "FONTE",
          f.nome,
        ))
      )
        return res
          .code(403)
          .send({ mensagem: "Fonte de dados não liberada para este perfil." });
      try {
        const linhas = await executarOracle(
          f.sql_texto,
          b.parametros ?? {},
          200,
        );
        await consultar(
          "INSERT INTO gestao_fonte_dados_log(fonte_dados_id,usuario_id,parametros_json,tempo_ms,quantidade_linhas,sucesso) VALUES($1,$2,$3,$4,$5,TRUE)",
          [
            id,
            req.user.id,
            JSON.stringify(b.parametros ?? {}),
            Date.now() - inicio,
            linhas.length,
          ],
        );
        return {
          tempoMs: Date.now() - inicio,
          quantidadeLinhas: linhas.length,
          linhas,
        };
      } catch (e: any) {
        await consultar(
          "INSERT INTO gestao_fonte_dados_log(fonte_dados_id,usuario_id,parametros_json,tempo_ms,quantidade_linhas,sucesso,erro) VALUES($1,$2,$3,$4,0,FALSE,$5)",
          [
            id,
            req.user.id,
            JSON.stringify(b.parametros ?? {}),
            Date.now() - inicio,
            e.message,
          ],
        );
        return res.code(422).send({ mensagem: e.message });
      }
    },
  );
  app.post(
    "/gestao/fontes-dados/:id/publicar",
    { preHandler: exigir("gestao.fonte_dados.publicar") },
    async (req, res) => {
      const id = Number((req.params as any).id);
      const fonte = await consultarUm<any>(
        "SELECT nome FROM gestao_fonte_dados WHERE id=$1",
        [id],
      );
      if (
        !fonte ||
        !(await podeAcessarRecurso(
          req.user.id,
          req.user.empresaAtivaId,
          "FONTE",
          fonte.nome,
        ))
      )
        return res
          .code(403)
          .send({ mensagem: "Fonte de dados não liberada para este perfil." });
      return consultarUm(
        "UPDATE gestao_fonte_dados SET publicado_em=NOW(),publicado_por=$2 WHERE id=$1 RETURNING *",
        [id, req.user.id],
      );
    },
  );
  app.post(
    "/gestao/fontes-dados",
    { preHandler: exigir("gestao.fonte_dados.editar") },
    async (req) => {
      const b = req.body as any;
      return consultarUm(
        `INSERT INTO gestao_fonte_dados(nome,descricao,categoria,banco_origem,tipo,sql_texto,parametros_json,criado_por) VALUES($1,$2,$3,'ORACLE','SELECT',$4,$5,$6) RETURNING *`,
        [
          b.nome,
          b.descricao,
          b.categoria,
          b.sqlTexto,
          JSON.stringify(b.parametros ?? {}),
          req.user.id,
        ],
      );
    },
  );
  app.get(
    "/gestao/fluxo-caixa/classificacoes",
    { preHandler: exigir("gestao.fluxo_caixa.configurar") },
    async () =>
      consultar("SELECT * FROM gestao_fluxo_classificacao ORDER BY nome"),
  );
  app.post(
    "/gestao/fluxo-caixa/classificacoes",
    { preHandler: exigir("gestao.fluxo_caixa.configurar") },
    async (req) => {
      const b = req.body as any;
      return consultarUm(
        `INSERT INTO gestao_fluxo_classificacao(nome,origem,tipo_especial,estab_oracle,idsituacao_oracle,idanalitica_oracle,idpess_oracle,texto_contem) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          b.nome,
          b.origem,
          b.tipoEspecial,
          b.estab ?? null,
          b.idSituacao ?? null,
          b.idAnalitica ?? null,
          b.idPessoa ?? null,
          b.textoContem ?? null,
        ],
      );
    },
  );
  app.put(
    "/gestao/fluxo-caixa/classificacoes/:id",
    { preHandler: exigir("gestao.fluxo_caixa.configurar") },
    async (req) => {
      const b = req.body as any;
      return consultarUm(
        `UPDATE gestao_fluxo_classificacao SET nome=$2,origem=$3,tipo_especial=$4,estab_oracle=$5,idsituacao_oracle=$6,idanalitica_oracle=$7,idpess_oracle=$8,texto_contem=$9,ativo=$10,atualizado_em=NOW() WHERE id=$1 RETURNING *`,
        [
          Number((req.params as any).id),
          b.nome,
          b.origem,
          b.tipoEspecial,
          b.estab ?? null,
          b.idSituacao ?? null,
          b.idAnalitica ?? null,
          b.idPessoa ?? null,
          b.textoContem ?? null,
          b.ativo !== false,
        ],
      );
    },
  );
  app.delete(
    "/gestao/fluxo-caixa/classificacoes/:id",
    { preHandler: exigir("gestao.fluxo_caixa.configurar") },
    async (req) =>
      consultarUm(
        "UPDATE gestao_fluxo_classificacao SET ativo=FALSE,atualizado_em=NOW() WHERE id=$1 RETURNING id",
        [Number((req.params as any).id)],
      ),
  );
  app.get(
    "/gestao/grupos-filiais",
    { preHandler: exigir("gestao.grupo_filial.visualizar") },
    async () =>
      consultar(
        `SELECT g.*,COALESCE(json_agg(i ORDER BY i.estab_oracle) FILTER(WHERE i.id IS NOT NULL),'[]') itens FROM gestao_grupo_filial g LEFT JOIN gestao_grupo_filial_item i ON i.grupo_filial_id=g.id AND i.ativo=TRUE GROUP BY g.id ORDER BY g.nome`,
      ),
  );
  app.post(
    "/gestao/grupos-filiais",
    { preHandler: exigir("gestao.grupo_filial.editar") },
    async (req) => {
      const b = req.body as any,
        g = await consultarUm<any>(
          "INSERT INTO gestao_grupo_filial(nome,descricao) VALUES($1,$2) RETURNING *",
          [b.nome, b.descricao],
        );
      for (const i of b.itens ?? [])
        await consultar(
          "INSERT INTO gestao_grupo_filial_item(grupo_filial_id,estab_oracle,nome_filial) VALUES($1,$2,$3)",
          [g.id, i.estab, i.nome],
        );
      return g;
    },
  );
  app.put(
    "/gestao/grupos-filiais/:id",
    { preHandler: exigir("gestao.grupo_filial.editar") },
    async (req) => {
      const id = Number((req.params as any).id),
        b = req.body as any;
      await consultar(
        "UPDATE gestao_grupo_filial SET nome=$2,descricao=$3,ativo=$4,atualizado_em=NOW() WHERE id=$1",
        [id, b.nome, b.descricao, b.ativo !== false],
      );
      await consultar(
        "UPDATE gestao_grupo_filial_item SET ativo=FALSE,atualizado_em=NOW() WHERE grupo_filial_id=$1",
        [id],
      );
      for (const i of b.itens ?? [])
        await consultar(
          `INSERT INTO gestao_grupo_filial_item(grupo_filial_id,estab_oracle,nome_filial) VALUES($1,$2,$3) ON CONFLICT(grupo_filial_id,estab_oracle) DO UPDATE SET nome_filial=EXCLUDED.nome_filial,ativo=TRUE,atualizado_em=NOW()`,
          [id, i.estab, i.nome],
        );
      return { id };
    },
  );
  app.delete(
    "/gestao/grupos-filiais/:id",
    { preHandler: exigir("gestao.grupo_filial.editar") },
    async (req) =>
      consultarUm(
        "UPDATE gestao_grupo_filial SET ativo=FALSE,atualizado_em=NOW() WHERE id=$1 RETURNING id",
        [Number((req.params as any).id)],
      ),
  );
  app.get(
    "/gestao/fluxo-caixa/processos/:id/exportar-excel",
    { preHandler: exigir("gestao.fluxo_caixa.exportar_excel") },
    async (req, res) => {
      const id = Number((req.params as any).id),
        w = new ExcelJS.Workbook();
      for (const [nome, sql] of [
        ["Resumo", "SELECT * FROM gestao_fluxo_processo WHERE id=$1"],
        ["Dias", "SELECT * FROM gestao_fluxo_dia WHERE processo_id=$1"],
        [
          "Semanas",
          "SELECT date_trunc('week',data_fluxo)::date periodo,SUM(entradas_previstas) entradas,SUM(saidas_previstas) saidas,MIN(saldo_projetado) menor_saldo FROM gestao_fluxo_dia WHERE processo_id=$1 GROUP BY 1 ORDER BY 1",
        ],
        [
          "Meses",
          "SELECT date_trunc('month',data_fluxo)::date periodo,SUM(entradas_previstas) entradas,SUM(saidas_previstas) saidas,MIN(saldo_projetado) menor_saldo FROM gestao_fluxo_dia WHERE processo_id=$1 GROUP BY 1 ORDER BY 1",
        ],
        ["Detalhes", "SELECT * FROM gestao_fluxo_detalhe WHERE processo_id=$1"],
        ["Insights", "SELECT * FROM gestao_fluxo_insight WHERE processo_id=$1"],
        [
          "Parâmetros",
          "SELECT parametros_json,usuario_id,criado_em FROM gestao_fluxo_processo WHERE id=$1",
        ],
      ] as const) {
        const dados = await consultar<any>(sql, [id]),
          s = w.addWorksheet(nome);
        if (dados.length) {
          s.columns = Object.keys(dados[0]).map((k) => ({
            header: k,
            key: k,
            width: 22,
          }));
          s.addRows(dados);
          s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
          s.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F4C5C" },
          };
          s.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: Object.keys(dados[0]).length },
          };
          s.views = [{ state: "frozen", ySplit: 1 }];
        }
      }
      const buffer = await w.xlsx.writeBuffer();
      res
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
          "Content-Disposition",
          `attachment; filename=fluxo-caixa-${id}.xlsx`,
        )
        .send(Buffer.from(buffer));
    },
  );
  return app;
}
