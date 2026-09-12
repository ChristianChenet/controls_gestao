import { consultar, consultarUm } from "../banco/conexao.js";
import { ambiente } from "../configuracao/ambiente.js";
import {
  reiniciarPoolOracle,
  testarOracleConfiguracao,
} from "../banco/oracle.js";

export async function buscarUsuariosPorLogin(login: string) {
  const id = login.trim().toLowerCase(),
    email = id.includes("@");
  return consultar<any>(
    `SELECT id,nome,email,perfil_id,administrador,superadmin,ativo,COALESCE(alterar_senha_proximo_login,FALSE) alterar_senha_proximo_login FROM usuarios WHERE ${email ? "LOWER(email)=LOWER($1)" : "LOWER(SPLIT_PART(email,'@',1))=LOWER($1)"} AND ativo=TRUE AND excluido=FALSE ORDER BY email`,
    [id],
  );
}
export async function verificarSenhaUsuario(id: number, senha: string) {
  return Boolean(
    (
      await consultarUm<any>(
        "SELECT senha_hash=CRYPT($1,senha_hash) valida FROM usuarios WHERE id=$2 AND ativo=TRUE AND excluido=FALSE",
        [senha, id],
      )
    )?.valida,
  );
}
export async function alterarSenhaUsuario(id: number, senha: string) {
  return consultarUm(
    "UPDATE usuarios SET senha_hash=CRYPT($2,GEN_SALT('bf')),alterar_senha_proximo_login=FALSE,alterado_em=NOW(),alterado_por_usuario_id=$1 WHERE id=$1 RETURNING id",
    [id, senha],
  );
}
export async function listarEmpresasDoUsuario(id: number) {
  return consultar<any>(
    "SELECT e.id,e.codigo_empresa,e.razao_social,e.nome_fantasia,e.nome_exibido,e.caminho_logo,e.caminho_imagem_fundo,e.dominio_publico,ue.padrao FROM usuarios_empresas ue JOIN empresas e ON e.id=ue.empresa_id WHERE ue.usuario_id=$1 AND ue.ativo=TRUE AND e.ativa=TRUE AND e.excluido=FALSE ORDER BY ue.padrao DESC,e.nome_fantasia",
    [id],
  );
}
export async function permissoesUsuario(id: number, empresaId: number) {
  const u = await consultarUm<any>(
    "SELECT perfil_id,administrador,superadmin FROM usuarios WHERE id=$1",
    [id],
  );
  if (u?.administrador || u?.superadmin)
    return (
      await consultar<any>("SELECT codigo FROM acoes WHERE ativo=TRUE")
    ).map((x) => x.codigo);
  return (
    await consultar<any>(
      "SELECT DISTINCT a.codigo FROM perfis_permissoes pp JOIN acoes a ON a.id=pp.acao_id WHERE pp.perfil_id=$1 AND (pp.empresa_id=$2 OR pp.empresa_id IS NULL) AND pp.permitido=TRUE AND a.ativo=TRUE",
      [u?.perfil_id, empresaId],
    )
  ).map((x) => x.codigo);
}
export const listarEmpresas = () =>
  consultar(
    "SELECT id,codigo_empresa,razao_social,nome_fantasia,cnpj,dominio_publico,nome_exibido,caminho_logo,caminho_imagem_fundo,cor_primaria,cor_secundaria,ativa FROM empresas WHERE excluido=FALSE ORDER BY nome_fantasia",
  );
