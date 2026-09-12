import { consultar, consultarUm } from "../../banco/conexao.js";
import { executarOracle, oracleConfigurado } from "../../banco/oracle.js";
import { FONTES_INICIAIS } from "./sqlFontes.js";

type Filtros = {
  dataInicial: string;
  dataFinal: string;
  estab?: number | null;
  idPortador?: number | null;
  tipoSaldo?: string;
  mostraProvisao?: boolean;
  mostraAdiantamento?: boolean;
  mostraEmprestimo?: boolean;
  usaPrevisaoInteligente?: boolean;
  formasPrevisao?: string[];
};
const fonte = (nome: string) =>
  consultarUm<any>(
    "SELECT * FROM gestao_fonte_dados WHERE nome=$1 AND ativo=TRUE",
    [nome],
  );
const numero = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => new Date(String(v)).toISOString().slice(0, 10);

export async function garantirFontes(usuarioId: number) {
  for (const [nome, descricao, categoria, sql] of FONTES_INICIAIS)
    await consultar(
      `INSERT INTO gestao_fonte_dados(nome,descricao,categoria,banco_origem,tipo,sql_texto,parametros_json,criado_por) VALUES($1,$2,$3,'ORACLE','SELECT',$4,'{}',$5) ON CONFLICT(nome) DO NOTHING`,
      [nome, descricao, categoria, sql, usuarioId],
    );
}
function previsao(detalhes: any[], ini: string, fim: string, formas: string[]) {
  const medias = new Map<string, number[]>();
  detalhes.forEach((r) => {
    const chave = `${r.TIPO_FINALIZADOR ?? r.tipo_finalizador}-${new Date(r.DATA_RECEBIMENTO ?? r.data_recebimento).getDay()}`;
    const a = medias.get(chave) ?? [];
    a.push(numero(r.VALOR ?? r.valor));
    medias.set(chave, a);
  });
  const resultado: any[] = [];
  for (
    let d = new Date(`${ini}T12:00:00`), limite = new Date(`${fim}T12:00:00`);
    d <= limite;
    d.setDate(d.getDate() + 1)
  ) {
    for (const forma of formas) {
      const a = medias.get(`${forma}-${d.getDay()}`) ?? [];
      resultado.push({
        data_fluxo: d.toISOString().slice(0, 10),
        forma,
        valor: a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
      });
    }
  }
  return resultado;
}
export async function processarFluxo(f: Filtros, usuarioId: number) {
  const processo = await consultarUm<any>(
    `INSERT INTO gestao_fluxo_processo(usuario_id,escopo,estab_oracle,data_inicial,data_final,saldo_conciliado,mostra_provisao,mostra_adiantamento,mostra_emprestimo,usa_previsao_inteligente,parametros_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      usuarioId,
      f.estab ? "LOJA" : "CONSOLIDADO",
      f.estab ?? null,
      f.dataInicial,
      f.dataFinal,
      f.tipoSaldo === "CONCILIADO",
      !!f.mostraProvisao,
      !!f.mostraAdiantamento,
      !!f.mostraEmprestimo,
      f.usaPrevisaoInteligente !== false,
      JSON.stringify(f),
    ],
  );
  try {
    if (!oracleConfigurado())
      throw new Error(
        "Oracle não configurado. Configure o .env para processar dados reais.",
      );
    const saldoFonte = await fonte("oracle_fluxo_saldo_portador"),
      movFonte = await fonte("oracle_fluxo_movimentos_detalhe"),
      prevFonte = await fonte("oracle_fluxo_previsao_recebimentos_historico");
    const binds: any = {
      P_DTINI: new Date(f.dataInicial),
      P_DTFIM: new Date(f.dataFinal),
      P_ESTAB: f.estab ?? null,
      P_IDPORTADOR: f.idPortador ?? null,
      P_TIPO_SALDO: f.tipoSaldo ?? "FINANCEIRO",
    };
    const saldos = await executarOracle<any>(saldoFonte.sql_texto, binds);
    const movimentos = await executarOracle<any>(movFonte.sql_texto, binds);
    const historico =
      f.usaPrevisaoInteligente !== false
        ? await executarOracle<any>(prevFonte.sql_texto, binds)
        : [];
    const proj = previsao(
      historico,
      f.dataInicial,
      f.dataFinal,
      f.formasPrevisao ?? ["DINHEIRO", "PIX", "CARTAO_DEBITO"],
    );
    const classificacoes = await consultar<any>(
      "SELECT * FROM gestao_fluxo_classificacao WHERE ativo=TRUE ORDER BY id",
    );
    const classificar = (m: any) =>
      classificacoes.find(
        (c) =>
          (!c.origem || c.origem === m.ORIGEM_MOVIMENTO) &&
          (!c.estab_oracle || c.estab_oracle === m.ESTAB) &&
          (!c.idsituacao_oracle ||
            c.idsituacao_oracle === m.ID_SITUACAO_ORACLE) &&
          (!c.idanalitica_oracle ||
            c.idanalitica_oracle === m.ID_ANALITICA_ORACLE) &&
          (!c.idpess_oracle || c.idpess_oracle === m.ID_PESSOA_ORACLE) &&
          (!c.texto_contem ||
            String(m.HISTORICO ?? "")
              .toUpperCase()
              .includes(String(c.texto_contem).toUpperCase())),
      )?.tipo_especial ?? "NORMAL";
    let detalhes = movimentos.map((m) => ({
      ...m,
      tipo_especial: classificar(m),
    }));
    detalhes = detalhes.filter(
      (m) =>
        (m.tipo_especial !== "PROVISAO" || f.mostraProvisao) &&
        (!String(m.tipo_especial).startsWith("ADIANTAMENTO") ||
          f.mostraAdiantamento) &&
        (m.tipo_especial !== "EMPRESTIMO_INTERLOJAS" || f.mostraEmprestimo),
    );
    for (const m of detalhes) {
      const data =
        iso(m.DATA_FLUXO) < f.dataInicial ? f.dataInicial : iso(m.DATA_FLUXO);
      await consultar(
        `INSERT INTO gestao_fluxo_detalhe(processo_id,estab_oracle,data_fluxo,tipo_movimento,grupo_movimento,tipo_especial,origem_movimento,id_documento_oracle,documento,id_portador_oracle,id_pessoa_oracle,id_situacao_oracle,id_analitica_oracle,data_emissao,data_vencimento,valor_original,valor_entrada,valor_saida,valor_liquido,vencido_antes_periodo,historico,dados_origem_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          processo.id,
          m.ESTAB,
          data,
          m.TIPO_MOVIMENTO,
          m.GRUPO_MOVIMENTO,
          m.tipo_especial,
          m.ORIGEM_MOVIMENTO,
          m.ID_DOCUMENTO_ORACLE,
          m.DOCUMENTO,
          m.ID_PORTADOR_ORACLE,
          m.ID_PESSOA_ORACLE,
          m.ID_SITUACAO_ORACLE,
          m.ID_ANALITICA_ORACLE,
          m.DATA_EMISSAO,
          m.DATA_VENCIMENTO,
          m.VALOR_ORIGINAL ?? 0,
          m.VALOR_ENTRADA ?? 0,
          m.VALOR_SAIDA ?? 0,
          numero(m.VALOR_ENTRADA) - numero(m.VALOR_SAIDA),
          iso(m.DATA_FLUXO) < f.dataInicial,
          m.HISTORICO,
          JSON.stringify(m),
        ],
      );
    }
    const saldoInicial = saldos.reduce((s, r) => s + numero(r.SALDO), 0);
    let acumulado = saldoInicial;
    for (
      let d = new Date(`${f.dataInicial}T12:00:00`),
        fim = new Date(`${f.dataFinal}T12:00:00`);
      d <= fim;
      d.setDate(d.getDate() + 1)
    ) {
      const data = d.toISOString().slice(0, 10),
        itens = detalhes.filter(
          (x) =>
            (iso(x.DATA_FLUXO) < f.dataInicial
              ? f.dataInicial
              : iso(x.DATA_FLUXO)) === data,
        ),
        ent = itens.reduce((s, x) => s + numero(x.VALOR_ENTRADA), 0),
        sai = itens.reduce((s, x) => s + numero(x.VALOR_SAIDA), 0),
        pp = proj.filter((x) => x.data_fluxo === data),
        pi = pp.reduce((s, x) => s + x.valor, 0),
        inicial = acumulado;
      acumulado += ent + pi - sai;
      await consultar(
        `INSERT INTO gestao_fluxo_dia(processo_id,estab_oracle,data_fluxo,disponivel_inicial,entradas_previstas,entradas_realizadas,saidas_previstas,saidas_realizadas,previsao_dinheiro,previsao_pix,previsao_cartao_debito,previsao_inteligente,movimento_liquido,saldo_projetado,status_caixa) VALUES($1,$2,$3,$4,$5,0,$6,0,$7,$8,$9,$10,$11,$12,$13)`,
        [
          processo.id,
          f.estab ?? null,
          data,
          inicial,
          ent + pi,
          sai,
          pp.find((x) => x.forma === "DINHEIRO")?.valor ?? 0,
          pp.find((x) => x.forma === "PIX")?.valor ?? 0,
          pp.find((x) => x.forma === "CARTAO_DEBITO")?.valor ?? 0,
          pi,
          ent + pi - sai,
          acumulado,
          acumulado < 0 ? "NEGATIVO" : "POSITIVO",
        ],
      );
    }
    const menor = await consultarUm<any>(
      "SELECT * FROM gestao_fluxo_dia WHERE processo_id=$1 ORDER BY saldo_projetado LIMIT 1",
      [processo.id],
    );
    if (numero(menor?.saldo_projetado) < 0)
      await consultar(
        `INSERT INTO gestao_fluxo_insight(processo_id,tipo,severidade,titulo,descricao,data_referencia,valor_referencia,filtro_json) VALUES($1,'SALDO_NEGATIVO','CRITICO','Caixa projetado negativo','O saldo projetado atinge o menor valor do período nesta data.',$2,$3,$4)`,
        [
          processo.id,
          menor.data_fluxo,
          menor.saldo_projetado,
          JSON.stringify({ data: menor.data_fluxo }),
        ],
      );
    const maiorNecessidade = await consultarUm<any>(
      "SELECT *,saidas_previstas-entradas_previstas AS necessidade FROM gestao_fluxo_dia WHERE processo_id=$1 ORDER BY necessidade DESC LIMIT 1",
      [processo.id],
    );
    if (numero(maiorNecessidade?.necessidade) > 0)
      await consultar(
        `INSERT INTO gestao_fluxo_insight(processo_id,tipo,severidade,titulo,descricao,data_referencia,valor_referencia,filtro_json) VALUES($1,'NECESSIDADE_CAIXA','ATENCAO','Maior necessidade diária de caixa','Neste dia, as contas a pagar superam as contas a receber. Planeje reserva, antecipação ou renegociação.',$2,$3,$4)`,
        [
          processo.id,
          maiorNecessidade.data_fluxo,
          maiorNecessidade.necessidade,
          JSON.stringify({
            data: maiorNecessidade.data_fluxo,
            entradas: maiorNecessidade.entradas_previstas,
            saidas: maiorNecessidade.saidas_previstas,
          }),
        ],
      );
    await consultar(
      "UPDATE gestao_fluxo_processo SET status='CONCLUIDO',concluido_em=NOW() WHERE id=$1",
      [processo.id],
    );
    return processo.id;
  } catch (e: any) {
    await consultar(
      "UPDATE gestao_fluxo_processo SET status='ERRO',mensagem=$2,concluido_em=NOW() WHERE id=$1",
      [processo.id, e.message],
    );
    throw e;
  }
}
