/**
 * Creates the initial admin accounts with properly hashed passwords.
 * Run AFTER schema.sql has been executed in Supabase:
 *
 *   cd server
 *   node scripts/seed-admins.js
 *
 * Creates:
 *   - superadmin / lifesaver2026  (corporate, sees everything)
 *   - one branch admin per branch: branch1, branch2, ... / lifesaver2026
 *
 * CHANGE THESE PASSWORDS in the admin dashboard before going live.
 */
import bcrypt from 'bcryptjs'
import { db } from '../src/supabase.js'

const DEFAULT_PASSWORD = 'lifesaver2026'

const { data: existing } = await db.from('admins').select('id').limit(1)
if (existing && existing.length > 0) {
  console.log('Admins already exist — nothing to do.')
  process.exit(0)
}

const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10)

const { error: superErr } = await db.from('admins').insert({
  username: 'superadmin',
  password_hash: hash,
  display_name: 'Corporate Admin',
  role: 'super',
  branch_id: null,
})
if (superErr) {
  console.error('Failed to create super admin:', superErr.message)
  process.exit(1)
}

const { data: branches, error: brErr } = await db.from('branches').select('id, name').order('id')
if (brErr) {
  console.error(brErr.message)
  process.exit(1)
}

const rows = branches.map((b, i) => ({
  username: `branch${i + 1}`,
  password_hash: hash,
  display_name: b.name,
  role: 'branch',
  branch_id: b.id,
}))
const { error } = await db.from('admins').insert(rows)
if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`Created superadmin + ${rows.length} branch admins.`)
console.log(`All passwords: ${DEFAULT_PASSWORD}  — change them after first login!`)
rows.forEach((r) => console.log(`  ${r.username}  ->  ${r.display_name}`))
process.exit(0)
