# Control S Gestão

Primeiro módulo independente do ecossistema Control S: **Fluxo de Caixa**.

## Executar

1. Copie `.env.example` para `.env` e configure PostgreSQL e Oracle.
2. Execute as migrations `database/migrations/001_estrutura_inicial.sql` e `002_modulo_gestao_fluxo_caixa.sql`.
3. Rode `npm install` e `npm run build`.
4. Desenvolvimento: `npm run dev:backend` e `npm run dev:frontend`.

## Instalação ou atualização no Windows

Extraia o pacote final e execute somente `ATUALIZAR.cmd`. O pacote é autossuficiente e não depende de `winget` nem de internet: inclui Node.js, PostgreSQL portátil e as dependências da aplicação. O atualizador solicita elevação, instala o que for necessário, restaura os dados iniciais em uma instalação nova, aplica todas as migrações, compila e configura os serviços automáticos `ControlSGestaoBackend` e `ControlSGestaoFrontend`. Ao terminar, abre `http://localhost:5175`.

Em atualizações, o banco e o arquivo `.env` existentes são preservados. Para gerar um novo pacote completo com os dados e configurações da máquina atual, execute `scripts\windows\gerar-pacote-atualizador.ps1`.

O Oracle é acessado em modo somente leitura, com pool e binds. As fontes SQL ficam versionadas no PostgreSQL e só podem ser vistas, testadas, editadas e publicadas com as permissões correspondentes.
