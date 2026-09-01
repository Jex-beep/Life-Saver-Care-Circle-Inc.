import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../src/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/scripts/ -> up two levels -> project root -> supabase/
const supabaseDir = path.join(__dirname, '..', '..', 'supabase')

const files = [
  'schema.sql',
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
  process.exit(1)
})