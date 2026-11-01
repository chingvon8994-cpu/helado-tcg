import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only middleware: serves POST /api/game with the same handler Vercel runs in production,
 * so `npm run dev` gives a complete local stack against your Supabase project.
 */
function localApi(): Plugin {
  return {
    name: 'helado-local-api',
    configureServer(server) {
      server.middlewares.use('/api/game', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/src/server/http.ts');
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          const result = await mod.handleHttp({
            method: req.method ?? 'GET',
            authorization: (req.headers['authorization'] as string) ?? '',
            body: raw ? JSON.parse(raw) : {},
          });
          res.statusCode = result.status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env); // make server-only vars available to the dev middleware
  return {
    plugins: [react(), localApi()],
    test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
