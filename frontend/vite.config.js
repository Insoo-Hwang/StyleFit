import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/style-fit/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('connection', 'keep-alive')
          })
        },
      },
      '/style-fit/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/style-fit/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('connection', 'keep-alive')
          })
        },
      },
      '/style-fit/report-images': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/style-fit/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('connection', 'keep-alive')
          })
        },
      }
    }
  },
  build: {
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
  }
})
