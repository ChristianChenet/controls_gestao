import { FormEvent, useState } from "react";
import {
  alterarSenhaLogin,
  entrar,
  validarCredenciaisLogin,
} from "./servicos/api";
import { Gestao } from "./modulos/gestao/Gestao";
function Login({ aoEntrar }: { aoEntrar: (token: string) => void }) {
  const [email, setEmail] = useState(""),
    [senha, setSenha] = useState(""),
    [novaSenha, setNovaSenha] = useState(""),
    [confirmacao, setConfirmacao] = useState(""),
    [modoSenha, setModoSenha] = useState(false),
    [validada, setValidada] = useState(false),
    [mensagem, setMensagem] = useState(""),
    [erro, setErro] = useState("");
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    try {
      if (modoSenha) {
        if (!validada) {
          await validarCredenciaisLogin(email, senha);
          setValidada(true);
          setMensagem("Senha atual confirmada. Informe a nova senha.");
          return;
        }
        if (novaSenha.length < 6)
          throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
        if (novaSenha !== confirmacao)
          throw new Error("A confirmação da senha não confere.");
        await alterarSenhaLogin(email, senha, novaSenha);
        setMensagem("Senha alterada. Entre novamente com a nova senha.");
        setModoSenha(false);
        setValidada(false);
        setSenha("");
        setNovaSenha("");
        setConfirmacao("");
        return;
      }
      const dados = await entrar(email, senha);
      if (dados.usuario.alterar_senha_proximo_login) {
        setModoSenha(true);
        setValidada(true);
        setMensagem(
          "Primeiro acesso confirmado. Defina sua nova senha para continuar.",
        );
        return;
      }
      localStorage.setItem("controlSHubToken", dados.token);
      localStorage.setItem(
        "gestao_usuario",
        JSON.stringify({
          ...dados.usuario,
          permissoes: dados.permissoes,
          empresas: dados.empresas,
        }),
      );
      aoEntrar(dados.token);
    } catch (x: any) {
      setErro(x.message);
    }
  }
  return (
    <main className="loginScreen">
      <form className="loginPanel" onSubmit={enviar}>
        <div className="loginBrand">
          <img src="/brand/logo-s-novo.jpg" alt="Control S" />
          <span>Plataforma modular corporativa</span>
        </div>
        <h1>Control S Gestão</h1>
        <p className="loginDescricao">
          Gestão integrada para decisões operacionais e estratégicas.
        </p>
        <label>
          E-mail ou usuário
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setValidada(false);
            }}
            autoComplete="username"
          />
        </label>
        <label>
          Senha atual
          <input
            type="password"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setValidada(false);
            }}
            autoComplete="current-password"
          />
        </label>
        {modoSenha && validada && (
          <>
            <label>
              Nova senha
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </label>
          </>
        )}
        {mensagem && <div className="sucesso">{mensagem}</div>}
        {erro && <div className="alerta">{erro}</div>}
        <button className="primary">
          {modoSenha
            ? validada
              ? "Salvar nova senha"
              : "Validar senha atual"
            : "Entrar"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setModoSenha(!modoSenha);
            setValidada(false);
            setErro("");
            setMensagem("");
          }}
        >
          {modoSenha ? "Voltar ao login" : "Alterar senha"}
        </button>
      </form>
    </main>
  );
}
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("controlSHubToken"));
  if (!token) return <Login aoEntrar={setToken} />;
  return (
    <Gestao
      onSair={() => {
        localStorage.clear();
        setToken(null);
      }}
    />
  );
}