export async function salvarEmpresa(b: any, uid: number) {
  return consultarUm(
    `INSERT INTO empresas(codigo_empresa,razao_social,nome_fantasia,cnpj,dominio_publico,nome_exibido,caminho_logo,caminho_imagem_fundo,cor_primaria,cor_secundaria,ativa,criado_por_usuario_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,TRUE),$12) ON CONFLICT(codigo_empresa) DO UPDATE SET razao_social=EXCLUDED.razao_social,nome_fantasia=EXCLUDED.nome_fantasia,cnpj=EXCLUDED.cnpj,dominio_publico=EXCLUDED.dominio_publico,nome_exibido=EXCLUDED.nome_exibido,caminho_logo=EXCLUDED.caminho_logo,caminho_imagem_fundo=EXCLUDED.caminho_imagem_fundo,cor_primaria=EXCLUDED.cor_primaria,cor_secundaria=EXCLUDED.cor_secundaria,ativa=EXCLUDED.ativa,alterado_em=NOW(),alterado_por_usuario_id=$12 RETURNING *`,
    [
      b.codigo_empresa,
      b.razao_social,
      b.nome_fantasia,
      b.cnpj ?? null,
      b.dominio_publico ?? null,
      b.nome_exibido ?? b.nome_fantasia,
      b.caminho_logo ?? null,
      b.caminho_imagem_fundo ?? null,
      b.cor_primaria ?? "#2EE66F",
      b.cor_secundaria ?? "#101827",
      b.ativa ?? true,
      uid,
    ],
  );
}
export const listarPerfis = () =>
  consultar(
    "SELECT id,codigo,nome,descricao,administrador,ativo FROM perfis WHERE excluido=FALSE ORDER BY nome",
  );
export async function salvarPerfil(b: any, uid: number) {
  return consultarUm(
    `INSERT INTO perfis(codigo,nome,descricao,administrador,ativo,criado_por_usuario_id) VALUES($1,$2,$3,COALESCE($4,FALSE),COALESCE($5,TRUE),$6) ON CONFLICT(codigo) DO UPDATE SET nome=EXCLUDED.nome,descricao=EXCLUDED.descricao,administrador=EXCLUDED.administrador,ativo=EXCLUDED.ativo,alterado_em=NOW(),alterado_por_usuario_id=$6 RETURNING *`,
    [
      b.codigo,
      b.nome,
      b.descricao ?? null,
      b.administrador ?? false,
      b.ativo ?? true,
      uid,
    ],
  );
}
export const listarUsuarios = () =>
  consultar(
    "SELECT u.id,u.perfil_id,u.nome,u.email,u.ativo,u.administrador,u.superadmin,u.ultimo_acesso_em,p.nome perfil_nome,COALESCE(array_agg(ue.empresa_id) FILTER(WHERE ue.empresa_id IS NOT NULL),'{}') empresas_ids FROM usuarios u LEFT JOIN perfis p ON p.id=u.perfil_id LEFT JOIN usuarios_empresas ue ON ue.usuario_id=u.id AND ue.ativo=TRUE WHERE u.excluido=FALSE GROUP BY u.id,p.nome ORDER BY u.nome",
  );
export async function salvarUsuario(b: any, uid: number) {
  const u = await consultarUm<any>(
    `INSERT INTO usuarios(perfil_id,nome,email,senha_hash,ativo,administrador,superadmin,alterar_senha_proximo_login,criado_por_usuario_id) VALUES($1,$2,LOWER($3),CRYPT(COALESCE(NULLIF($4,''),'controls'),GEN_SALT('bf')),COALESCE($5,TRUE),COALESCE($6,FALSE),COALESCE($7,FALSE),CASE WHEN NULLIF($4,'') IS NOT NULL THEN TRUE ELSE FALSE END,$8) ON CONFLICT(email) DO UPDATE SET perfil_id=EXCLUDED.perfil_id,nome=EXCLUDED.nome,senha_hash=CASE WHEN NULLIF($4,'') IS NOT NULL THEN CRYPT($4,GEN_SALT('bf')) ELSE usuarios.senha_hash END,alterar_senha_proximo_login=CASE WHEN NULLIF($4,'') IS NOT NULL THEN TRUE ELSE usuarios.alterar_senha_proximo_login END,ativo=EXCLUDED.ativo,administrador=EXCLUDED.administrador,superadmin=EXCLUDED.superadmin,alterado_em=NOW(),alterado_por_usuario_id=$8 RETURNING id`,
    [
      b.perfil_id ?? null,
      b.nome,
      b.email,
      b.senha ?? null,
      b.ativo ?? true,
      b.administrador ?? false,
      b.superadmin ?? false,
      uid,
    ],
  );
  if (b.empresas_ids?.length) {
    await consultar("DELETE FROM usuarios_empresas WHERE usuario_id=$1", [
      u.id,
    ]);
    for (const [i, e] of b.empresas_ids.entries())
      await consultar(
        "INSERT INTO usuarios_empresas(usuario_id,empresa_id,padrao,ativo) VALUES($1,$2,$3,TRUE) ON CONFLICT(usuario_id,empresa_id) DO UPDATE SET padrao=EXCLUDED.padrao,ativo=TRUE",
        [u.id, e, i === 0],
      );
  }
  return u;
}
export const excluirLogico = (tabela: string, id: number, uid: number) =>
  consultarUm(
    `UPDATE ${tabela} SET excluido=TRUE,${tabela === "empresas" ? "ativa" : "ativo"}=FALSE,excluido_em=NOW(),excluido_por_usuario_id=$2 WHERE id=$1 RETURNING id`,
    [id, uid],
  );
