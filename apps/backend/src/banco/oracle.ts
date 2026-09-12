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
export async function executarOracle<T = Record<string, unknown>>(
  sql: string,
  parametros: Record<string, unknown> = {},
  maxRows = 50000,
) {
  if (
    !/^\s*(select|with)\b/i.test(sql) ||
    /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|execute|begin)\b/i.test(
      sql,
    )
  ) {
    throw new Error(
      "A fonte de dados aceita somente SELECT ou WITH em modo de leitura.",
    );
  }
  const conexao = await (await obterPool()).getConnection();
  try {
    const resultado = await conexao.execute(sql, parametros, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows,
    });
    return (resultado.rows ?? []) as T[];
  } finally {
    await conexao.close();
  }
}
