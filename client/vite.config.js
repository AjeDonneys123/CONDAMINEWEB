import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = path.dirname(fileURLToPath(import.meta.url))
const gamesRoot = path.resolve(clientDir, '../../CONDAMINE-GAMES')
const localGameFiles = () => ({
  name: 'condamine-local-games',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = decodeURIComponent(String(req.url || '').split('?')[0])
      let root = ''
      let relative = ''
      if (pathname.startsWith('/monster-tamer')) {
        root = path.join(gamesRoot, 'games', 'monster-tamer')
        relative = pathname.slice('/monster-tamer'.length)
      } else if (pathname.startsWith('/wispguard')) {
        root = path.join(gamesRoot, 'dist', 'wispguard')
        relative = pathname.slice('/wispguard'.length)
      } else if (pathname.startsWith('/shared')) {
        root = path.join(gamesRoot, 'public', 'shared')
        relative = pathname.slice('/shared'.length)
      } else {
        next()
        return
      }
      let filePath = path.resolve(root, `.${relative || '/'}`)
      if (!filePath.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { next(); return }
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ttf': 'font/ttf' }
      res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
      res.end(fs.readFileSync(filePath))
    })
  }
})

export default defineConfig({
  envDir: '..',
  plugins: [localGameFiles(), react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      // UTILISATION DE 127.0.0.1 POUR ÉVITER LES CONFLITS DE RÉSOLUTION DNS
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
