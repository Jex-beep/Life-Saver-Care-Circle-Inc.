import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const required = ['RDS_HOST', 'RDS_PORT', 'RDS_DATABASE', 'RDS_USER', 'RDS_PASSWORD']
const missing = required.filter((key) => !process.env[key])

if (missing.length) {
  console.error(
    `\n[!] Missing RDS config: ${missing.join(', ')}\n` +
      '    Copy server/.env.example to server/.env and fill these in\n' +
      '    from your RDS instance in the AWS console.\n'
  )
  process.exit(1)
}

export const db = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  database: process.env.RDS_DATABASE,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }, // fine for testing; tighten this later for production
})

db.query('SELECT 1')
  .then(() => console.log('Connected to RDS'))
  .catch((err) => {
    console.error('[!] Could not connect to RDS:', err.message)
    process.exit(1)
  })