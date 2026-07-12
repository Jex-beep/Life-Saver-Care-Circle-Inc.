-- ============================================================
-- Migration 003 — Announcements (posted by the superadmin)
-- Run in Supabase Dashboard > SQL Editor > New query
--
-- Superadmin posts news, hiring notices, and advisories from the
-- Ops Console. Published items appear in the homepage
-- "News & Announcements" section; a pinned item also shows as a
-- site-wide bar above the navigation (one pinned at a time).
-- ============================================================

create table if not exists announcements (
  id            bigint generated always as identity primary key,
  title         text not null,
  body          text not null default '',
  category      text not null default 'news',   -- news | hiring | advisory
  is_published  boolean not null default true,
  is_pinned     boolean not null default false,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists announcements_pub_idx
  on announcements (is_published, published_at desc);

alter table announcements enable row level security;
