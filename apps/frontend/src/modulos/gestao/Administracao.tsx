import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  Cable,
  Plus,
  Save,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { api } from "../../servicos/api";

type Aba = "empresas" | "usuarios" | "perfis" | "direitos" | "conexoes";
const abas = [
  ["empresas", "Empresas", Building2],
  ["usuarios", "Usuários", Users],
  ["perfis", "Perfis", ShieldCheck],
  ["direitos", "Direitos de acesso", ShieldCheck],
  ["conexoes", "Conexão Oracle", Cable],
] as const;
export function Administracao() {
  const [aba, setAba] = useState<Aba>("empresas"),
    [itens, setItens] = useState<any[]>([]),
    [empresas, setEmpresas] = useState<any[]>([]),
    [perfis, setPerfis] = useState<any[]>([]),
    [edicao, setEdicao] = useState<any>(),
    [erro, setErro] = useState(""),
    [perfilId, setPerfilId] = useState(0),
    [empresaId, setEmpresaId] = useState(0),
    [permissoes, setPermissoes] = useState<any[]>([]),
    [testando, setTestando] = useState(0);
  const rota =
    aba === "empresas"
      ? "/api/admin/empresas"
      : aba === "usuarios"
        ? "/api/admin/usuarios"
        : aba === "perfis"
          ? "/api/admin/perfis"
          : aba === "conexoes"
            ? "/api/admin/conexoes-oracle"
            : "";
  async function carregar() {
    try {
      setErro("");
      const [e, p] = await Promise.all([
        api<any[]>("/api/admin/empresas"),
        api<any[]>("/api/admin/perfis"),
      ]);
      setEmpresas(e);
      setPerfis(p);
      setEmpresaId((x) => x || e[0]?.id || 0);
      setPerfilId((x) => x || p[0]?.id || 0);
      if (rota) setItens(await api<any[]>(rota));
    } catch (e: any) {
      setErro(e.message);
    }
  }
  useEffect(() => {
    setEdicao(undefined);
    carregar();
  }, [aba]);
  useEffect(() => {
    if (aba === "direitos" && perfilId && empresaId)
      api<any[]>(
        `/api/admin/perfis/${perfilId}/permissoes?empresa_id=${empresaId}`,
      )
        .then(setPermissoes)
        .catch((e) => setErro(e.message));
  }, [aba, perfilId, empresaId]);
  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d: any = Object.fromEntries(new FormData(ev.currentTarget)),
      bool = (n: string) => d[n] === "on";
    let b: any = { ...edicao, ...d };
    if (aba === "empresas") b = { ...b, ativa: bool("ativa") };
    if (aba === "perfis")
      b = { ...b, administrador: bool("administrador"), ativo: bool("ativo") };
    if (aba === "usuarios")
      b = {
        ...b,
        perfil_id: Number(d.perfil_id) || null,
        empresas_ids: d.empresa_id ? [Number(d.empresa_id)] : [],
        administrador: bool("administrador"),
        superadmin: bool("superadmin"),
        ativo: bool("ativo"),
      };
    if (aba === "conexoes")
      b = { ...b, porta: Number(d.porta), ativa: bool("ativa") };
    try {
      await api(rota, { method: "POST", body: JSON.stringify(b) });
      setEdicao(undefined);
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    }
  }
  async function salvarDireitos() {
    try {
      await api(`/api/admin/perfis/${perfilId}/permissoes`, {
        method: "POST",
        body: JSON.stringify({
          empresa_id: empresaId,
          itens: permissoes.filter((x) => x.permitido),
        }),
      });
    } catch (e: any) {
      setErro(e.message);
    }
  }
  async function testar(id: number) {
    try {
      setTestando(id);
      await api(`/api/admin/conexoes-oracle/${id}/testar`, { method: "POST" });
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setTestando(0);
    }
  }
  const titulo = abas.find((x) => x[0] === aba)?.[1];
  return (
    <main className="conteudo administracao">
      <header className="topo">
        <div>
          <div className="breadcrumb">CONTROL S GESTÃO · CONFIGURAÇÕES</div>
          <h1>Administração</h1>
          <p>
            Empresas, identidade visual, usuários, perfis, direitos e
            integrações.
          </p>
        </div>
      </header>
      <div className="abasAdmin">
        {abas.map(([id, nome, I]) => (
          <button
            key={id}
            className={aba === id ? "ativo" : ""}
            onClick={() => setAba(id)}
          >
            <I />
            {nome}
          </button>
        ))}
      </div>
      {erro && <div className="aviso">{erro}</div>}
      {aba === "direitos" ? (
        <section className="painel matrizPermissoes">
          <header>
            <div>
              <h2>Matriz de permissões por perfil</h2>
              <p>
                Mesmo conceito do Hub: empresa, perfil e direitos detalhados.
              </p>
            </div>
            <button className="primary" onClick={salvarDireitos}>
              <Save />
              Salvar direitos
            </button>
          </header>
          <div className="seletoresDireitos">
            <CampoSelect
              nome="Empresa"
              valor={empresaId}
              mudar={setEmpresaId}
              itens={empresas}
            />
            <CampoSelect
              nome="Perfil / setor"
              valor={perfilId}
              mudar={setPerfilId}
              itens={perfis}
            />
          </div>
          <div className="listaPermissoes">
            {permissoes.map((p, i) => (
              <label key={`${p.tipo}-${p.referencia_id}`}>
                <input
                  type="checkbox"
                  checked={p.permitido}
                  onChange={(e) =>
                    setPermissoes(
                      permissoes.map((x, j) =>
                        j === i ? { ...x, permitido: e.target.checked } : x,
                      ),
                    )
                  }
                />
                <div>
                  <b>{p.nome}</b>
                  <span>{p.codigo}</span>
                </div>
                <em>{p.tipo}</em>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="painel adminLista">
          <header>
            <div>
              <h2>{titulo}</h2>
              <p>{itens.length} registro(s)</p>
            </div>
            <button
              onClick={() =>
                setEdicao({ ativa: true, ativo: true, porta: 1521 })
              }
            >
              <Plus />
              Novo
            </button>
          </header>
          <div className="adminTabela">
            {itens.map((x) => (
              <div className="adminLinha" key={x.id}>
                <button onClick={() => setEdicao(x)}>
                  <div>
                    <b>{x.nome_fantasia ?? x.nome}</b>
                    <span>
                      {x.email ??
                        x.codigo_empresa ??
                        x.codigo ??
                        `${x.usuario}@${x.host}:${x.porta}/${x.servico}`}
                    </span>
                  </div>
                  <em>{(x.ativo ?? x.ativa) ? "Ativo" : "Inativo"}</em>
                </button>
                {aba === "conexoes" && (
                  <button
                    className="testarConexao"
                    onClick={() => testar(x.id)}
                  >
                    <Wifi />
                    {testando === x.id ? "Testando" : "Testar conexão"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {edicao && (
        <div className="adminModal">
          <form onSubmit={salvar}>
            <header>
              <div>
                <small>Cadastro</small>
                <h2>
                  {edicao.id ? "Editar" : "Novo"} {titulo}
                </h2>
              </div>
              <button type="button" onClick={() => setEdicao(undefined)}>
                ×
              </button>
            </header>
            {aba === "empresas" && <Empresa e={edicao} />}{" "}
            {aba === "usuarios" && (
              <Usuario e={edicao} perfis={perfis} empresas={empresas} />
            )}{" "}
            {aba === "perfis" && <Perfil e={edicao} />}{" "}
            {aba === "conexoes" && <Conexao e={edicao} />}
            <footer>
              <button type="button" onClick={() => setEdicao(undefined)}>
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
const Check = ({ n, l, v }: { n: string; l: string; v?: boolean }) => (
  <label className="check">
    <input type="checkbox" name={n} defaultChecked={v !== false} />
    {l}
  </label>
);
const CampoSelect = ({
  nome,
  valor,
  mudar,
  itens,
}: {
  nome: string;
  valor: number;
  mudar: (x: number) => void;
  itens: any[];
}) => (
  <label>
    {nome}
    <select value={valor} onChange={(e) => mudar(Number(e.target.value))}>
      {itens.map((x) => (
        <option key={x.id} value={x.id}>
          {x.nome_fantasia ?? x.nome}
        </option>
      ))}
    </select>
  </label>
);
function Empresa({ e }: { e: any }) {
  return (
    <>
      <label>
        Código
        <input name="codigo_empresa" defaultValue={e.codigo_empresa} required />
      </label>
      <label>
        Razão social
        <input name="razao_social" defaultValue={e.razao_social} required />
      </label>
      <label>
        Nome fantasia
        <input name="nome_fantasia" defaultValue={e.nome_fantasia} required />
      </label>
      <label>
        Nome exibido
        <input name="nome_exibido" defaultValue={e.nome_exibido} />
      </label>
      <label>
        CNPJ
        <input name="cnpj" defaultValue={e.cnpj} />
      </label>
      <label>
        Logo da empresa
        <input
          name="caminho_logo"
          defaultValue={e.caminho_logo}
          placeholder="/brand/cliente-logo.png"
        />
      </label>
      <label>
        Imagem de fundo
        <input
          name="caminho_imagem_fundo"
          defaultValue={e.caminho_imagem_fundo}
        />
      </label>
      <div className="duplo">
        <label>
          Cor primária
          <input
            type="color"
            name="cor_primaria"
            defaultValue={e.cor_primaria ?? "#2ee66f"}
          />
        </label>
        <label>
          Cor secundária
          <input
            type="color"
            name="cor_secundaria"
            defaultValue={e.cor_secundaria ?? "#101827"}
          />
        </label>
      </div>
      <Check n="ativa" l="Empresa ativa" v={e.ativa} />
    </>
  );
}
function Usuario({
  e,
  perfis,
  empresas,
}: {
  e: any;
  perfis: any[];
  empresas: any[];
}) {
  return (
    <>
      <label>
        Nome
        <input name="nome" defaultValue={e.nome} required />
      </label>
      <label>
        E-mail
        <input type="email" name="email" defaultValue={e.email} required />
      </label>
      <label>
        Senha inicial / nova senha
        <input
          type="password"
          name="senha"
          required={!e.id}
          placeholder={e.id ? "Deixe vazio para manter" : "Senha inicial"}
        />
      </label>
      <label>
        Perfil / setor
        <select name="perfil_id" defaultValue={e.perfil_id ?? ""}>
          <option value="">Sem perfil</option>
          {perfis.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Empresa principal
        <select name="empresa_id" defaultValue={e.empresas_ids?.[0] ?? ""}>
          {empresas.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome_fantasia}
            </option>
          ))}
        </select>
      </label>
      <Check n="administrador" l="Administrador" v={e.administrador} />
      <Check n="superadmin" l="Superadministrador" v={e.superadmin} />
      <Check n="ativo" l="Usuário ativo" v={e.ativo} />
    </>
  );
}
function Perfil({ e }: { e: any }) {
  return (
    <>
      <label>
        Código
        <input name="codigo" defaultValue={e.codigo} required />
      </label>
      <label>
        Nome
        <input name="nome" defaultValue={e.nome} required />
      </label>
      <label>
        Descrição
        <input name="descricao" defaultValue={e.descricao} />
      </label>
      <Check n="administrador" l="Perfil administrador" v={e.administrador} />
      <Check n="ativo" l="Perfil ativo" v={e.ativo} />
    </>
  );
}
function Conexao({ e }: { e: any }) {
  return (
    <>
      <label>
        Nome da conexão
        <input
          name="nome"
          defaultValue={e.nome}
          required
          placeholder="Oracle Construshow"
        />
      </label>
      <div className="duplo">
        <label>
          Servidor / IP
          <input name="host" defaultValue={e.host} required />
        </label>
        <label>
          Porta
          <input
            type="number"
            name="porta"
            defaultValue={e.porta ?? 1521}
            required
          />
        </label>
      </div>
      <label>
        Serviço Oracle
        <input
          name="servico"
          defaultValue={e.servico}
          required
          placeholder="VIASOFT"
        />
      </label>
      <label>
        Usuário
        <input name="usuario" defaultValue={e.usuario} required />
      </label>
      <label>
        Senha
        <input
          type="password"
          name="senha"
          required={!e.id}
          placeholder={e.id ? "Deixe vazio para manter" : "Senha Oracle"}
        />
      </label>
      <Check n="ativa" l="Conexão ativa" v={e.ativa} />
    </>
  );
}