export async function listarPermissoesPerfil(
  perfilId: number,
  empresaId: number,
) {
  return consultar(
    `WITH P AS (SELECT administrador FROM perfis WHERE id=$1), RECURSOS AS (
      SELECT 'MODULO' tipo,m.id referencia_id,m.codigo,m.nome FROM modulos m WHERE m.ativo=TRUE
      UNION ALL SELECT 'MENU',me.id,me.codigo,me.nome FROM menus me WHERE me.ativo=TRUE
      UNION ALL SELECT 'TELA',t.id,t.codigo,t.nome FROM telas t WHERE t.ativo=TRUE
      UNION ALL SELECT 'ACAO',a.id,a.codigo,a.nome FROM acoes a WHERE a.ativo=TRUE
      UNION ALL SELECT 'FONTE',f.id,f.nome,f.descricao FROM gestao_fonte_dados f WHERE f.ativo=TRUE
      UNION ALL SELECT 'RELATORIO',NULL,'FLUXO_RESUMO','Resumo do fluxo de caixa'
      UNION ALL SELECT 'RELATORIO',NULL,'FLUXO_GRADE','Grade diária, semanal e mensal'
      UNION ALL SELECT 'RELATORIO',NULL,'FLUXO_DETALHES','Detalhamento por documento'
      UNION ALL SELECT 'RELATORIO',NULL,'FLUXO_INSIGHTS','Insights automáticos'
    ) SELECT r.*,((SELECT administrador FROM P) OR EXISTS(SELECT 1 FROM gestao_perfil_recurso pr WHERE pr.perfil_id=$1 AND (pr.empresa_id=$2 OR pr.empresa_id IS NULL) AND pr.tipo_recurso=r.tipo AND pr.recurso_codigo=r.codigo AND pr.permitido=TRUE)) permitido FROM RECURSOS r ORDER BY CASE r.tipo WHEN 'MODULO' THEN 1 WHEN 'MENU' THEN 2 WHEN 'TELA' THEN 3 WHEN 'RELATORIO' THEN 4 WHEN 'FONTE' THEN 5 ELSE 6 END,r.nome`,
    [perfilId, empresaId],
  );
}
export async function salvarPermissoesPerfil(
  perfilId: number,
  empresaId: number,
  itens: any[],
) {
  await consultar(
    "DELETE FROM perfis_permissoes WHERE perfil_id=$1 AND empresa_id=$2",
    [perfilId, empresaId],
  );
  await consultar(
    "DELETE FROM gestao_perfil_recurso WHERE perfil_id=$1 AND empresa_id=$2",
    [perfilId, empresaId],
  );
  for (const i of itens)
    if (["MODULO", "MENU", "TELA", "ACAO"].includes(i.tipo))
      await consultar(
        "INSERT INTO perfis_permissoes(perfil_id,empresa_id,modulo_id,menu_id,tela_id,acao_id,permitido) VALUES($1,$2,$3,$4,$5,$6,TRUE)",
        [
          perfilId,
          empresaId,
          i.tipo === "MODULO" ? i.referencia_id : null,
          i.tipo === "MENU" ? i.referencia_id : null,
          i.tipo === "TELA" ? i.referencia_id : null,
          i.tipo === "ACAO" ? i.referencia_id : null,
        ],
      );
    else
      await consultar(
        "INSERT INTO gestao_perfil_recurso(perfil_id,empresa_id,tipo_recurso,recurso_codigo,permitido) VALUES($1,$2,$3,$4,TRUE)",
        [perfilId, empresaId, i.tipo, i.codigo],
      );
}
export async function podeAcessarRecurso(
  usuarioId: number,
  empresaId: number,
  tipo: string,
  codigo: string,
) {
  const u = await consultarUm<any>(
    "SELECT perfil_id,administrador,superadmin FROM usuarios WHERE id=$1",
    [usuarioId],
  );
  if (u?.administrador || u?.superadmin) return true;
  return Boolean(
    await consultarUm(
      "SELECT id FROM gestao_perfil_recurso WHERE perfil_id=$1 AND (empresa_id=$2 OR empresa_id IS NULL) AND tipo_recurso=$3 AND recurso_codigo=$4 AND permitido=TRUE",
      [u?.perfil_id, empresaId, tipo, codigo],
    ),
  );
}

