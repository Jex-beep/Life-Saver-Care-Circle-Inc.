-- ============================================================
-- Life Saver Medical Services — Database Schema (Supabase)
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- Branches ----------
create table if not exists branches (
  id            bigint generated always as identity primary key,
  name          text not null,
  target_client text not null default 'Yakap only',      -- 'Yakap only' | 'Yakap and Gamot - Owned' | 'Drug Store - Stand Alone'
  engagement    text not null default 'Corporate-managed',
  area          text not null,                            -- 'NCR and Rizal' | 'Southern Luzon' | 'Visayas Area' | ...
  province      text not null,
  city          text not null,
  address       text default '',
  phone         text default '',
  is_active     boolean not null default true,
  -- online payment settings (per branch, uploaded by branch admin)
  gcash_number  text default '',
  qr_image_url  text default '',                          -- GCash / QRPh QR code image
  created_at    timestamptz not null default now()
);

-- ---------- Branch admin accounts (one or more per branch) ----------
create table if not exists admins (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,
  display_name  text not null default '',
  role          text not null default 'branch',           -- 'branch' | 'super'
  branch_id     bigint references branches(id) on delete cascade,  -- null for super admin
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- Bookable services (managed by super admin) ----------
create table if not exists services (
  id            bigint generated always as identity primary key,
  name          text not null,
  description   text default '',
  duration_min  integer not null default 30,
  is_active     boolean not null default true,
  sort_order    integer not null default 0
);

-- ---------- Weekly schedule per branch (managed by branch admin) ----------
create table if not exists branch_schedules (
  id            bigint generated always as identity primary key,
  branch_id     bigint not null references branches(id) on delete cascade,
  weekday       integer not null check (weekday between 0 and 6),  -- 0=Sunday
  open_time     time not null default '08:00',
  close_time    time not null default '17:00',
  slot_minutes  integer not null default 30,
  capacity      integer not null default 1,                -- bookings allowed per slot
  is_open       boolean not null default true,
  unique (branch_id, weekday)
);

-- ---------- Bookings ----------
create table if not exists bookings (
  id            bigint generated always as identity primary key,
  reference     text not null unique,                      -- e.g. LS-BK-7F3K2M
  branch_id     bigint not null references branches(id),
  service_id    bigint not null references services(id),
  booking_date  date not null,
  booking_time  time not null,
  patient_name  text not null,
  phone         text not null,
  email         text default '',
  philhealth_no text default '',
  notes         text default '',
  status        text not null default 'confirmed',         -- confirmed | completed | cancelled | no_show
  created_at    timestamptz not null default now()
);
create index if not exists bookings_slot_idx on bookings (branch_id, booking_date, booking_time);
create index if not exists bookings_ref_idx  on bookings (reference);

-- ---------- Medicine catalog (managed by super admin) ----------
create table if not exists products (
  id            bigint generated always as identity primary key,
  name          text not null,
  generic_name  text default '',
  description   text default '',
  category      text default 'General',
  price         numeric(10,2) not null default 0,
  requires_rx   boolean not null default false,
  image_url     text default '',
  is_active     boolean not null default true
);

-- ---------- Pharmacy orders ----------
create table if not exists orders (
  id             bigint generated always as identity primary key,
  reference      text not null unique,                     -- e.g. LS-OR-9X4P1Q
  branch_id      bigint not null references branches(id),
  customer_name  text not null,
  phone          text not null,
  email          text default '',
  philhealth_no  text default '',
  notes          text default '',
  items          jsonb not null,                           -- [{product_id, name, price, qty}]
  total          numeric(10,2) not null default 0,
  payment_method text not null default 'onsite',           -- onsite | online
  payment_ref    text default '',                          -- e-wallet reference no. entered by customer
  payment_status text not null default 'unpaid',           -- unpaid | for_verification | paid
  status         text not null default 'placed',           -- placed | preparing | ready | completed | cancelled
  created_at     timestamptz not null default now()
);
create index if not exists orders_branch_idx on orders (branch_id, status);
create index if not exists orders_ref_idx    on orders (reference);

-- ============================================================
-- Row Level Security: the Node backend uses the service_role
-- key, which bypasses RLS. Enable RLS so the anon key can't
-- touch anything directly.
-- ============================================================
alter table branches         enable row level security;
alter table admins           enable row level security;
alter table services         enable row level security;
alter table branch_schedules enable row level security;
alter table bookings         enable row level security;
alter table products         enable row level security;
alter table orders           enable row level security;

-- ============================================================
-- Seed data — branches from the Life Saver facility list
-- (the ones visible so far; import the rest from Excel later)
-- ============================================================
insert into branches (name, target_client, area, province, city) values
  ('Life Saver Medical Services - Zabarte',            'Yakap only',              'NCR and Rizal',  'NCR',      'Quezon City'),
  ('Life Saver Medical Services - Dona Imelda',        'Yakap and Gamot - Owned', 'NCR and Rizal',  'NCR',      'Quezon City'),
  ('Life Saver Medical Services - Project 8 Bahay Toro','Yakap only',             'NCR and Rizal',  'NCR',      'Quezon City'),
  ('Life Saver Medical Services - San Juan',           'Yakap only',              'NCR and Rizal',  'NCR',      'San Juan'),
  ('Life Saver Medical Services - Congressional Ave.', 'Yakap only',              'NCR and Rizal',  'NCR',      'Quezon City'),
  ('Life Saver Medical Services - Novaliches',         'Yakap and Gamot - Owned', 'NCR and Rizal',  'NCR',      'Quezon City'),
  ('Life Saver Pharmacy - Taguig',                     'Drug Store - Stand Alone','NCR and Rizal',  'NCR',      'Taguig'),
  ('Life Saver Medical Services - Taytay',             'Yakap only',              'NCR and Rizal',  'Rizal',    'Taytay'),
  ('Life Saver Medical Services - Tanza',              'Yakap only',              'Southern Luzon', 'Cavite',   'Tanza'),
  ('Life Saver Medical Services - Gen. Trias',         'Yakap only',              'Southern Luzon', 'Cavite',   'Gen. Trias'),
  ('Life Saver Medical Services - Dasma',              'Yakap only',              'Southern Luzon', 'Cavite',   'Dasmarinas'),
  ('Life Saver Medical Services - San Jose Batangas',  'Yakap only',              'Southern Luzon', 'Batangas', 'San Jose/Tanauan'),
  ('Life Saver Medical Services - New Lucena',         'Yakap only',              'Visayas Area',   'Iloilo',   'New Lucena');

-- Default services (super admin can edit/add in the dashboard)
insert into services (name, description, duration_min, sort_order) values
  ('General Consultation', 'Check-up and consultation with a physician', 30, 1),
  ('Laboratory Services',  'Blood work and diagnostic testing',          30, 2),
  ('Vaccination',          'Routine immunizations',                      15, 3),
  ('Medical Certificate',  'Fit-to-work and other medical certificates', 15, 4);

-- Default weekly schedule for every branch: Mon-Sat 8:00-17:00, 30-min slots, 2 per slot
insert into branch_schedules (branch_id, weekday, open_time, close_time, slot_minutes, capacity, is_open)
select b.id, d.weekday, '08:00', '17:00', 30, 2, (d.weekday <> 0)
from branches b cross join (values (0),(1),(2),(3),(4),(5),(6)) as d(weekday);

-- Sample medicines so the shop works out of the box (super admin can replace)
insert into products (name, generic_name, category, price, requires_rx) values
  ('Biogesic 500mg',        'Paracetamol',            'Pain Relief',   4.50,  false),
  ('Neozep Forte',          'Phenylephrine + CPM',    'Cough & Cold',  8.75,  false),
  ('Amoxicillin 500mg',     'Amoxicillin',            'Antibiotics',  12.00,  true),
  ('Losartan 50mg',         'Losartan Potassium',     'Maintenance',  15.25,  true),
  ('Metformin 500mg',       'Metformin HCl',          'Maintenance',   6.50,  true),
  ('Cetirizine 10mg',       'Cetirizine',             'Allergy',       9.00,  false),
  ('Ascorbic Acid 500mg',   'Vitamin C',              'Vitamins',      5.00,  false),
  ('Multivitamins Capsule', 'Multivitamins',          'Vitamins',     11.50,  false);

-- ============================================================
-- Admin accounts: created via server script (npm run seed:admins)
-- so passwords are properly hashed. See server/README section
-- in project README.
-- ============================================================
