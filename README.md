# Life Saver Medical Services — Web System

Booking + pharmacy ordering system for Life Saver Care Circle Inc. branches
(Yakap PhilHealth-accredited clinics and Gamot partner pharmacies).

## What's inside

| Part | Where | What it does |
|---|---|---|
| Frontend | `src/` (React + Vite) | Public site: branch finder, real-time slot booking, pharmacy catalog + checkout, reference-number tracking. Admin dashboard at `/admin`. |
| Backend | `server/` (Node + Express) | REST API, per-branch admin auth (JWT), talks to Supabase. |
| Database | `supabase/schema.sql` | Tables + seed data (13 branches, 4 services, sample medicines). |

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor → New query**, paste the whole
   contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Copy `server/.env.example` to `server/.env` and fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from **Project Settings → API**
   - `JWT_SECRET` — any long random string
4. Install and create the admin accounts:
   ```
   cd server
   npm install
   node scripts/seed-admins.js
   ```
   This creates `superadmin` (corporate, sees everything) and `branch1`…`branch13`
   (one per branch), all with password `lifesaver2026`. **Change these after first login**
   (Manage System → Accounts as superadmin).

## Running it

Two terminals:

```
# Terminal 1 — backend API (port 4000)
cd server
npm run dev

# Terminal 2 — frontend (port 5173, proxies /api to 4000)
npm run dev
```

Open http://localhost:5173 — staff login is at http://localhost:5173/admin.

## How reference numbers work

No customer accounts. Every booking gets a `LS-BK-XXXXXX` code and every order a
`LS-OR-XXXXXX` code, shown on the confirmation screen. Customers check status at
**/track**.

## Online payments (current design)

Each branch admin can set their **GCash number and QR code image** in
*Branch Settings*. At checkout, customers choosing "Pay online" see that branch's
QR, pay from their e-wallet, and enter the payment reference number. The branch
verifies it in *Orders → Verify payment*. Branches with no QR configured only
offer pay-at-branch.

> To automate this later, the company (not the developer) should register a
> PayMongo/Xendit merchant account under the corporate bank account.

## Importing the full branch list

`supabase/schema.sql` seeds the 13 branches known so far. When the full Excel
facility list is available, add the remaining branches via the admin dashboard
(Manage System → Branches) or ask Claude to generate the insert statements from
the file.
