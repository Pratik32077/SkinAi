import express from 'express'
import path from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'
import analyzeSkinHandler from './api/analyze-skin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(env.PORT) || 3000
const HOST = '0.0.0.0'

async function startServer() {
  const app = express()

  app.use(express.json({ limit: '6mb' }))

  app.all('/api/analyze-skin', async (req, res, next) => {
    try {
      await analyzeSkinHandler(req, res)
    } catch (error) {
      next(error)
    }
  })

  if (env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distDir = path.resolve(__dirname, 'dist')
    app.use(express.static(distDir))
    app.use((req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`)
  })
}

startServer()
