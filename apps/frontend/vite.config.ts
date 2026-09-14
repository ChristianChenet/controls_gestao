import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const pastaAtual = dirname(fileURLToPath(import.meta.url));
const raizProjeto = resolve(pastaAtual, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, raizProjeto, '');
  const alvoApi = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${env.PORTA_API || env.PORT || 3340}`;
  const proxyApi = {
    '/api': {
      target: alvoApi,
      changeOrigin: true,
      secure: false
    },
    '/gestao': {
      target: alvoApi,
      changeOrigin: true,
      secure: false
    }
  };

  return {
    envDir: raizProjeto,
    define: {
      __APP_BUILD_ID__: JSON.stringify(new Date().toISOString())
    },
    plugins: [react()],
    server: {
      port: 5174,
      host: '0.0.0.0',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '192.168.1.70',
        'frete.monvizo.com.br',
        '.trycloudflare.com',
        '.ngrok-free.dev',
        'augmented-pouch-monogram.ngrok-free.dev'
      ],
      proxy: proxyApi
    },
    preview: {
      host: '0.0.0.0',
      port: 5175,
      proxy: proxyApi
    }
  };
});
