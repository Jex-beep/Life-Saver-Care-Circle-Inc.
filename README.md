# Life Saver Medical Services — Web System

Booking + pharmacy ordering system for Life Saver Care Circle Inc. branches
(Yakap PhilHealth-accredited clinics and Gamot partner pharmacies).

## What's inside

| Part | Where | What it does |
|---|---|---|
| Frontend | `src/` (React + Vite) | Public site: branch finder, real-time slot booking, pharmacy catalog + checkout, reference-number tracking. Admin dashboard at `/admin`. |
| Backend | `server/` (Node + Express) | REST API, per-branch admin auth (JWT), talks to Supabase. |
| Database | `supabase/schema.sql` | Tables + seed data (13 branches, 4 services, sample medicines). |

## Who can do what

Every branch runs on two staff accounts, plus one corporate account overall.

| Role | Sees | Can do |
|---|---|---|
| **Branch manager** | Its own branch's bookings and orders; **stock at every branch** | Decides which medicines the branch carries, records deliveries, corrects stock, edits the schedule and branch settings |
| **Branch handler** | Its own branch's bookings and orders and stock | Prepares orders and bookings, and takes stock down for **walk-in (face-to-face) sales**. Cannot add medicines or change branch settings |
| **Corporate admin** | Everything, all branches | All of the above for any branch, plus creating accounts, branches, services, and the medicine catalog |

Two things follow from this split:

- **Stock is per branch.** A medicine only appears at a branch once that
  branch's manager adds it and enters the quantity that physically arrived.
  Stock is never copied between branches.
- **The manager sees the whole network** so they can tell a patient
  "we're out, but Novaliches has 12" instead of just turning them away.
  The public pharmacy page does the same thing automatically.

Website orders decrement stock on their own. Walk-in sales don't, which is
why handlers can remove stock by hand under **Medicine Stock**.

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor → New query**, paste the whole
   contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Run the migrations the same way, in order:
   - [`supabase/migration-002-capacity-blocks.sql`](supabase/migration-002-capacity-blocks.sql)
   - [`supabase/migration-003-announcements.sql`](supabase/migration-003-announcements.sql)
   - [`supabase/migration-004-inventory-roles-maps.sql`](supabase/migration-004-inventory-roles-maps.sql)
     — per-branch medicine stock, the manager/handler roles, and branch map pins
4. Copy `server/.env.example` to `server/.env` and fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from **Project Settings → API**
   - `JWT_SECRET` — any long random string
5. Install and create the staff accounts:
   ```
   cd server
   npm install
   node scripts/seed-admins.js
   ```
   This creates `superadmin` plus a manager and a handler for each branch
   (`branch1mgr` / `branch1staff`, `branch2mgr` / `branch2staff`, …), all with
   password `lifesaver2026`. **Change these after first login**
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

## Adding a branch (and putting it on the map)

In **Manage System → Branches**, the superadmin fills in the branch details and
pastes the Google Maps embed for that location:

1. Find the branch in Google Maps.
2. **Share → Embed a map → Copy HTML.**
3. Paste the whole `<iframe …>` into the *Location on the map* box.

The server pulls the map URL and the coordinates out of that paste and stores
only those — the HTML itself is never saved or rendered, so a bad paste can't
inject anything into the public site. Those coordinates are what
**Use My Location** measures against when a patient searches for the nearest
Yakap clinic or Gamot pharmacy. A branch with no embed falls back to the centre
of its city, which ranks it roughly but won't pin it precisely.

## Importing the full branch list

`supabase/schema.sql` seeds the 13 branches known so far. When the full Excel
facility list is available, add the remaining branches via the admin dashboard
(Manage System → Branches) or ask Claude to generate the insert statements from
the file.
