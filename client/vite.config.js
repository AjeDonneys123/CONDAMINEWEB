import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const clientDir = path.dirname(fileURLToPath(import.meta.url))
const gamesRoot = path.resolve(clientDir, '../../CONDAMINE-GAMES')
const getCommitInfo = () => {
  const repoDir = path.resolve(clientDir, '..')
  let sha = ''
  let name = ''
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    sha = String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 8)
  }
  if (process.env.VERCEL_GIT_COMMIT_MESSAGE) {
    name = String(process.env.VERCEL_GIT_COMMIT_MESSAGE).trim().split('\n')[0]
  }
  if (!sha) {
    try { sha = execSync('git rev-parse --short HEAD', { cwd: repoDir }).toString().trim().slice(0, 8) }
    catch { sha = 'local' }
  }
  if (!name) {
    try { name = execSync('git log -1 --pretty=%s', { cwd: repoDir }).toString().trim() }
    catch { name = sha || 'local' }
  }
  return { sha, name }
}
const { sha: appCommit, name: appCommitName } = getCommitInfo()
const localGameFiles = () => ({
  name: 'condamine-local-games',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = decodeURIComponent(String(req.url || '').split('?')[0])
      if (pathname === '/api/system/latest-commit') {
        res.setHeader('Content-Type', 'application/json')
        const current = getCommitInfo()
        res.end(JSON.stringify({ commitName: current.name, commitSha: current.sha }))
        return
      }
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
  define: {
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appCommit),
    'import.meta.env.VITE_APP_COMMIT_NAME': JSON.stringify(appCommitName)
  },
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
      },
      // Les chansons sont servies par Express dans /public/uploads, pas par Vite.
      // Sans ce proxy, un MP3 importé répondait 404 sur localhost:5173.
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
