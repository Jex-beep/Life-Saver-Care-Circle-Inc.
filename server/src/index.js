import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'life-saver-api' }))
app.use('/api', publicRoutes)
app.use('/api/admin', adminRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Life Saver API running on http://localhost:${port}`)
})
