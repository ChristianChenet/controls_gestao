# Arquitetura do Fluxo de Caixa

O projeto replica a stack e os padrões essenciais do Control S Hub (Fastify, React/Vite, TypeScript, PostgreSQL, JWT e permissões por ações) sem alterar o projeto original. O mecanismo Oracle usa `oracledb`, pool, parâmetros nomeados e fechamento garantido das conexões, tomando o Control S API Hub apenas como referência técnica.

## Fontes Oracle validadas

- Grupos e estabelecimentos: `GRUPOESTAB → GRUPOESTABFILIAL → FILIAL`. O objeto `GRUPOFILIAL` existe no esquema MCP, mas não possui colunas no dicionário fornecido; por isso não é usado como fonte operacional.
- Saldo: `PORTADOR` e `PORTADORSALDO`. Financeiro usa `ENTRADAS - SAIDAS`; conciliado usa `ENTCONCILIADA - SAICONCILIADA`.
- Títulos previstos: `DUPREC`, `DUPPAG` e funções nativas `BAIXASDUPREC` / `BAIXASDUPPAG`.
- Pagamentos realizados: `DUPPAG → DUPPAGACERFIN`, pela data efetiva `DTPGTO`.
- Dinheiro realizado: `NOTA → NOTAACERFIN → ACERDIN → LANFIN`.
- Cartão de débito realizado: `NOTA → NOTAACERFIN → ACERCAR → CARTAO`.
- PIX realizado: `NOTA → NOTAACERFIN → ACERCARTDIG → CARTDIG → LANFIN`, limitado a `TRANSACAOPIXOK = 'S'`.

`PREVFINFLUXOCAIXA` não é usada, mesmo aparecendo em um catálogo exportado. `MOVFINECF` também não é usado na previsão, conforme definição funcional atual. Todas as consultas iniciais ficam comentadas e editáveis no portal.

## Previsão inteligente

O serviço lê três meses completos anteriores ao início do período, agrupa recebimentos reais por forma e dia da semana e aplica a média ao mesmo dia da semana futuro. Valores sem histórico permanecem zero, sem estimativa inventada.

## Segurança e rastreabilidade

As rotas exigem JWT e ação específica. O executor aceita comandos Oracle completos, usa binds e mantém `autoCommit` desativado. Consultas retornadas pela interface são limitadas. Cada teste gera log; cada edição preserva versão anterior; publicação registra usuário e data.

## Pendências conscientes

- Os IDs de situação de provisão, pessoas intercompany e regras de adiantamento devem ser cadastrados no portal. Nenhum valor foi fixado no código.
- A conexão com uma instância Oracle e PostgreSQL reais é necessária para validar tempos, planos de execução e dados financeiros.
