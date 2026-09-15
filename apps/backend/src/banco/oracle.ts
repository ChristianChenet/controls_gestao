import oracledb from "oracledb";
import { ambiente } from "../configuracao/ambiente.js";
import { consultarUm } from "./conexao.js";

let pool: any = null;
export async function oracleConfigurado() {
  if (
    ambiente.oracle.user &&
    ambiente.oracle.password &&
    ambiente.oracle.connectionString
  )
    return true;
  return Boolean(
    await consultarUm(
      "SELECT id FROM gestao_conexao_oracle WHERE ativa=TRUE ORDER BY id LIMIT 1",
    ),
  );
}
async function obterPool() {
  if (!pool) {
    let configuracao: any = ambiente.oracle;
    if (
      !ambiente.oracle.user ||
      !ambiente.oracle.password ||
      !ambiente.oracle.connectionString
    ) {
      const c = await consultarUm<any>(
        "SELECT usuario,PGP_SYM_DECRYPT(senha_criptografada,$1) senha,host||':'||porta||'/'||servico connection_string FROM gestao_conexao_oracle WHERE ativa=TRUE ORDER BY id LIMIT 1",
        [ambiente.jwtSecret],
      );
      if (!c)
        throw new Error(
          "Conexão Oracle não configurada. Cadastre-a em Configurações > Conexão Oracle.",
        );
      configuracao = {
        user: c.usuario,
        password: c.senha,
        connectionString: c.connection_string,
        poolMin: 1,
        poolMax: 6,
        poolIncrement: 1,
      };
    }
    pool = await oracledb.createPool({
      ...configuracao,
      poolAlias: "control-s-gestao",
    });
  }
  return pool;
}
export async function reiniciarPoolOracle() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}
export async function testarOracleConfiguracao(id: number) {
  const c = await consultarUm<any>(
    "SELECT usuario,PGP_SYM_DECRYPT(senha_criptografada,$2) senha,host||':'||porta||'/'||servico connection_string FROM gestao_conexao_oracle WHERE id=$1",
    [id, ambiente.jwtSecret],
  );
  if (!c) throw new Error("Conexão Oracle não encontrada.");
  const conexao = await oracledb.getConnection({
    user: c.usuario,
    password: c.senha,
    connectionString: c.connection_string,
  });
  try {
    return await conexao.execute(
      "SELECT SYSDATE DATA_SERVIDOR FROM DUAL",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 },
    );
  } finally {
    await conexao.close();
  }
}
export function prepararBindsOracle(
  sql: string,
  parametros: Record<string, unknown> = {},
) {
  if (!sql.trim()) throw new Error("Informe o comando Oracle a executar.");
  const sqlSemComentariosELiterais = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");
  const nomesBinds = Array.from(
    new Set(
      Array.from(
        sqlSemComentariosELiterais.matchAll(/:([A-Z_][A-Z0-9_$#]*|\d+)/gi),
      ).map((resultado) => resultado[1].toUpperCase()),
    ),
  );
  const parametrosNormalizados = Object.fromEntries(
    Object.entries(parametros).map(([chave, valor]) => [
      chave.toUpperCase(),
      valor,
    ]),
  );
  const ausentes = nomesBinds.filter(
    (nome) =>
      !Object.prototype.hasOwnProperty.call(parametrosNormalizados, nome),
  );
  if (ausentes.length)
    throw new Error(
      `Parâmetros Oracle não informados: ${ausentes.join(", ")}.`,
    );
  return Object.fromEntries(
    nomesBinds.map((chave) => {
      const valor = parametrosNormalizados[chave];
      return [
        chave,
        /^P_DT/.test(chave) && typeof valor === "string"
          ? new Date(`${valor.slice(0, 10)}T12:00:00`)
          : valor,
      ];
    }),
  );
}
export async function executarOracle<T = Record<string, unknown>>(
  sql: string,
  parametros: Record<string, unknown> = {},
  maxRows = 50000,
) {
  if (!sql.trim()) throw new Error("Informe o comando Oracle a executar.");
  const binds = prepararBindsOracle(sql, parametros);
  const conexao = await (await obterPool()).getConnection();
  try {
    const resultado = await conexao.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows,
      autoCommit: false,
    });
    return (resultado.rows ?? []) as T[];
  } finally {
    await conexao.close();
  }
}
