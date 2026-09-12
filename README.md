# Control S Gestão

Primeiro módulo independente do ecossistema Control S: **Fluxo de Caixa Premium**.

## Executar

1. Copie `.env.example` para `.env` e configure PostgreSQL e Oracle.
2. Execute as migrations `database/migrations/001_estrutura_inicial.sql` e `002_modulo_gestao_fluxo_caixa.sql`.
3. Rode `npm install` e `npm run build`.
4. Desenvolvimento: `npm run dev:backend` e `npm run dev:frontend`.

## Serviço do Windows

Com o NSSM em `C:\nssm\win64\nssm.exe`, execute **como administrador** `INSTALAR_SERVICO_WINDOWS.cmd`. Serão instalados os serviços automáticos `ControlSGestaoBackend` e `ControlSGestaoFrontend`, seguindo o padrão operacional do Control S Hub. A aplicação ficará disponível em `http://localhost:5175`.

O Oracle é acessado em modo somente leitura, com pool e binds. As fontes SQL ficam versionadas no PostgreSQL e só podem ser vistas, testadas, editadas e publicadas com as permissões correspondentes.
