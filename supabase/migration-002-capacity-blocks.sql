-- ============================================================
-- Migration 002 — Capacity blocks (date-specific booking limits)
-- Run in Supabase Dashboard > SQL Editor > New query
--
-- Lets each branch admin define per-date sessions with a patient
-- limit, e.g. "2026-07-22 08:00-12:00 max 20 patients" and
-- "2026-07-22 14:00-17:00 max 35 patients".
--
-- Rules the API applies:
--   - If a date has blocks, bookings are only accepted inside a
--     block window, and each block stops accepting bookings when
--     its max_patients is reached.
--   - If a date has NO blocks, the weekly schedule applies as
--     before (per-slot capacity).
--   - A block with max_patients = 0 marks that window closed;
--     if all blocks on a date are 0, the date shows as Closed.
--   - Blocks can also OPEN a date the weekly schedule has closed
--     (e.g. a special Sunday clinic).
-- ============================================================

create table if not exists capacity_blocks (
  id            bigint generated always as identity primary key,
  branch_id     bigint not null references branches(id) on delete cascade,
  block_date    date not null,
  start_time    time not null,
  end_time      time not null,
  max_patients  integer not null default 20 check (max_patients >= 0),
  note          text default '',
  created_at    timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists capacity_blocks_branch_date_idx
  on capacity_blocks (branch_id, block_date);

alter table capacity_blocks enable row level security;
