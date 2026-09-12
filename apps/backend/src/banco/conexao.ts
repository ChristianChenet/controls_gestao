import pg from 'pg';
import { ambiente } from '../configuracao/ambiente.js';

export const poolPostgres = new pg.Pool({ connectionString: ambiente.databaseUrl });
export async function consultar<T = Record<string, unknown>>(sql: string, parametros: unknown[] = []) {
  return (await poolPostgres.query(sql, parametros)).rows as T[];
}
export async function consultarUm<T = Record<string, unknown>>(sql: string, parametros: unknown[] = []) {
  return (await consultar<T>(sql, parametros))[0] ?? null;
}
