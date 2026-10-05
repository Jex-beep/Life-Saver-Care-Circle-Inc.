import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'

const app = express()

/* Only our real site (and local dev) may call this API from a browser. */
const ALLOWED_ORIGINS = [
  'https://lscarecircle.com.ph',
  'https://www.lscarecircle.com.ph',
  'http://localhost:5173', // local frontend dev server — remove if you want prod-only CORS
]

app.use(
  cors({
    origin(origin, callback) {
      // allow server-to-server/curl requests with no Origin header at all
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
      callback(new Error('Not allowed by CORS'))
    },
  })
)

app.use(express.json({ limit: '2mb' }))

/* Slow down password-guessing attempts against the login route specifically. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/admin/login', loginLimiter)

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