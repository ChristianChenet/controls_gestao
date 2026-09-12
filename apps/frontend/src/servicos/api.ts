const BASE=import.meta.env.VITE_API_URL??'http://localhost:3340';
export async function api<T>(caminho:string,opcoes:RequestInit={}){const token=localStorage.getItem('gestao_token');const r=await fetch(`${BASE}${caminho}`,{...opcoes,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...opcoes.headers}});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.mensagem??'Não foi possível concluir.');}return r.json() as Promise<T>}
export {BASE};
