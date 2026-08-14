/**
 * Creates the initial staff accounts with properly hashed passwords.
 * Run AFTER schema.sql and the migrations have been executed in Supabase:
 *
 *   cd server
 *   node scripts/seed-admins.js
 *
 * Creates, per the two-accounts-per-branch setup:
 *   - superadmin                  corporate; sees every branch, creates accounts
 *   - branch1mgr … branchNmgr     branch manager; stocks medicines in, sees
 *                                 stock at every branch for referrals
 *   - branch1staff … branchNstaff branch handler; prepares orders and bookings,
 *                                 records walk-in sales against stock
 *
 * CHANGE THESE PASSWORDS in Manage System > Accounts before going live.
 */
import bcrypt from 'bcryptjs'
import { db } from '../src/supabase.js'

const DEFAULT_PASSWORD = 'lifesaver2026'

const { data: existing } = await db.from('admins').select('id').limit(1)
if (existing && existing.length > 0) {
  console.log('Accounts already exist — nothing to do.')
  console.log('Add any missing manager/handler accounts in Manage System > Accounts.')
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

/* Every branch gets both accounts: one to own the shelf, one to work the counter. */
const rows = branches.flatMap((b, i) => [
  {
    username: `branch${i + 1}mgr`,
    password_hash: hash,
    display_name: `${b.name} — Manager`,
    role: 'manager',
    branch_id: b.id,
  },
  {
    username: `branch${i + 1}staff`,
    password_hash: hash,
    display_name: `${b.name} — Handler`,
    role: 'handler',
    branch_id: b.id,
  },
])

const { error } = await db.from('admins').insert(rows)
if (error) {
  console.error(error.message)
  if (/role/.test(error.message)) {
    console.error('Run supabase/migration-004-inventory-roles-maps.sql first — it adds the manager and handler roles.')
  }
  process.exit(1)
}

console.log(`Created superadmin + ${rows.length} branch accounts (${branches.length} branches × 2).`)
console.log(`All passwords: ${DEFAULT_PASSWORD}  — change them after first login!\n`)
for (const b of branches) {
  const i = branches.indexOf(b) + 1
  console.log(`  ${b.name}`)
  console.log(`    manager  branch${i}mgr`)
  console.log(`    handler  branch${i}staff`)
}
process.exit(0)
