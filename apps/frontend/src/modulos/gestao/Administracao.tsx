import { FormEvent, useEffect, useState } from "react";
import { Building2, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { api } from "../../servicos/api";

type Aba = "empresas" | "usuarios" | "perfis";
const configuracao = {
  empresas: {
    titulo: "Empresas",
    icone: Building2,
    rota: "/api/admin/empresas",
  },
  usuarios: { titulo: "Usuários", icone: Users, rota: "/api/admin/usuarios" },
  perfis: {
    titulo: "Perfis e Direitos",
    icone: ShieldCheck,
    rota: "/api/admin/perfis",
  },
};
export function Administracao() {
  const [aba, setAba] = useState<Aba>("empresas");
  const [itens, setItens] = useState<any[]>([]);
  const [edicao, setEdicao] = useState<any>(null);
  const [erro, setErro] = useState("");
  const cfg = configuracao[aba];
  const IconeAtual = cfg.icone;
  async function carregar() {
    try {
      setItens(await api<any[]>(cfg.rota));
    } catch (e: any) {
      setErro(e.message);
    }
  }
  useEffect(() => {
    setEdicao(null);
    carregar();
  }, [aba]);
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.currentTarget));
    const payload =
      aba === "empresas"
        ? { ...edicao, ...dados, ativa: true }
        : aba === "perfis"
          ? {
              ...edicao,
              ...dados,
              ativo: true,
              administrador: dados.administrador === "on",
            }
          : {
              ...edicao,
              ...dados,
              ativo: true,
              administrador: dados.administrador === "on",
              superadmin: dados.superadmin === "on",
              perfil_id: dados.perfil_id ? Number(dados.perfil_id) : null,
              empresas_ids: edicao?.empresas_ids ?? [],
            };
    try {
      await api(cfg.rota, { method: "POST", body: JSON.stringify(payload) });
      setEdicao(null);
      await carregar();
    } catch (x: any) {
      setErro(x.message);
    }
  }
  return (
    <main className="conteudo administracao">
      <header className="topo">
        <div>
          <div className="breadcrumb">Control S Gestão · Administração</div>
          <h1>Cadastros e acessos</h1>
          <p>
            Mesma estrutura de empresas, usuários, perfis e direitos do Control
            S Hub.
          </p>
        </div>
      </header>
      <div className="abasAdmin">
        {(Object.keys(configuracao) as Aba[]).map((a) => {
          const I = configuracao[a].icone;
          return (
            <button
              key={a}
              className={aba === a ? "ativo" : ""}
              onClick={() => setAba(a)}
            >
              <I />
              {configuracao[a].titulo}
            </button>
          );
        })}
      </div>
      {erro && <div className="alerta">{erro}</div>}
      <section className="painel adminLista">
        <header>
          <div>
            <h2>{cfg.titulo}</h2>
            <p>{itens.length} registro(s)</p>
          </div>
          <button onClick={() => setEdicao({})}>
            <Plus />
            Novo
          </button>
        </header>
        <div className="adminTabela">
          {itens.map((item) => (
            <button key={item.id} onClick={() => setEdicao(item)}>
              <IconeAtual />
              <div>
                <b>{item.nome_fantasia ?? item.nome}</b>
                <span>{item.email ?? item.codigo_empresa ?? item.codigo}</span>
              </div>
              <em>
                {item.ativo === false || item.ativa === false
                  ? "Inativo"
                  : "Ativo"}
              </em>
            </button>
          ))}
        </div>
      </section>
      {edicao && (
        <div className="adminModal">
          <form onSubmit={salvar}>
            <header>
              <h2>
                {edicao.id ? "Editar" : "Novo"} {cfg.titulo}
              </h2>
              <button type="button" onClick={() => setEdicao(null)}>
                ×
              </button>
            </header>
            {aba === "empresas" && (
              <>
                <label>
                  Código
                  <input
                    name="codigo_empresa"
                    defaultValue={edicao.codigo_empresa}
                    required
                  />
                </label>
                <label>
                  Razão social
                  <input
                    name="razao_social"
                    defaultValue={edicao.razao_social}
                    required
                  />
                </label>
                <label>
                  Nome fantasia
                  <input
                    name="nome_fantasia"
                    defaultValue={edicao.nome_fantasia}
                    required
                  />
                </label>
                <label>
                  CNPJ
                  <input name="cnpj" defaultValue={edicao.cnpj} />
                </label>
              </>
            )}
            {aba === "perfis" && (
              <>
                <label>
                  Código
                  <input name="codigo" defaultValue={edicao.codigo} required />
                </label>
                <label>
                  Nome
                  <input name="nome" defaultValue={edicao.nome} required />
                </label>
                <label>
                  Descrição
                  <input name="descricao" defaultValue={edicao.descricao} />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="administrador"
                    defaultChecked={edicao.administrador}
                  />
                  Perfil administrador
                </label>
              </>
            )}
            {aba === "usuarios" && (
              <>
                <label>
                  Nome
                  <input name="nome" defaultValue={edicao.nome} required />
                </label>
                <label>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    defaultValue={edicao.email}
                    required
                  />
                </label>
                <label>
                  Nova senha
                  <input
                    name="senha"
                    type="password"
                    placeholder={
                      edicao.id ? "Manter senha atual" : "Senha inicial"
                    }
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="administrador"
                    defaultChecked={edicao.administrador}
                  />
                  Administrador
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="superadmin"
                    defaultChecked={edicao.superadmin}
                  />
                  Superadministrador
                </label>
              </>
            )}
            <footer>
              <button type="button" onClick={() => setEdicao(null)}>
                Cancelar
              </button>
              <button className="salvar">
                <Save />
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
