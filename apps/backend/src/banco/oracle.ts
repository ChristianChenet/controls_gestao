import oracledb from 'oracledb';
import { ambiente } from '../configuracao/ambiente.js';

let pool: any = null;
export function oracleConfigurado() {
  return Boolean(ambiente.oracle.user && ambiente.oracle.password && ambiente.oracle.connectionString);
}
async function obterPool() {
  if (!oracleConfigurado()) throw new Error('Conexão Oracle não configurada. Informe ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECTION_STRING.');
  pool ??= await oracledb.createPool({ ...ambiente.oracle, poolAlias: 'control-s-gestao' });
  return pool;
}
export async function executarOracle<T = Record<string, unknown>>(sql: string, parametros: Record<string, unknown> = {}, maxRows = 50000) {
  if (!/^\s*(select|with)\b/i.test(sql) || /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|execute|begin)\b/i.test(sql)) {
    throw new Error('A fonte de dados aceita somente SELECT ou WITH em modo de leitura.');
  }
  const conexao = await (await obterPool()).getConnection();
  try {
    const resultado = await conexao.execute(sql, parametros, { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows });
    return (resultado.rows ?? []) as T[];
  } finally { await conexao.close(); }
}
