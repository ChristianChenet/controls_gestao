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
  ListFilter,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Save,
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
  entradas_realizadas: number;
  saidas_previstas: number;
  saidas_realizadas: number;
  receitas_financeiras: number;
  pagamentos_fornecedores: number;
  pagamentos_despesas: number;
  investimentos: number;
  amortizacao_emprestimos: number;
  previsao_inteligente: number;
  previsao_dinheiro: number;
  previsao_pix: number;
  previsao_cartao_debito: number;
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
  const [f, setF] = useState<any>(() => {
    const padrao = {
      dataInicial: hoje.toISOString().slice(0, 10),
      dataFinal: final.toISOString().slice(0, 10),
      tipoSaldo: "FINANCEIRO",
      visaoFinanceira: "PROJETADO",
      visao: "DIA",
      tipoMovimento: "AMBOS",
      usaPrevisaoInteligente: true,
      formasPrevisao: ["DINHEIRO", "PIX", "CARTAO_DEBITO"],
    };
    try {
      const salvo = JSON.parse(
        localStorage.getItem("controlSGestaoFiltros") ?? "null",
      );
      if (!salvo) return padrao;
      const dataInicial =
        salvo.dataInicial < padrao.dataInicial
          ? padrao.dataInicial
          : salvo.dataInicial;
      return {
        ...padrao,
        ...salvo,
        dataInicial,
        dataFinal:
          salvo.dataFinal < dataInicial ? dataInicial : salvo.dataFinal,
        visaoFinanceira: "PROJETADO",
      };
    } catch {
      return padrao;
    }
  });
  const [id, setId] = useState<number>();
  const [dias, setDias] = useState<Dia[]>([]),
    [resumo, setResumo] = useState<any>({}),
    [insights, setInsights] = useState<any[]>([]),
    [detalhes, setDetalhes] = useState<any[]>([]),
    [saldos, setSaldos] = useState<any[]>([]),
    [gruposFiliais, setGruposFiliais] = useState<any[]>([]),
    [opcoesOracle, setOpcoesOracle] = useState<any>({
      filiais: [],
      portadores: [],
      situacoes: [],
      analiticas: [],
    }),
    [dia, setDia] = useState<Dia>(),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(false),
    [telaCheia, setTelaCheia] = useState(false),
    [gradeMaximizada, setGradeMaximizada] = useState(false),
    [menuRecolhido, setMenuRecolhido] = useState(
      localStorage.getItem("controlSGestaoMenuRecolhido") === "true",
    ),
    [periodoRapido, setPeriodoRapido] = useState("30_DIAS"),
    [visaoPrincipal, setVisaoPrincipal] = useState<
      "DASHBOARD" | "CALENDARIO" | "HORIZONTAL" | "VERTICAL"
    >("DASHBOARD"),
    [filtrosAbertos, setFiltrosAbertos] = useState(false),
    [resumoFiltrosAberto, setResumoFiltrosAberto] = useState(false),
    [insightExplicado, setInsightExplicado] = useState<any>(),
    [avisoFiltros, setAvisoFiltros] = useState(""),
    [detalheIndicador, setDetalheIndicador] = useState<string>(),
    [editorIndicador, setEditorIndicador] = useState<any>(),
    [aba, setAba] = useState<"fluxo" | "fontes" | "administracao">("fluxo");
  const usuario = JSON.parse(localStorage.getItem("gestao_usuario") ?? "{}");
  const empresaAtiva = usuario.empresas?.[0];
  const pode = (p: string) =>
    usuario.superadmin ||
    usuario.administrador ||
    usuario.permissoes?.includes("*") ||
    usuario.permissoes?.includes(p);
  useEffect(() => {
    api<any>("/gestao/fluxo-caixa/filtros-opcoes")
      .then((opcoes) => {
        setOpcoesOracle(opcoes);
        setGruposFiliais(opcoes.grupos ?? []);
      })
      .catch(() => {});
  }, []);
  const estabelecimentos = useMemo(() => {
    const itens = f.grupoFilialId
      ? (gruposFiliais.find((g) => g.id === f.grupoFilialId)?.itens ?? [])
      : opcoesOracle.filiais?.length
        ? opcoesOracle.filiais.map((x: any) => ({
            estab_oracle: x.ESTAB,
            nome_filial: x.ESTABELECIMENTO ?? x.RAZAOSOC,
          }))
        : gruposFiliais.flatMap((g) => g.itens ?? []);
    return Array.from(
      new Map(itens.map((x: any) => [x.estab_oracle, x])).values(),
    ) as any[];
  }, [f.grupoFilialId, gruposFiliais, opcoesOracle]);
  const listaSelecionada = (valor: any) =>
    Array.isArray(valor) ? valor : valor ? [valor] : [];
  const resumoFiltros = useMemo(() => {
    const nomes = (valor: any, itens: any[], id: string, descricao: string) => {
      const ids = listaSelecionada(valor).map(Number);
      return ids.length
        ? itens
            .filter((x) => ids.includes(Number(x[id])))
            .map((x) => x[descricao] ?? x[id])
            .join(", ")
        : "Todos";
    };
    return [
      [
        "Período",
        `${new Date(`${f.dataInicial}T12:00`).toLocaleDateString("pt-BR")} a ${new Date(`${f.dataFinal}T12:00`).toLocaleDateString("pt-BR")}`,
      ],
      ["Visão", "Somente projetado"],
      [
        "Grupo filial",
        gruposFiliais.find((x) => x.id === f.grupoFilialId)?.nome ?? "Todos",
      ],
      [
        "Estabelecimento",
        estabelecimentos.find((x) => Number(x.estab_oracle) === Number(f.estab))
          ?.nome_filial ?? "Todos",
      ],
      [
        "Portadores",
        nomes(
          f.idPortador,
          opcoesOracle.portadores ?? [],
          "IDPORTADOR",
          "DESCRICAO",
        ),
      ],
      [
        "Situações",
        nomes(
          f.idSituacao,
          opcoesOracle.situacoes ?? [],
          "IDSITUACAO",
          "DESCRICAO",
        ),
      ],
      [
        "Analíticas",
        nomes(
          f.idAnalitica,
          opcoesOracle.analiticas ?? [],
          "IDANALITICA",
          "DESCRICAO",
        ),
      ],
      ["Saldo", f.tipoSaldo === "CONCILIADO" ? "Conciliado" : "Financeiro"],
      ["Movimentos", f.tipoMovimento ?? "AMBOS"],
    ];
  }, [f, gruposFiliais, estabelecimentos, opcoesOracle]);
  function salvarFiltros() {
    localStorage.setItem(
      "controlSGestaoFiltros",
      JSON.stringify({ ...f, visaoFinanceira: "PROJETADO" }),
    );
    setAvisoFiltros("Filtros salvos neste dispositivo.");
    window.setTimeout(() => setAvisoFiltros(""), 3000);
  }
  const acoesDaVisao = (podeDetalhar = true) => (
    <div className="acoesVisao">
      {podeDetalhar && dias[0] && (
        <button onClick={() => setDia(dias[0])}>Ver detalhes</button>
      )}
      <button onClick={() => setGradeMaximizada(!gradeMaximizada)}>
        <Expand /> {gradeMaximizada ? "Restaurar" : "Expandir"}
      </button>
      {id && pode("gestao.fluxo_caixa.exportar_excel") && (
        <button onClick={exportarExcel}>
          <Download /> Excel
        </button>
      )}
    </div>
  );
  async function processar() {
    setCarregando(true);
    setErro("");
    try {
      const p = await api<any>("/gestao/fluxo-caixa/processar", {
        method: "POST",
        body: JSON.stringify(f),
      });
      setId(p.id);
      const [d, r, i, det, sal] = await Promise.all([
        api<Dia[]>(`/gestao/fluxo-caixa/processos/${p.id}/dias`),
        api<any>(`/gestao/fluxo-caixa/processos/${p.id}/resumo`),
        pode("gestao.fluxo_caixa.ver_insights")
          ? api<any[]>(`/gestao/fluxo-caixa/processos/${p.id}/insights`)
          : [],
        pode("gestao.fluxo_caixa.ver_detalhe")
          ? api<any[]>(`/gestao/fluxo-caixa/processos/${p.id}/detalhes`)
          : [],
        pode("gestao.fluxo_caixa.ver_detalhe")
          ? api<any[]>(`/gestao/fluxo-caixa/processos/${p.id}/saldos`)
          : [],
      ]);
      setDias(d);
      setResumo(r);
      setInsights(i);
      setDetalhes(det);
      setSaldos(sal);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }
  async function exportarExcel() {
    if (!id) return;
    const r = await fetch(
      `${BASE}/gestao/fluxo-caixa/processos/${id}/exportar-excel`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("controlSHubToken")}`,
        },
      },
    );
    if (!r.ok) throw new Error("Não foi possível exportar o fluxo.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = `fluxo-caixa-${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
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
  const cardsDashboard = [
    cards[0],
    cards[2],
    cards[3],
    cards[1],
    cards[4],
    cards[5],
    [
      "Clientes vencidos",
      detalhes
        .filter(
          (x) => x.tipo_movimento === "ENTRADA" && x.vencido_antes_periodo,
        )
        .reduce((s, x) => s + Number(x.valor_entrada || 0), 0),
      ShieldAlert,
      "ruim",
    ],
  ] as const;
  const fontesPorIndicador: Record<string, string[]> = {
    "Saldo inicial": ["oracle_fluxo_saldo_portador"],
    "Entradas previstas": [
      "oracle_fluxo_movimentos_detalhe",
      "oracle_fluxo_previsao_recebimentos_historico",
    ],
    "Saídas previstas": ["oracle_fluxo_movimentos_detalhe"],
    "Saldo final projetado": [
      "oracle_fluxo_saldo_portador",
      "oracle_fluxo_movimentos_detalhe",
      "oracle_fluxo_previsao_recebimentos_historico",
    ],
    "Menor saldo": [
      "oracle_fluxo_saldo_portador",
      "oracle_fluxo_movimentos_detalhe",
    ],
    "Previsão inteligente": ["oracle_fluxo_previsao_recebimentos_historico"],
    "Clientes vencidos": ["oracle_fluxo_movimentos_detalhe"],
    "Entradas e saídas por dia": ["oracle_fluxo_movimentos_detalhe"],
  };
  async function abrirEditorIndicador(indicador: string) {
    if (!pode("gestao.indicador.editar_fonte")) return;
    const nomes = fontesPorIndicador[indicador] ?? [
      "oracle_fluxo_movimentos_detalhe",
    ];
    const fonte = await api<any>(`/gestao/indicadores/fontes/${nomes[0]}`);
    setEditorIndicador({ indicador, nomes, fonte });
  }
  async function trocarFonteIndicador(nome: string) {
    const fonte = await api<any>(`/gestao/indicadores/fontes/${nome}`);
    setEditorIndicador((atual: any) => ({ ...atual, fonte }));
  }
  async function salvarFonteIndicador() {
    await api(`/gestao/indicadores/fontes/${editorIndicador.fonte.nome}`, {
      method: "PUT",
      body: JSON.stringify({
        sqlTexto: editorIndicador.fonte.sql_texto,
        parametros: editorIndicador.fonte.parametros_json,
      }),
    });
    setEditorIndicador(undefined);
  }
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
  const diasGrade = useMemo(() => {
    if (f.visao === "DIA") return dias;
    const grupos = new Map<string, Dia[]>();
    for (const item of dias) {
      const data = new Date(item.data_fluxo.slice(0, 10) + "T12:00");
      if (f.visao === "SEMANA") {
        const deslocamento = (data.getDay() + 6) % 7;
        data.setDate(data.getDate() - deslocamento);
      } else data.setDate(1);
      const chave = data.toISOString().slice(0, 10);
      grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
    }
    return Array.from(grupos.entries()).map(([data_fluxo, itens]) => {
      const soma = (campo: keyof Dia) =>
        itens.reduce((total, item) => total + Number(item[campo] ?? 0), 0);
      return {
        ...itens[0],
        data_fluxo,
        entradas_previstas: soma("entradas_previstas"),
        entradas_realizadas: soma("entradas_realizadas"),
        saidas_previstas: soma("saidas_previstas"),
        saidas_realizadas: soma("saidas_realizadas"),
        receitas_financeiras: soma("receitas_financeiras"),
        pagamentos_fornecedores: soma("pagamentos_fornecedores"),
        pagamentos_despesas: soma("pagamentos_despesas"),
        investimentos: soma("investimentos"),
        amortizacao_emprestimos: soma("amortizacao_emprestimos"),
        previsao_inteligente: soma("previsao_inteligente"),
        movimento_liquido: soma("movimento_liquido"),
        saldo_projetado: itens[itens.length - 1].saldo_projetado,
      } as Dia;
    });
  }, [dias, f.visao]);
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
    <div
      className={`app ${menuRecolhido ? "menuRecolhido" : ""} ${telaCheia ? "fullscreen" : ""}`}
    >
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
          <button
            className={
              aba === "administracao" || aba === "fontes" ? "ativo" : ""
            }
            onClick={() => setAba("administracao")}
          >
            <Settings2 />
            Configurações
          </button>
        </nav>
        <button
          className="recolherMenu"
          title={menuRecolhido ? "Expandir menu" : "Recolher menu"}
          onClick={() => {
            const novo = !menuRecolhido;
            setMenuRecolhido(novo);
            localStorage.setItem("controlSGestaoMenuRecolhido", String(novo));
          }}
        >
          {menuRecolhido ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span>{menuRecolhido ? "Expandir" : "Recolher menu"}</span>
        </button>
        <button className="sair" onClick={onSair}>
          <LogOut />
          Sair
        </button>
      </aside>
      {aba === "administracao" ? (
        <Administracao
          fontes={
            pode("gestao.fonte_dados.visualizar") ? <Fontes /> : undefined
          }
        />
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
                  min={hoje.toISOString().slice(0, 10)}
                  value={f.dataInicial}
                  onChange={(e) => setF({ ...f, dataInicial: e.target.value })}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  min={f.dataInicial}
                  value={f.dataFinal}
                  onChange={(e) => setF({ ...f, dataFinal: e.target.value })}
                />
              </label>
            </div>
            <label>
              Visão financeira
              <select value="PROJETADO" disabled>
                <option value="PROJETADO">Somente projetado</option>
              </select>
            </label>
            <label>
              Portador / conta
              <MultiFiltro
                todos="Todos os portadores"
                itens={opcoesOracle.portadores ?? []}
                valor={f.idPortador}
                id="IDPORTADOR"
                rotulo={(x) => `${x.ESTAB} · ${x.IDPORTADOR} - ${x.DESCRICAO}`}
                onChange={(idPortador) => setF({ ...f, idPortador })}
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
                Situação
                <MultiFiltro
                  todos="Todas"
                  itens={opcoesOracle.situacoes ?? []}
                  valor={f.idSituacao}
                  id="IDSITUACAO"
                  rotulo={(x) => x.DESCRICAO}
                  onChange={(idSituacao) => setF({ ...f, idSituacao })}
                />
              </label>
              <label>
                Analítica
                <MultiFiltro
                  todos="Todas"
                  itens={opcoesOracle.analiticas ?? []}
                  valor={f.idAnalitica}
                  id="IDANALITICA"
                  rotulo={(x) => `${x.IDANALITICA} - ${x.DESCRICAO}`}
                  onChange={(idAnalitica) => setF({ ...f, idAnalitica })}
                />
              </label>
            </div>
            <div className="duplo">
              <label>
                Pessoa
                <input
                  placeholder="Todas"
                  type="number"
                  onChange={(e) =>
                    setF({
                      ...f,
                      idPessoa: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label>
                Origem
                <select
                  value={f.origem ?? ""}
                  onChange={(e) =>
                    setF({ ...f, origem: e.target.value || null })
                  }
                >
                  <option value="">Todas</option>
                  <option value="DUPREC">Contas a receber</option>
                  <option value="DUPPAG">Contas a pagar</option>
                </select>
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
            {carregando && (
              <div
                className="carregamentoFluxo"
                role="status"
                aria-live="polite"
              >
                <div className="gaugeCarregamento">
                  <div className="gaugeCentro">
                    <Database />
                  </div>
                </div>
                <div>
                  <strong>Carregando dados</strong>
                  <span>Calculando saldos, movimentos e previsões…</span>
                </div>
              </div>
            )}
            <header className="topo">
              <div className="tituloModulo">
                <img src="/brand/logo-financeiro.png" alt="Módulo financeiro" />
                <div>
                  <div className="breadcrumb">
                    Control S Gestão <ChevronRight /> Financeiro
                  </div>
                  <h1>Fluxo de Caixa</h1>
                  <p>Visão operacional e projetada do caixa</p>
                </div>
              </div>
              <div className="acoes">
                <div className="empresaTopo">
                  <img
                    src={empresaAtiva?.caminho_logo || "/brand/logo-s-novo.jpg"}
                  />
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
                      exportarExcel().catch((x) => setErro(x.message));
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
            <div className="barraConsulta">
              <div className="datasPrincipais">
                <label>
                  De
                  <input
                    type="date"
                    min={hoje.toISOString().slice(0, 10)}
                    value={f.dataInicial}
                    onChange={(e) =>
                      setF({ ...f, dataInicial: e.target.value })
                    }
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    min={f.dataInicial}
                    value={f.dataFinal}
                    onChange={(e) => setF({ ...f, dataFinal: e.target.value })}
                  />
                </label>
                <button
                  className="atualizarPrincipal"
                  disabled={carregando || !pode("gestao.fluxo_caixa.processar")}
                  onClick={processar}
                >
                  <RefreshCw className={carregando ? "girar" : ""} />
                  {carregando ? "Carregando dados" : "Atualizar dados"}
                </button>
                <button className="salvarFiltros" onClick={salvarFiltros}>
                  <Save /> Salvar filtros
                </button>
                <button
                  className="verFiltros"
                  onClick={() => setResumoFiltrosAberto(true)}
                  title="Ver filtros aplicados"
                >
                  <ListFilter /> Filtros aplicados
                </button>
                {avisoFiltros && (
                  <span className="avisoFiltros">{avisoFiltros}</span>
                )}
              </div>
              <div className="seletoresEscopo">
                <label>
                  Grupo filial
                  <select
                    value={f.grupoFilialId ?? ""}
                    onChange={(e) =>
                      setF({
                        ...f,
                        grupoFilialId: e.target.value
                          ? Number(e.target.value)
                          : null,
                        estab: null,
                      })
                    }
                  >
                    <option value="">Todos os grupos</option>
                    {gruposFiliais.map((g) => (
                      <option value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Estabelecimento
                  <select
                    value={f.estab ?? ""}
                    onChange={(e) =>
                      setF({
                        ...f,
                        estab: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">Todos os estabelecimentos</option>
                    {estabelecimentos.map((x) => (
                      <option value={x.estab_oracle}>
                        {x.estab_oracle} - {x.nome_filial || "Estabelecimento"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <nav className="visoesFluxo" aria-label="Visualizações do fluxo">
                {[
                  ["DASHBOARD", "Dashboard"],
                  ["CALENDARIO", "Calendário"],
                  ["HORIZONTAL", "Horizontal"],
                  ["VERTICAL", "Vertical"],
                ].map(([codigo, nome]) => (
                  <button
                    className={visaoPrincipal === codigo ? "ativo" : ""}
                    onClick={() => {
                      setVisaoPrincipal(codigo as typeof visaoPrincipal);
                      setGradeMaximizada(false);
                    }}
                  >
                    {nome}
                  </button>
                ))}
              </nav>
              <strong className="periodoFiltrado">
                Período:{" "}
                {new Date(f.dataInicial + "T12:00").toLocaleDateString("pt-BR")}{" "}
                — {new Date(f.dataFinal + "T12:00").toLocaleDateString("pt-BR")}
              </strong>
            </div>
            <section
              className={
                visaoPrincipal === "DASHBOARD"
                  ? "cabecalhoVisao"
                  : "cabecalhoVisao ocultaVisao"
              }
            >
              <div>
                <h2>Dashboard financeiro</h2>
                <p>Resumo executivo e indicadores do período</p>
              </div>
              {acoesDaVisao()}
            </section>
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
            <section
              className={
                visaoPrincipal === "DASHBOARD" ? "cards" : "cards ocultaVisao"
              }
            >
              {cardsDashboard.map(([l, v, I, c]) => (
                <article
                  className={`${c} clicavel`}
                  key={l}
                  title={
                    pode("gestao.indicador.editar_fonte")
                      ? "Clique para detalhar · botão direito para editar a fonte"
                      : "Clique para detalhar"
                  }
                  onClick={() => setDetalheIndicador(l)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    abrirEditorIndicador(l).catch((x) => setErro(x.message));
                  }}
                >
                  <div>
                    <span>{l}</span>
                    <strong>{moeda(v)}</strong>
                    <small>
                      {l === "Previsão inteligente"
                        ? "Considerada nas entradas previstas"
                        : l === "Menor saldo" && resumo.data_menor_saldo
                          ? `Em ${new Date(resumo.data_menor_saldo.slice(0, 10) + "T12:00").toLocaleDateString("pt-BR")}`
                          : l === "Saldo inicial"
                            ? `Saldo ${f.tipoSaldo === "CONCILIADO" ? "conciliado" : "financeiro"}`
                            : "Clique para ver os detalhes"}
                    </small>
                  </div>
                  <I />
                </article>
              ))}
            </section>
            <section
              className={`painel fluxo ${visaoPrincipal !== "CALENDARIO" ? "ocultaVisao" : ""} ${gradeMaximizada ? "maximizadaVisao" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault();
                abrirEditorIndicador("Saldo final projetado").catch((x) =>
                  setErro(x.message),
                );
              }}
            >
              <header>
                <div>
                  <h2>Calendário financeiro</h2>
                  <p>Saldo, entradas e saídas por dia</p>
                </div>
                {acoesDaVisao()}
              </header>
              {dias.length ? (
                <>
                  <div className="saldoAberturaCalendario">
                    <span>Saldo inicial antes do primeiro dia</span>
                    <strong>{moeda(dias[0].disponivel_inicial)}</strong>
                    <small>
                      Base para iniciar a projeção em{" "}
                      {new Date(
                        dias[0].data_fluxo.slice(0, 10) + "T12:00",
                      ).toLocaleDateString("pt-BR")}
                    </small>
                  </div>
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
                        <em className="saldoAnterior">
                          Saldo inicial <b>{moeda(d.disponivel_inicial)}</b>
                        </em>
                        <em>
                          <i className="entrada" /> Entradas +{" "}
                          {moeda(d.entradas_previstas)}
                        </em>
                        <em>
                          <i className="saida" /> Saídas −{" "}
                          {moeda(d.saidas_previstas)}
                        </em>
                        <strong className="saldoFinalDia">
                          Saldo final {moeda(d.saldo_projetado)}
                        </strong>
                        {Number(d.previsao_inteligente) > 0 && (
                          <b className="previsaoDia">
                            <Lightbulb /> Previsão incluída{" "}
                            {moeda(d.previsao_inteligente)}
                          </b>
                        )}
                      </button>
                    ))}
                  </div>
                </>
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
            <section
              className={`painel gradeFluxo ${visaoPrincipal !== "HORIZONTAL" ? "ocultaVisao" : ""} ${gradeMaximizada ? "maximizada" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault();
                abrirEditorIndicador("Saldo final projetado").catch((x) =>
                  setErro(x.message),
                );
              }}
            >
              <header>
                <div>
                  <h2>Fluxo de caixa horizontal</h2>
                  <p>Visão rápida para antecipar os dias que exigem caixa</p>
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
                <button
                  className="maximizar"
                  onClick={() => setGradeMaximizada(!gradeMaximizada)}
                >
                  <Expand /> {gradeMaximizada ? "Restaurar" : "Maximizar"}
                </button>
                {id && pode("gestao.fluxo_caixa.exportar_excel") && (
                  <button className="maximizar" onClick={exportarExcel}>
                    <Download /> Excel
                  </button>
                )}
              </header>
              <div className="gradeRolagem">
                <table>
                  <thead>
                    <tr>
                      <th>FLUXO / PERÍODO</th>
                      {diasGrade.map((d) => (
                        <th>{dataBr(d.data_fluxo)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>(+) CONTAS A RECEBER</th>
                      {diasGrade.map((d) => (
                        <td className="positivo">
                          {moeda(d.entradas_previstas)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(+) RECEITAS FINANCEIRAS / RENDIMENTOS</th>
                      {diasGrade.map((d) => (
                        <td className="positivo">
                          {moeda(d.receitas_financeiras)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(-) CONTAS A PAGAR</th>
                      {diasGrade.map((d) => (
                        <td className="negativo">
                          {moeda(d.saidas_previstas)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(-) PAGAMENTOS FORNECEDORES</th>
                      {diasGrade.map((d) => (
                        <td className="negativo">
                          {moeda(d.pagamentos_fornecedores)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(-) PAGAMENTOS DESPESAS</th>
                      {diasGrade.map((d) => (
                        <td className="negativo">
                          {moeda(d.pagamentos_despesas)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(-) INVESTIMENTOS / COMPRA DE ATIVOS</th>
                      {diasGrade.map((d) => (
                        <td className="negativo">{moeda(d.investimentos)}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>(-) AMORTIZAÇÃO DE EMPRÉSTIMOS</th>
                      {diasGrade.map((d) => (
                        <td className="negativo">
                          {moeda(d.amortizacao_emprestimos)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>(=) FLUXO LÍQUIDO</th>
                      {diasGrade.map((d) => (
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
                      {diasGrade.map((d) => (
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
            <section
              className={`painel gradeFluxo fluxoVertical ${visaoPrincipal !== "VERTICAL" ? "ocultaVisao" : ""} ${gradeMaximizada ? "maximizada" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault();
                abrirEditorIndicador("Saldo final projetado").catch((x) =>
                  setErro(x.message),
                );
              }}
            >
              <header>
                <div>
                  <h2>Fluxo de caixa vertical</h2>
                  <p>Indicadores financeiros organizados por dia</p>
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
                {acoesDaVisao()}
              </header>
              <div className="gradeRolagem">
                <table>
                  <thead>
                    <tr>
                      <th>DATA</th>
                      <th>SALDO INICIAL</th>
                      <th>RECEBIMENTO PREVISTO</th>
                      <th>TOTAL ENTRADAS</th>
                      <th>PAGAMENTOS PREVISTOS</th>
                      <th>FLUXO LÍQUIDO</th>
                      <th>SALDO FINAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasGrade.map((d) => (
                      <tr onClick={() => setDia(d)}>
                        <th>{dataBr(d.data_fluxo)}</th>
                        <td>{moeda(d.disponivel_inicial)}</td>
                        <td className="positivo">
                          {moeda(d.entradas_previstas)}
                        </td>
                        <td className="positivo">
                          {moeda(d.entradas_previstas)}
                        </td>
                        <td className="negativo">
                          {moeda(d.saidas_previstas)}
                        </td>
                        <td
                          className={
                            Number(d.movimento_liquido) < 0
                              ? "risco"
                              : "positivo"
                          }
                        >
                          {moeda(d.movimento_liquido)}
                        </td>
                        <td>{moeda(d.saldo_projetado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <div
              className={
                visaoPrincipal === "DASHBOARD"
                  ? "linhaPaineis"
                  : "linhaPaineis ocultaVisao"
              }
            >
              <section className="painel tendencia">
                <header>
                  <div>
                    <h2>Entradas e saídas por dia</h2>
                    <p>Verde: entradas · Vermelho: saídas</p>
                  </div>
                </header>
                <div
                  className="barras"
                  onClick={() => setDetalheIndicador("Saldo final projetado")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    abrirEditorIndicador("Entradas e saídas por dia").catch(
                      (x) => setErro(x.message),
                    );
                  }}
                >
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
                        <p>
                          {i.data_referencia
                            ? `${new Date(i.data_referencia.slice(0, 10) + "T12:00").toLocaleDateString("pt-BR")}: `
                            : ""}
                          {i.descricao}
                        </p>
                        <strong>{moeda(i.valor_referencia)}</strong>
                      </div>
                      <button
                        className="explicarInsight"
                        title="Entenda este cálculo"
                        onClick={() => setInsightExplicado(i)}
                      >
                        ?
                      </button>
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
            <div className="usuarioRodape">
              Usuário: {usuario.nome || usuario.email || "Conectado"}
            </div>
          </main>
          {resumoFiltrosAberto && (
            <div
              className="modalIndicador modalFiltros"
              role="dialog"
              aria-modal="true"
            >
              <section>
                <header>
                  <div>
                    <span>Consulta atual</span>
                    <h2>Filtros aplicados</h2>
                  </div>
                  <button onClick={() => setResumoFiltrosAberto(false)}>
                    <X />
                  </button>
                </header>
                <dl>
                  {resumoFiltros.map(([nome, valor]) => (
                    <div key={nome}>
                      <dt>{nome}</dt>
                      <dd>{valor}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  Este resumo também é incluído ao final de cada aba exportada
                  para Excel.
                </p>
              </section>
            </div>
          )}
          {insightExplicado && (
            <div
              className="modalIndicador modalExplicacao"
              role="dialog"
              aria-modal="true"
            >
              <section>
                <header>
                  <div>
                    <span>Memória de cálculo</span>
                    <h2>{insightExplicado.titulo}</h2>
                  </div>
                  <button onClick={() => setInsightExplicado(undefined)}>
                    <X />
                  </button>
                </header>
                <p>
                  <b>Data identificada:</b>{" "}
                  {new Date(
                    insightExplicado.data_referencia.slice(0, 10) + "T12:00",
                  ).toLocaleDateString("pt-BR")}
                </p>
                {(() => {
                  let calculo: any = {};
                  try {
                    calculo = JSON.parse(insightExplicado.filtro_json || "{}");
                  } catch {}
                  return (
                    <div className="memoriaCalculo">
                      <span>
                        Entradas previstas <b>{moeda(calculo.entradas)}</b>
                      </span>
                      <span>
                        Saídas previstas <b>{moeda(calculo.saidas)}</b>
                      </span>
                      <span>
                        Necessidade de caixa{" "}
                        <b>{moeda(insightExplicado.valor_referencia)}</b>
                      </span>
                    </div>
                  );
                })()}
                <p>
                  A necessidade é calculada por{" "}
                  <b>saídas previstas menos entradas previstas</b>. O sistema
                  compara todos os dias do período e apresenta aquele com a
                  maior diferença positiva.
                </p>
              </section>
            </div>
          )}
          {detalheIndicador && (
            <div className="modalIndicador" role="dialog" aria-modal="true">
              <section>
                <header>
                  <div>
                    <span>Detalhamento do indicador</span>
                    <h2>{detalheIndicador}</h2>
                    <p>
                      Período{" "}
                      {new Date(f.dataInicial + "T12:00").toLocaleDateString(
                        "pt-BR",
                      )}{" "}
                      a{" "}
                      {new Date(f.dataFinal + "T12:00").toLocaleDateString(
                        "pt-BR",
                      )}
                      {detalheIndicador === "Saldo inicial" &&
                        ` · Saldo ${f.tipoSaldo === "CONCILIADO" ? "conciliado" : "financeiro"}`}
                    </p>
                  </div>
                  <button onClick={() => setDetalheIndicador(undefined)}>
                    <X />
                  </button>
                </header>
                <div className="tabelaDetalheIndicador">
                  {detalheIndicador === "Saldo inicial" ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Estab.</th>
                          <th>Portador</th>
                          <th>Tipo do saldo</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saldos.map((x) => (
                          <tr key={x.id}>
                            <td>{x.estab_oracle}</td>
                            <td>
                              {x.id_portador_oracle} - {x.portador}
                            </td>
                            <td>
                              {x.tipo_saldo === "CONCILIADO"
                                ? "Conciliado"
                                : "Financeiro"}
                            </td>
                            <td className="valor">{moeda(x.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Forma / origem</th>
                          <th>Documento</th>
                          <th>Fornecedor / cliente</th>
                          <th>Portador</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhes
                          .filter((x) =>
                            detalheIndicador === "Entradas previstas"
                              ? x.tipo_movimento === "ENTRADA"
                              : detalheIndicador === "Saídas previstas"
                                ? x.tipo_movimento === "SAIDA"
                                : detalheIndicador === "Clientes vencidos"
                                  ? x.tipo_movimento === "ENTRADA" &&
                                    x.vencido_antes_periodo
                                  : detalheIndicador === "Menor saldo" &&
                                      resumo.data_menor_saldo
                                    ? x.data_fluxo?.slice(0, 10) ===
                                      resumo.data_menor_saldo?.slice(0, 10)
                                    : true,
                          )
                          .map((x) => (
                            <tr key={x.id}>
                              <td>
                                {x.data_fluxo
                                  ? new Date(
                                      x.data_fluxo.slice(0, 10) + "T12:00",
                                    ).toLocaleDateString("pt-BR")
                                  : ""}
                              </td>
                              <td>
                                {x.tipo_movimento === "ENTRADA"
                                  ? "Entrada prevista"
                                  : x.tipo_movimento === "SAIDA"
                                    ? "Saída prevista"
                                    : x.tipo_movimento === "ENTRADA_REALIZADA"
                                      ? "Entrada realizada"
                                      : "Saída realizada"}
                              </td>
                              <td>
                                {x.origem_movimento === "DUPREC" ||
                                x.origem_movimento === "DUPPAG"
                                  ? "Duplicata"
                                  : x.origem_movimento}
                              </td>
                              <td>{x.documento}</td>
                              <td>
                                {x.pessoa ||
                                  (x.id_pessoa_oracle
                                    ? `Pessoa ${x.id_pessoa_oracle}`
                                    : "—")}
                              </td>
                              <td>{x.portador}</td>
                              <td>
                                {x.data_vencimento
                                  ? new Date(
                                      x.data_vencimento.slice(0, 10) + "T12:00",
                                    ).toLocaleDateString("pt-BR")
                                  : ""}
                              </td>
                              <td
                                className={
                                  x.tipo_movimento.startsWith("ENTRADA")
                                    ? "verde valor"
                                    : "vermelho valor"
                                }
                              >
                                {moeda(
                                  x.tipo_movimento.startsWith("ENTRADA")
                                    ? x.valor_entrada
                                    : x.valor_saida,
                                )}
                              </td>
                            </tr>
                          ))}
                        {detalheIndicador === "Previsão inteligente" &&
                          dias.flatMap((d) =>
                            [
                              ["Dinheiro", d.previsao_dinheiro],
                              ["PIX", d.previsao_pix],
                              ["Cartão de débito", d.previsao_cartao_debito],
                            ]
                              .filter((x) => Number(x[1]) > 0)
                              .map((x) => (
                                <tr key={`${d.id}-${x[0]}`}>
                                  <td>{dataBr(d.data_fluxo)}</td>
                                  <td>Previsão</td>
                                  <td>{x[0]}</td>
                                  <td>—</td>
                                  <td>Histórico médio</td>
                                  <td>—</td>
                                  <td>—</td>
                                  <td className="verde valor">{moeda(x[1])}</td>
                                </tr>
                              )),
                          )}
                      </tbody>
                    </table>
                  )}
                </div>
                <footer>
                  <span>
                    {detalheIndicador === "Previsão inteligente"
                      ? "Este valor já está considerado em Entradas previstas."
                      : "Detalhes vinculados ao processamento atual."}
                  </span>
                  <button onClick={() => setDetalheIndicador(undefined)}>
                    Fechar
                  </button>
                </footer>
              </section>
            </div>
          )}
          {editorIndicador && (
            <div
              className="modalIndicador editorRapido"
              role="dialog"
              aria-modal="true"
            >
              <section>
                <header>
                  <div>
                    <span>Edição rápida pelo indicador</span>
                    <h2>{editorIndicador.indicador}</h2>
                    <p>As alterações ficam versionadas e auditadas.</p>
                  </div>
                  <button onClick={() => setEditorIndicador(undefined)}>
                    <X />
                  </button>
                </header>
                <label>
                  Fonte de dados
                  <select
                    value={editorIndicador.fonte.nome}
                    onChange={(e) =>
                      trocarFonteIndicador(e.target.value).catch((x) =>
                        setErro(x.message),
                      )
                    }
                  >
                    {editorIndicador.nomes.map((nome: string) => (
                      <option value={nome}>{nome}</option>
                    ))}
                  </select>
                </label>
                <textarea
                  value={editorIndicador.fonte.sql_texto}
                  onChange={(e) =>
                    setEditorIndicador({
                      ...editorIndicador,
                      fonte: {
                        ...editorIndicador.fonte,
                        sql_texto: e.target.value,
                      },
                    })
                  }
                />
                <footer>
                  <span>
                    Use dois espaços na identação do SQL para facilitar a
                    análise.
                  </span>
                  <button onClick={() => setEditorIndicador(undefined)}>
                    Cancelar
                  </button>
                  <button
                    className="salvar"
                    onClick={() =>
                      salvarFonteIndicador().catch((x) => setErro(x.message))
                    }
                  >
                    Salvar nova versão
                  </button>
                </footer>
              </section>
            </div>
          )}
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

function MultiFiltro({
  todos,
  itens,
  valor,
  id,
  rotulo,
  onChange,
}: {
  todos: string;
  itens: any[];
  valor: any;
  id: string;
  rotulo: (item: any) => string;
  onChange: (valor: number[]) => void;
}) {
  const selecionados = (
    Array.isArray(valor) ? valor : valor ? [valor] : []
  ).map(Number);
  const unicos = Array.from(
    new Map(itens.map((item) => [Number(item[id]), item])).values(),
  );
  const alternar = (codigo: number) =>
    onChange(
      selecionados.includes(codigo)
        ? selecionados.filter((x) => x !== codigo)
        : [...selecionados, codigo],
    );
  return (
    <details className="multiFiltro">
      <summary>
        {selecionados.length ? `${selecionados.length} selecionado(s)` : todos}
      </summary>
      <div>
        <button type="button" onClick={() => onChange([])}>
          Limpar seleção
        </button>
        {unicos.map((item) => {
          const codigo = Number(item[id]);
          return (
            <label key={codigo}>
              <input
                type="checkbox"
                checked={selecionados.includes(codigo)}
                onChange={() => alternar(codigo)}
              />
              <span>{rotulo(item)}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
function Fontes() {
  const [fontes, setFontes] = useState<any[]>([]),
    [selecionada, setSelecionada] = useState<any>(),
    [retorno, setRetorno] = useState(""),
    [testando, setTestando] = useState(false),
    [resultadoTeste, setResultadoTeste] = useState<any>();
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
    setTestando(true);
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
      setResultadoTeste({ ...r, nome: selecionada.nome });
    } catch (e: any) {
      setRetorno(e.message);
    } finally {
      setTestando(false);
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
        <div className="tituloModulo">
          <img src="/brand/logo-financeiro.png" alt="Módulo financeiro" />
          <div>
            <div className="breadcrumb">
              Control S Gestão <ChevronRight /> Governança
            </div>
            <h1>Fontes de Dados</h1>
            <p>SQL Oracle versionado, auditável e protegido por permissão</p>
          </div>
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
            <span>
              SQL e blocos Oracle parametrizados · acesso controlado por perfil
            </span>
            <div className="editorAcoes">
              <button onClick={testarFonte} disabled={testando}>
                {testando ? "Executando..." : "Testar SQL"}
              </button>
              <button onClick={salvarFonte}>Salvar versão</button>
              <button onClick={publicarFonte}>Publicar</button>
            </div>
          </footer>
        </section>
      )}
      {resultadoTeste &&
        (() => {
          const colunas = Array.from(
            new Set<string>(
              (resultadoTeste.linhas ?? []).flatMap((linha: any) =>
                Object.keys(linha),
              ),
            ),
          );
          return (
            <div
              className="modalResultadoFonte"
              role="dialog"
              aria-modal="true"
            >
              <section>
                <header>
                  <div>
                    <span>Resultado do teste</span>
                    <h2>{resultadoTeste.nome}</h2>
                    <p>
                      {resultadoTeste.quantidadeLinhas} linha(s) retornada(s) em{" "}
                      {resultadoTeste.tempoMs} ms
                    </p>
                  </div>
                  <button
                    onClick={() => setResultadoTeste(null)}
                    aria-label="Fechar resultado"
                  >
                    <X />
                  </button>
                </header>
                <div className="tabelaResultadoFonte">
                  {colunas.length ? (
                    <table>
                      <thead>
                        <tr>
                          {colunas.map((coluna) => (
                            <th key={coluna}>{coluna}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(resultadoTeste.linhas ?? []).map(
                          (linha: any, indice: number) => (
                            <tr key={indice}>
                              {colunas.map((coluna) => {
                                const valor = linha[coluna];
                                return (
                                  <td key={coluna}>
                                    {valor == null
                                      ? ""
                                      : typeof valor === "object"
                                        ? JSON.stringify(valor)
                                        : String(valor)}
                                  </td>
                                );
                              })}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div className="resultadoFonteVazio">
                      A consulta foi executada, mas não retornou linhas.
                    </div>
                  )}
                </div>
                <footer>
                  <span>Exibição limitada a 200 linhas por teste.</span>
                  <button onClick={() => setResultadoTeste(null)}>
                    Fechar
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}
    </main>
  );
}
