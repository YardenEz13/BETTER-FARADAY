import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Vite inlines VITE_* at build time — a missing URL only surfaces as a
  // runtime crash in the browser (ConvexReactClient throws). Fail the build.
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_CONVEX_URL) {
    throw new Error(
      'VITE_CONVEX_URL is not set.\n' +
        '  On Vercel: Settings > Environment Variables, scope Production AND Preview ' +
        '(.env.local is gitignored and never reaches Vercel), then redeploy.\n' +
        '  Locally: add it to .env.local.\n' +
        '  URLs are in docs/deploy.md.',
    )
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Sourcemap upload runs only where SENTRY_AUTH_TOKEN is set (Vercel prod
      // builds); local/CI builds skip it entirely.
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disable: !process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
    build: {
      sourcemap: true,
    },
    server: {
      port: 1913,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    worker: {
      format: 'es',
    },
  }
})
