import pg from 'pg'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const { Pool } = pg

const required = ['RDS_HOST', 'RDS_PORT', 'RDS_DATABASE', 'RDS_USER', 'RDS_PASSWORD']
const missing = required.filter((key) => !process.env[key])

if (missing.length) {
  console.error(
    `\n[!] Missing RDS config: ${missing.join(', ')}\n` +
      '    Fill these in in server/.env — see server/.env.example.\n'
  )
  process.exit(1)
}

// Expects global-bundle.pem to sit directly inside the server/ folder
const caPath = path.join(process.cwd(), 'global-bundle.pem')

if (!fs.existsSync(caPath)) {
  console.error(
    `\n[!] Could not find ${caPath}\n` +
      '    Download it with:\n' +
      '    curl.exe -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem\n' +
      '    and place it directly inside the server/ folder.\n'
  )
  process.exit(1)
}

export const db = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  database: process.env.RDS_DATABASE,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: {
    ca: fs.readFileSync(caPath).toString(),
    rejectUnauthorized: true,
  },
})

db.query('SELECT 1')
  .then(() => console.log('Connected to RDS (verified SSL)'))
  .catch((err) => {
    console.error('[!] Could not connect to RDS:', err.message)
    process.exit(1)
  })