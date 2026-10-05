import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../src/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/scripts/ -> up two levels -> project root -> supabase/
const supabaseDir = path.join(__dirname, '..', '..', 'supabase')

const files = [
  // 'schema.sql',  // already applied successfully — skip to avoid duplicate seed data
  'migration-002-capacity-blocks.sql',
  'migration-003-announcements.sql',
  'migration-004-inventory-roles-maps.sql',
]

async function run() {
  for (const file of files) {
    const filePath = path.join(supabaseDir, file)
    if (!fs.existsSync(filePath)) {
      console.error(`Could not find ${filePath} — check the file actually exists at that path.`)
      process.exit(1)
    }
    const sql = fs.readFileSync(filePath, 'utf8')
    console.log(`Running ${file} ...`)
    await db.query(sql)
    console.log(`Applied ${file}`)
  }
  console.log('\nAll migrations applied successfully.')
  process.exit(0)
}

run().catch((err) => {
  console.error('\nMigration failed:', err.message)
  if (err.detail) console.error('Detail:', err.detail)
  if (err.table) console.error('Table:', err.table)
  if (err.constraint) console.error('Constraint:', err.constraint)
  if (err.position) {
    console.error(
      'Character position in the combined SQL text:',
      err.position,
      '— open the relevant file and search near that offset if needed.'
    )
  }
  process.exit(1)
})