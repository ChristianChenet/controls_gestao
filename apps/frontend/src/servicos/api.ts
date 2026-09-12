const BASE=import.meta.env.VITE_API_URL??'http://localhost:3340';
export async function api<T>(caminho:string,opcoes:RequestInit={}){const token=localStorage.getItem('controlSHubToken')??localStorage.getItem('gestao_token');const r=await fetch(`${BASE}${caminho}`,{...opcoes,headers:{...(opcoes.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...opcoes.headers}});const payload=await r.json().catch(()=>({}));if(!r.ok||payload?.sucesso===false)throw new Error(payload?.erro?.mensagem??payload?.mensagem??'Não foi possível concluir.');return (payload?.dados??payload) as T}
export const entrar=(email:string,senha:string)=>api<any>('/api/auth/login',{method:'POST',body:JSON.stringify({email,senha})});
export const validarCredenciaisLogin=(email:string,senha:string)=>api<any>('/api/auth/validar-credenciais',{method:'POST',body:JSON.stringify({email,senha})});
export const alterarSenhaLogin=(email:string,senha_atual:string,nova_senha:string)=>api<any>('/api/auth/alterar-senha-login',{method:'POST',body:JSON.stringify({email,senha_atual,nova_senha})});
export {BASE};
