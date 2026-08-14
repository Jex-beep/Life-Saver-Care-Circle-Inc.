-- ============================================================
-- Migration 004 — Per-branch medicine stock, staff roles, branch maps
-- Run in Supabase Dashboard > SQL Editor > New query
--
-- Three things happen here:
--
-- 1. STAFF ROLES. Each branch now has two kinds of staff account:
--      manager — stocks medicines in for THIS branch, and can look up
--                stock at every other branch so they can tell a patient
--                "we're out, but Novaliches has it".
--      handler — prepares orders and bookings, and decrements stock by
--                hand for walk-in (face-to-face) sales.
--    Existing 'branch' accounts become managers, since that is what
--    they could already do.
--
-- 2. PER-BRANCH STOCK. products stays the shared medicine catalog
--    (name, generic, price — one price everywhere). branch_inventory
--    holds how many of each medicine a given branch actually has.
--    A branch only carries a medicine once its manager adds it; there
--    is no copying stock between branches.
--
-- 3. BRANCH MAPS. The superadmin pastes the Google Maps "Embed a map"
--    HTML when adding a branch. The API pulls the map URL and the
--    lat/lng out of it, so the nearest-branch search knows where each
--    branch really is instead of guessing from the city name.
-- ============================================================

-- ---------- 1. Staff roles ----------

-- 'branch' was the only per-branch role; those accounts keep their powers as managers.
update admins set role = 'manager' where role = 'branch';

alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check
  check (role in ('super', 'manager', 'handler'));

-- ---------- 2. Branch map location ----------

alter table branches add column if not exists map_embed_src text default '';
alter table branches add column if not exists latitude      numeric(10, 7);
alter table branches add column if not exists longitude     numeric(10, 7);

comment on column branches.map_embed_src is
  'src URL extracted from the pasted Google Maps embed HTML. Never store raw HTML — it gets rendered in an iframe.';

-- ---------- 3. Per-branch medicine stock ----------

create table if not exists branch_inventory (
  id            bigint generated always as identity primary key,
  branch_id     bigint not null references branches(id) on delete cascade,
  product_id    bigint not null references products(id) on delete cascade,
  stock         integer not null default 0 check (stock >= 0),
  low_stock_at  integer not null default 10 check (low_stock_at >= 0),
  is_available  boolean not null default true,   -- manager can hide a medicine without zeroing stock
  updated_at    timestamptz not null default now(),
  unique (branch_id, product_id)
);

create index if not exists branch_inventory_branch_idx  on branch_inventory (branch_id);
create index if not exists branch_inventory_product_idx on branch_inventory (product_id);

-- Every change to stock is recorded, so a branch can answer "where did
-- those 40 tablets go" — walk-in sale, website order, or a correction.
create table if not exists stock_movements (
  id              bigint generated always as identity primary key,
  branch_id       bigint not null references branches(id) on delete cascade,
  product_id      bigint not null references products(id) on delete cascade,
  delta           integer not null,               -- +50 delivery, -1 walk-in sale
  stock_after     integer not null,
  reason          text not null default 'adjustment',
  note            text default '',
  order_reference text default '',                -- set when a website order caused it
  admin_id        bigint references admins(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint stock_movements_reason_check check (
    reason in ('stock_in', 'walkin_sale', 'online_order', 'adjustment', 'expired', 'damaged', 'returned')
  )
);

create index if not exists stock_movements_branch_idx on stock_movements (branch_id, created_at desc);

-- ---------- Atomic stock change ----------
-- Doing read-then-write from Node would let two walk-in sales rung up at
-- the same moment both read stock=1 and both succeed. This does the read,
-- the write, and the audit row in one statement so that can't happen.
create or replace function adjust_stock(
  p_branch_id       bigint,
  p_product_id      bigint,
  p_delta           integer,
  p_reason          text default 'adjustment',
  p_note            text default '',
  p_order_reference text default '',
  p_admin_id        bigint default null
) returns integer
language plpgsql
as $$
declare
  v_stock_after integer;
begin
  update branch_inventory
     set stock = stock + p_delta,
         updated_at = now()
   where branch_id = p_branch_id
     and product_id = p_product_id
  returning stock into v_stock_after;

  if not found then
    raise exception 'MEDICINE_NOT_STOCKED'
      using hint = 'This branch does not carry that medicine yet.';
  end if;

  if v_stock_after < 0 then
    raise exception 'INSUFFICIENT_STOCK'
      using hint = 'Not enough stock at this branch.';
  end if;

  insert into stock_movements
    (branch_id, product_id, delta, stock_after, reason, note, order_reference, admin_id)
  values
    (p_branch_id, p_product_id, p_delta, v_stock_after, p_reason, p_note, p_order_reference, p_admin_id);

  return v_stock_after;
end;
$$;

-- ---------- RLS ----------
-- Same posture as the rest of the schema: the Node backend uses the
-- service_role key and bypasses RLS; enabling it keeps the anon key out.
alter table branch_inventory enable row level security;
alter table stock_movements  enable row level security;

-- ---------- Seed: give existing pharmacy branches the sample catalog ----------
-- Only branches that actually dispense medicine get an inventory row, and
-- they all start at zero so staff must stock in for real.
insert into branch_inventory (branch_id, product_id, stock)
select b.id, p.id, 0
from branches b
cross join products p
where b.target_client in ('Yakap and Gamot - Owned', 'Drug Store - Stand Alone')
on conflict (branch_id, product_id) do nothing;
