import { FastifyReply, FastifyRequest } from 'fastify';

export type UsuarioSessao = { id:number; nome:string; empresaId:number; permissoes:string[] };
declare module '@fastify/jwt' { interface FastifyJWT { user: UsuarioSessao } }
export async function autenticar(requisicao: FastifyRequest, resposta: FastifyReply) {
  try { await requisicao.jwtVerify(); } catch { return resposta.code(401).send({ mensagem:'Sessão inválida ou expirada.' }); }
}
export function exigir(permissao: string) {
  return async (requisicao: FastifyRequest, resposta: FastifyReply) => {
    await autenticar(requisicao, resposta);
    if (resposta.sent) return;
    if (!requisicao.user.permissoes.includes(permissao) && !requisicao.user.permissoes.includes('*'))
      return resposta.code(403).send({ mensagem:'Você não possui permissão para esta ação.' });
  };
}
