import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key || url.includes('YOUR-PROJECT-REF')) {
  console.error(
    '\n[!] Supabase is not configured yet.\n' +
      '    Copy server/.env.example to server/.env and fill in\n' +
      '    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from your\n' +
      '    Supabase project (Settings > API).\n'
  )
  process.exit(1)
}

export const db = createClient(url, key, {
  auth: { persistSession: false },
})
