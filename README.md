# Control S Gestão

Primeiro módulo independente do ecossistema Control S: **Fluxo de Caixa Premium**.

## Executar

1. Copie `.env.example` para `.env` e configure PostgreSQL e Oracle.
2. Execute as migrations `database/migrations/001_estrutura_inicial.sql` e `002_modulo_gestao_fluxo_caixa.sql`.
3. Rode `npm install` e `npm run build`.
4. Desenvolvimento: `npm run dev:backend` e `npm run dev:frontend`.

O Oracle é acessado em modo somente leitura, com pool e binds. As fontes SQL ficam versionadas no PostgreSQL e só podem ser vistas, testadas, editadas e publicadas com as permissões correspondentes.
