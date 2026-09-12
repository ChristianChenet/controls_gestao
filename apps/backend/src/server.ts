import { criarApp } from './app.js'; import { ambiente } from './configuracao/ambiente.js';
const app=await criarApp(); await app.listen({port:ambiente.porta,host:ambiente.host});
