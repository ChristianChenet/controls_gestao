import 'dotenv/config';

export const ambiente = {
  porta: Number(process.env.PORT ?? 3340),
  host: process.env.HOST ?? '0.0.0.0',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5175',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'desenvolvimento-control-s-gestao',
  oracle: {
    user: process.env.ORACLE_USER ?? '',
    password: process.env.ORACLE_PASSWORD ?? '',
    connectionString: process.env.ORACLE_CONNECTION_STRING ?? '',
    poolMin: Number(process.env.ORACLE_POOL_MIN ?? 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX ?? 6),
    poolIncrement: Number(process.env.ORACLE_POOL_INCREMENT ?? 1)
  }
};
