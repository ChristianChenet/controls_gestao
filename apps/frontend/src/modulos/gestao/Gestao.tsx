import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Database,
  Download,
  Expand,
  Filter,
  Lightbulb,
  LogOut,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { api, BASE } from "../../servicos/api";
import { Administracao } from "./Administracao";
type Dia = {
  id: number;
  data_fluxo: string;
  disponivel_inicial: number;
  entradas_previstas: number;
  saidas_previstas: number;
  previsao_inteligente: number;
  movimento_liquido: number;
  saldo_projetado: number;
  status_caixa: string;
};
const moeda = (v: any) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const dataBr = (v: string) =>
  new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
export function Gestao({ onSair }: { onSair: () => void }) {
  const hoje = new Date(),
    final = new Date(Date.now() + 29 * 86400000);
  const [f, setF] = useState<any>({
    dataInicial: hoje.toISOString().slice(0, 10),
    dataFinal: final.toISOString().slice(0, 10),
    tipoSaldo: "FINANCEIRO",
    visao: "DIA",
    tipoMovimento: "AMBOS",
    usaPrevisaoInteligente: true,
    formasPrevisao: ["DINHEIRO", "PIX", "CARTAO_DEBITO"],
  });
  const [id, setId] = useState<number>();
  const [dias, setDias] = useState<Dia[]>([]),
    [resumo, setResumo] = useState<any>({}),
    [insights, setInsights] = useState<any[]>([]),
    [detalhes, setDetalhes] = useState<any[]>([]),
    [dia, setDia] = useState<Dia>(),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(false),
    [telaCheia, setTelaCheia] = useState(false),
    [gradeMaximizada, setGradeMaximizada] = useState(false),
    [periodoRapido, setPeriodoRapido] = useState("30_DIAS"),
    [filtrosAbertos, setFiltrosAbertos] = useState(false),
    [aba, setAba] = useState<"fluxo" | "fontes" | "administracao">("fluxo");
  const usuario = JSON.parse(localStorage.getItem("gestao_usuario") ?? "{}");
  const empresaAtiva = usuario.empresas?.[0];
  const pode = (p: string) =>
    usuario.superadmin ||
    usuario.administrador ||
    usuario.permissoes?.includes("*") ||
    usuario.permissoes?.includes(p);
  async function processar() {
    setCarregando(true);
    setErro("");
    try {
      const p = await api<any>("/gestao/fluxo-caixa/processar", {
        method: "POST",
        body: JSON.stringify(f),
      });
      setId(p.id);
      const [d, r, i, det] = await Promise.all([
        api<Dia[]>(`/gestao/fluxo-caixa/processos/${p.id}/dias`),
        api<any>(`/gestao/fluxo-caixa/processos/${p.id}/resumo`),
        pode("gestao.fluxo_caixa.ver_insights")
          ? api<any[]>(`/gestao/fluxo-caixa/processos/${p.id}/insights`)
          : [],
        pode("gestao.fluxo_caixa.ver_detalhe")
          ? api<any[]>(`/gestao/fluxo-caixa/processos/${p.id}/detalhes`)
          : [],
      ]);
      setDias(d);
      setResumo(r);
      setInsights(i);
      setDetalhes(det);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }
  const cards = [
    ["Saldo inicial", dias[0]?.disponivel_inicial, WalletCards, "neutro"],
    [
      "Saldo final projetado",
      resumo.saldo_final,
      TrendingUp,
      Number(resumo.saldo_final) < 0 ? "ruim" : "bom",
    ],
    ["Entradas previstas", resumo.entradas_previstas, ArrowUpRight, "bom"],
    ["Saídas previstas", resumo.saidas_previstas, ArrowDownRight, "ruim"],
    [
      "Menor saldo",
      resumo.menor_saldo,
      ShieldAlert,
      Number(resumo.menor_saldo) < 0 ? "ruim" : "neutro",
    ],
    [
      "Previsão inteligente",
      resumo.previsao_inteligente,
      Lightbulb,
      "destaque",
    ],
  ] as const;
  const max = Math.max(
    1,
    ...dias.map((d) =>
      Math.max(Number(d.entradas_previstas), Number(d.saidas_previstas)),
    ),
  );
  const detalhesDia = useMemo(
    () =>
      detalhes.filter(
        (x) => x.data_fluxo?.slice(0, 10) === dia?.data_fluxo?.slice(0, 10),
      ),
    [detalhes, dia],
  );
  const definirPeriodo = (
    quantidade: number,
    visao = "DIA",
    selecionado = "PERSONALIZADO",
  ) => {
    const inicio = new Date();
    const fim = new Date(inicio.getTime() + (quantidade - 1) * 86400000);
    setF({
      ...f,
      dataInicial: inicio.toISOString().slice(0, 10),
      dataFinal: fim.toISOString().slice(0, 10),
      visao,
    });
    setPeriodoRapido(selecionado);
  };
  if (!pode("gestao.acessar"))
    return (
      <div className="semAcesso">
        <ShieldAlert />
        <h1>Acesso não liberado</h1>
        <p>Solicite a permissão gestao.acessar ao administrador.</p>
        <button onClick={onSair}>Sair</button>
      </div>
    );
  return (
    <div className={`app ${telaCheia ? "fullscreen" : ""}`}>
      <aside className="nav">
        <div className="marcaProduto">
          <img src="/brand/logo-s-novo.jpg" />
          <div>
            <strong>Control S</strong>
            <span>Gestão</span>
          </div>
        </div>
        <nav>
          <button
            className={aba === "fluxo" ? "ativo" : ""}
            onClick={() => setAba("fluxo")}
          >
            <CalendarDays />
            Fluxo de Caixa
          </button>
          {pode("gestao.fonte_dados.visualizar") && (
            <button
              className={aba === "fontes" ? "ativo" : ""}
              onClick={() => setAba("fontes")}
            >
              <Database />
              Fontes de Dados
            </button>
          )}
          <button
            className={aba === "administracao" ? "ativo" : ""}
            onClick={() => setAba("administracao")}
          >
            <Settings2 />
            Configurações
          </button>
        </nav>
        <button className="sair" onClick={onSair}>
          <LogOut />
          Sair
        </button>
      </aside>
      {aba === "fontes" ? (
        <Fontes />
      ) : aba === "administracao" ? (
        <Administracao />
      ) : (
        <>
          {filtrosAbertos && (
            <button
              className="filtrosBackdrop"
              aria-label="Fechar filtros"
              onClick={() => setFiltrosAbertos(false)}
            />
          )}
          <aside className={`filtros ${filtrosAbertos ? "abertos" : ""}`}>
            <header>
              <div>
                <Filter />
                Filtros
              </div>
              <button
                onClick={() => setFiltrosAbertos(false)}
                aria-label="Fechar"
              >
                <X />
              </button>
            </header>
            <label>
              Período
              <div className="atalhos">
                {[7, 30, 60, 90].map((n) => (
                  <button
                    className={periodoRapido === `${n}_DIAS` ? "ativo" : ""}
                    onClick={() => definirPeriodo(n, "DIA", `${n}_DIAS`)}
                  >
                    {n} dias
                  </button>
                ))}
              </div>
            </label>
            <div className="duplo">
              <label>
                De
                <input
                  type="date"
                  value={f.dataInicial}
                  onChange={(e) => setF({ ...f, dataInicial: e.target.value })}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={f.dataFinal}
                  onChange={(e) => setF({ ...f, dataFinal: e.target.value })}
                />
              </label>
            </div>
            <label>
              Escopo
              <select
                value={f.escopo ?? "CONSOLIDADO"}
                onChange={(e) => setF({ ...f, escopo: e.target.value })}
              >
                <option value="CONSOLIDADO">Consolidado</option>
                <option value="LOJA">Loja</option>
                <option value="GRUPO_FILIAL">Grupo filial</option>
              </select>
            </label>
            <label>
              Grupo filial
              <input
                placeholder="Todos os grupos"
                onChange={(e) =>
                  setF({
                    ...f,
                    grupoFilialId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Empresa
              <select>
                <option>Todas as empresas</option>
              </select>
            </label>
            <div className="duplo">
              <label>
                Centro de custo
                <input
                  placeholder="Todos"
                  onChange={(e) => setF({ ...f, centroCusto: e.target.value })}
                />
              </label>
              <label>
                Categoria
                <input
                  placeholder="Todas"
                  onChange={(e) => setF({ ...f, categoria: e.target.value })}
                />
              </label>
            </div>
            <label>
              Visão financeira
              <select
                value={f.visaoFinanceira ?? "AMBOS"}
                onChange={(e) =>
                  setF({ ...f, visaoFinanceira: e.target.value })
                }
              >
                <option value="AMBOS">Realizado + projetado</option>
                <option value="REALIZADO">Somente realizado</option>
                <option value="PROJETADO">Somente projetado</option>
              </select>
            </label>
            <label>
              Loja
              <input
                placeholder="Todas as lojas"
                onChange={(e) =>
                  setF({
                    ...f,
                    estab: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label>
              Portador / conta
              <input
                placeholder="Todos os portadores"
                onChange={(e) =>
                  setF({
                    ...f,
                    idPortador: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label>
              Saldo
              <select
                value={f.tipoSaldo}
                onChange={(e) => setF({ ...f, tipoSaldo: e.target.value })}
              >
                <option value="FINANCEIRO">Financeiro</option>
                <option value="CONCILIADO">Conciliado</option>
              </select>
            </label>
            <label>
              Tipo de movimento
              <select
                value={f.tipoMovimento}
                onChange={(e) => setF({ ...f, tipoMovimento: e.target.value })}
              >
                <option value="AMBOS">Entradas e saídas</option>
                <option>Entradas</option>
                <option>Saídas</option>
              </select>
            </label>
            <div className="duplo">
              <label>
                Pessoa
                <input
                  placeholder="Todas"
                  onChange={(e) => setF({ ...f, pessoa: e.target.value })}
                />
              </label>
              <label>
                Analítica
                <input
                  placeholder="Todas"
                  onChange={(e) => setF({ ...f, analitica: e.target.value })}
                />
              </label>
            </div>
            <div className="duplo">
              <label>
                Situação
                <input
                  placeholder="Todas"
                  onChange={(e) => setF({ ...f, situacao: e.target.value })}
                />
              </label>
              <label>
                Origem
                <input
                  placeholder="Todas"
                  onChange={(e) => setF({ ...f, origem: e.target.value })}
                />
              </label>
            </div>
            <fieldset className="formasPrevisao">
              <legend>Formas da previsão</legend>
              {[
                ["DINHEIRO", "Dinheiro"],
                ["PIX", "PIX"],
                ["CARTAO_DEBITO", "Cartão débito"],
              ].map(([v, l]) => (
                <label>
                  <input
                    type="checkbox"
                    checked={f.formasPrevisao.includes(v)}
                    onChange={(e) =>
                      setF({
                        ...f,
                        formasPrevisao: e.target.checked
                          ? [...f.formasPrevisao, v]
                          : f.formasPrevisao.filter((x: string) => x !== v),
                      })
                    }
                  />
                  {l}
                </label>
              ))}
            </fieldset>
            <label className="busca">
              <Search />
              <input placeholder="Pessoa, analítica, situação..." />
            </label>
            {[
              ["mostraProvisao", "Mostrar provisões"],
              ["mostraAdiantamento", "Mostrar adiantamentos"],
              ["mostraEmprestimo", "Empréstimos interlojas"],
              ["usaPrevisaoInteligente", "Previsão inteligente"],
            ].map(([k, l]) => (
              <label className="toggle" key={k}>
                <span>{l}</span>
                <input
                  type="checkbox"
                  checked={!!f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.checked })}
                />
                <i />
              </label>
            ))}
            <button
              className="aplicar"
              disabled={carregando || !pode("gestao.fluxo_caixa.processar")}
              onClick={processar}
            >
              {carregando ? <RefreshCw className="girar" /> : <RefreshCw />}
              Atualizar fluxo
            </button>
          </aside>
          <main className="conteudo">
            <header className="topo">
              <div>
                <div className="breadcrumb">
                  Control S Gestão <ChevronRight /> Financeiro
                </div>
                <h1>Fluxo de Caixa</h1>
                <p>Visão operacional e projetada do caixa</p>
              </div>
              <div className="acoes">
                <div className="empresaTopo">
                  <img
                    src={empresaAtiva?.caminho_logo || "/brand/logo-s-novo.jpg"}
                  />
                  <div>
                    <small>Empresa ativa</small>
                    <b>
                      {empresaAtiva?.nome_exibido ||
                        empresaAtiva?.nome_fantasia ||
                        "Control S"}
                    </b>
                  </div>
                </div>
                <span>Atualizado {id ? "agora" : "—"}</span>
                <button
                  className="botaoFiltros"
                  onClick={() => setFiltrosAbertos(true)}
                >
                  <Filter /> Filtros
                </button>
                {id && pode("gestao.fluxo_caixa.exportar_excel") && (
                  <a
                    href={`${BASE}/gestao/fluxo-caixa/processos/${id}/exportar-excel`}
                    onClick={(e) => {
                      e.preventDefault();
                      fetch(e.currentTarget.href, {
                        headers: {
                          Authorization: `Bearer ${localStorage.getItem("controlSHubToken")}`,
                        },
                      })
                        .then((r) => r.blob())
                        .then((b) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(b);
                          a.download = `fluxo-caixa-${id}.xlsx`;
                          a.click();
                        });
                    }}
                  >
                    <Download />
                    Exportar
                  </a>
                )}
                <button onClick={() => setTelaCheia(!telaCheia)}>
                  <Expand />
                </button>
              </div>
            </header>
            <div className="periodosRapidos">
              <button
                className={periodoRapido === "HOJE" ? "ativo" : ""}
                onClick={() => definirPeriodo(1, "DIA", "HOJE")}
              >
                Hoje
              </button>
              <button
                className={periodoRapido === "7_DIAS" ? "ativo" : ""}
                onClick={() => definirPeriodo(7, "DIA", "7_DIAS")}
              >
                7 dias
              </button>
              <button
                className={periodoRapido === "30_DIAS" ? "ativo" : ""}
                onClick={() => definirPeriodo(30, "DIA", "30_DIAS")}
              >
                30 dias
              </button>
              <button
                className={periodoRapido === "SEMANA" ? "ativo" : ""}
                onClick={() => definirPeriodo(7, "SEMANA", "SEMANA")}
              >
                Semana
              </button>
              <button
                className={periodoRapido === "MES" ? "ativo" : ""}
                onClick={() => definirPeriodo(31, "MÊS", "MES")}
              >
                Mês
              </button>
              <span>
                {new Date(f.dataInicial + "T12:00").toLocaleDateString("pt-BR")}{" "}
                — {new Date(f.dataFinal + "T12:00").toLocaleDateString("pt-BR")}
              </span>
            </div>
            {erro && (
              <div className="aviso">
                <ShieldAlert />
                <div>
                  <b>Processamento não concluído</b>
                  <span>{erro}</span>
                </div>
                <X onClick={() => setErro("")} />
              </div>
            )}
            <section className="cards">
              {cards.map(([l, v, I, c]) => (
                <article className={c} key={l}>
                  <div>
                    <span>{l}</span>
                    <strong>{moeda(v)}</strong>
                    <small>
                      {l === "Previsão inteligente"
                        ? "Média por dia da semana"
                        : "No período selecionado"}
                    </small>
                  </div>
                  <I />
                </article>
              ))}
            </section>
            <section className="painel fluxo">
              <header>
                <div>
                  <h2>Calendário financeiro</h2>
                  <p>Saldo, entradas e saídas por dia</p>
                </div>
                <div className="segmentado">
                  {["DIA", "SEMANA", "MÊS"].map((v) => (
                    <button
                      className={f.visao === v ? "ativo" : ""}
                      onClick={() => setF({ ...f, visao: v })}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </header>
              {dias.length ? (
                <div className="calendario">
                  {dias.map((d) => (
                    <button
                      onClick={() => setDia(d)}
                      className={
                        Number(d.saldo_projetado) < 0 ? "negativo" : ""
                      }
                    >
                      <span>{dataBr(d.data_fluxo)}</span>
                      <small>
                        {new Date(
                          `${d.data_fluxo.slice(0, 10)}T12:00`,
                        ).toLocaleDateString("pt-BR", { weekday: "short" })}
                      </small>
                      <strong>{moeda(d.saldo_projetado)}</strong>
                      <em>
                        <i className="entrada" />+ {moeda(d.entradas_previstas)}
                      </em>
                      <em>
                        <i className="saida" />− {moeda(d.saidas_previstas)}
                      </em>
                      {Number(d.previsao_inteligente) > 0 && (
                        <b>
                          <Lightbulb /> {moeda(d.previsao_inteligente)}
                        </b>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="vazio">
                  <CalendarDays />
                  <h3>Seu calendário financeiro começa aqui</h3>
                  <p>
                    Defina os filtros e atualize para consultar os dados reais
                    do Oracle.
                  </p>
                </div>
              )}
            </section>
            {dias.length > 0 && (
              <section
                className={`painel gradeFluxo ${gradeMaximizada ? "maximizada" : ""}`}
              >
                <header>
                  <div>
                    <h2>Contas a pagar x contas a receber</h2>
                    <p>Visão rápida para antecipar os dias que exigem caixa</p>
                  </div>
                  <button
                    className="maximizar"
                    onClick={() => setGradeMaximizada(!gradeMaximizada)}
                  >
                    <Expand /> {gradeMaximizada ? "Restaurar" : "Maximizar"}
                  </button>
                </header>
                <div className="gradeRolagem">
                  <table>
                    <thead>
                      <tr>
                        <th>FLUXO / PERÍODO</th>
                        {dias.map((d) => (
                          <th>{dataBr(d.data_fluxo)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>(+) CONTAS A RECEBER</th>
                        {dias.map((d) => (
                          <td className="positivo">
                            {moeda(d.entradas_previstas)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th>(-) CONTAS A PAGAR</th>
                        {dias.map((d) => (
                          <td className="negativo">
                            {moeda(d.saidas_previstas)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th>(=) FLUXO LÍQUIDO</th>
                        {dias.map((d) => (
                          <td
                            className={
                              Number(d.movimento_liquido) < 0
                                ? "risco"
                                : "positivo"
                            }
                          >
                            {moeda(d.movimento_liquido)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th>(=) SALDO PROJETADO</th>
                        {dias.map((d) => (
                          <td
                            className={
                              Number(d.saldo_projetado) < 0 ? "risco" : ""
                            }
                          >
                            {moeda(d.saldo_projetado)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <div className="linhaPaineis">
              <section className="painel tendencia">
                <header>
                  <div>
                    <h2>A pagar x a receber por dia</h2>
                    <p>Verde: recebimentos · Vermelho: pagamentos</p>
                  </div>
                </header>
                <div className="barras">
                  {dias.slice(0, 14).map((d) => (
                    <div
                      className={
                        Number(d.saidas_previstas) >
                        Number(d.entradas_previstas)
                          ? "diaRisco"
                          : ""
                      }
                      title={`Líquido: ${moeda(d.movimento_liquido)}`}
                    >
                      <span
                        style={{
                          height: `${(Number(d.entradas_previstas) / max) * 100}%`,
                        }}
                      />
                      <i
                        style={{
                          height: `${(Number(d.saidas_previstas) / max) * 100}%`,
                        }}
                      />
                      <small>{dataBr(d.data_fluxo)}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="painel insights">
                <header>
                  <div>
                    <h2>Insights automáticos</h2>
                    <p>Exceções que merecem atenção</p>
                  </div>
                </header>
                {insights.length ? (
                  insights.map((i) => (
                    <article>
                      <Lightbulb />
                      <div>
                        <b>{i.titulo}</b>
                        <p>{i.descricao}</p>
                        <strong>{moeda(i.valor_referencia)}</strong>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="vazio mini">
                    <Lightbulb />
                    <p>Os alertas aparecem após o processamento.</p>
                  </div>
                )}
              </section>
            </div>
          </main>
          {dia && (
            <aside className="drawer">
              <header>
                <div>
                  <span>Detalhe do dia</span>
                  <h2>{dataBr(dia.data_fluxo)}</h2>
                </div>
                <button onClick={() => setDia(undefined)}>
                  <X />
                </button>
              </header>
              <div className="resumoDia">
                <div>
                  <span>Saldo projetado</span>
                  <strong>{moeda(dia.saldo_projetado)}</strong>
                </div>
                <div>
                  <span>Entradas</span>
                  <b className="verde">{moeda(dia.entradas_previstas)}</b>
                </div>
                <div>
                  <span>Saídas</span>
                  <b className="vermelho">{moeda(dia.saidas_previstas)}</b>
                </div>
              </div>
              <h3>Documentos</h3>
              {detalhesDia.map((x) => (
                <article>
                  <div>
                    <b>{x.pessoa || "Sem pessoa"}</b>
                    <span>
                      {x.grupo_movimento} · {x.documento}
                    </span>
                  </div>
                  <strong
                    className={
                      x.tipo_movimento === "ENTRADA" ? "verde" : "vermelho"
                    }
                  >
                    {moeda(x.valor_liquido)}
                  </strong>
                </article>
              ))}
              {!detalhesDia.length && (
                <p className="semDocs">Nenhum documento neste dia.</p>
              )}
            </aside>
          )}
        </>
      )}
    </div>
  );
}
function Fontes() {
  const [fontes, setFontes] = useState<any[]>([]),
    [selecionada, setSelecionada] = useState<any>(),
    [retorno, setRetorno] = useState("");
  useEffect(() => {
    api<any[]>("/gestao/fontes-dados").then(setFontes);
  }, []);
  async function abrir(id: number) {
    setRetorno("");
    setSelecionada(await api(`/gestao/fontes-dados/${id}`));
  }
  async function salvarFonte() {
    await api(`/gestao/fontes-dados/${selecionada.id}`, {
      method: "PUT",
      body: JSON.stringify({
        nome: selecionada.nome,
        descricao: selecionada.descricao,
        sqlTexto: selecionada.sql_texto,
        parametros: selecionada.parametros_json,
      }),
    });
    setRetorno("Nova versão salva com sucesso.");
  }
  async function testarFonte() {
    try {
      const r = await api<any>(
        `/gestao/fontes-dados/${selecionada.id}/testar`,
        {
          method: "POST",
          body: JSON.stringify({
            parametros: selecionada.parametros_json ?? {},
          }),
        },
      );
      setRetorno(
        `Teste concluído: ${r.quantidadeLinhas} linha(s) em ${r.tempoMs} ms.`,
      );
    } catch (e: any) {
      setRetorno(e.message);
    }
  }
  async function publicarFonte() {
    await api(`/gestao/fontes-dados/${selecionada.id}/publicar`, {
      method: "POST",
    });
    setRetorno("Fonte publicada com sucesso.");
  }
  return (
    <main className="conteudo fontes">
      <header className="topo">
        <div>
          <div className="breadcrumb">
            Control S Gestão <ChevronRight /> Governança
          </div>
          <h1>Fontes de Dados</h1>
          <p>SQL Oracle versionado, auditável e protegido por permissão</p>
        </div>
      </header>
      <section className="painel fonteLista">
        <header>
          <div>
            <h2>Catálogo completo de fontes</h2>
            <p>{fontes.length} fontes Oracle confirmadas e versionadas</p>
          </div>
        </header>
        {fontes.map((f) => (
          <button onClick={() => abrir(f.id)}>
            <Database />
            <div>
              <b>{f.nome}</b>
              <span>{f.descricao}</span>
            </div>
            <em>{f.categoria}</em>
            <ChevronRight />
          </button>
        ))}
      </section>
      {selecionada && (
        <section className="editor">
          <header>
            <div>
              <span>Editor SQL</span>
              <h2>{selecionada.nome}</h2>
            </div>
            <button onClick={() => setSelecionada(null)}>
              <X />
            </button>
          </header>
          <textarea
            value={selecionada.sql_texto}
            onChange={(e) =>
              setSelecionada({ ...selecionada, sql_texto: e.target.value })
            }
          />
          {retorno && <div className="editorRetorno">{retorno}</div>}
          <footer>
            <span>Somente consultas SELECT parametrizadas</span>
            <div className="editorAcoes">
              <button onClick={testarFonte}>Testar SQL</button>
              <button onClick={salvarFonte}>Salvar versão</button>
              <button onClick={publicarFonte}>Publicar</button>
            </div>
          </footer>
        </section>
      )}
    </main>
  );
}