export const listarConexoesOracle = () =>
  consultar(
    "SELECT id,nome,host,porta,servico,usuario,ativa,ultimo_teste_em,ultimo_teste_sucesso,ultimo_teste_mensagem,criado_em,atualizado_em FROM gestao_conexao_oracle ORDER BY ativa DESC,nome",
  );
export async function salvarConexaoOracle(b: any) {
  await reiniciarPoolOracle();
  if (b.id)
    return consultarUm(
      `UPDATE gestao_conexao_oracle SET nome=$2,host=$3,porta=$4,servico=$5,usuario=$6,senha_criptografada=CASE WHEN NULLIF($7,'') IS NULL THEN senha_criptografada ELSE PGP_SYM_ENCRYPT($7,$8) END,ativa=$9,atualizado_em=NOW() WHERE id=$1 RETURNING id,nome,host,porta,servico,usuario,ativa`,
      [
        b.id,
        b.nome,
        b.host,
        Number(b.porta || 1521),
        b.servico,
        b.usuario,
        b.senha ?? null,
        ambiente.jwtSecret,
        b.ativa !== false,
      ],
    );
  return consultarUm(
    `INSERT INTO gestao_conexao_oracle(nome,host,porta,servico,usuario,senha_criptografada,ativa) VALUES($1,$2,$3,$4,$5,PGP_SYM_ENCRYPT($6,$7),$8) RETURNING id,nome,host,porta,servico,usuario,ativa`,
    [
      b.nome,
      b.host,
      Number(b.porta || 1521),
      b.servico,
      b.usuario,
      b.senha,
      ambiente.jwtSecret,
      b.ativa !== false,
    ],
  );
}
export async function testarConexaoOracle(id: number) {
  await reiniciarPoolOracle();
  try {
    const resultado: any = await testarOracleConfiguracao(id);
    await consultar(
      "UPDATE gestao_conexao_oracle SET ultimo_teste_em=NOW(),ultimo_teste_sucesso=TRUE,ultimo_teste_mensagem='Conexão realizada com sucesso' WHERE id=$1",
      [id],
    );
    return { sucesso: true, dataServidor: resultado.rows?.[0]?.DATA_SERVIDOR };
  } catch (e: any) {
    await consultar(
      "UPDATE gestao_conexao_oracle SET ultimo_teste_em=NOW(),ultimo_teste_sucesso=FALSE,ultimo_teste_mensagem=$2 WHERE id=$1",
      [id, e.message],
    );
    throw e;
  }
}
