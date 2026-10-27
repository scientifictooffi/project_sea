-- =====================================================================
-- The Case of the Disappearing Sea — database schema
-- Run this whole file once in Supabase: SQL Editor -> New query -> Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Questions (public text) ----------
create table if not exists public.questions (
  id            int primary key,
  "order"       int not null unique,
  prompt        text not null,
  options       jsonb not null check (jsonb_array_length(options) = 4),
  image         text,
  image_caption text,
  evidence_label text
);

-- ---------- Answer keys (NEVER readable by clients) ----------
create table if not exists public.answer_keys (
  question_id   int primary key references public.questions(id) on delete cascade,
  correct_index int not null check (correct_index between 0 and 3),
  explanation   text not null
);

-- ---------- Attempts: one per participant session ----------
create table if not exists public.attempts (
  id                  uuid primary key default gen_random_uuid(),
  token               uuid not null default gen_random_uuid(),   -- secret handed to the client
  nickname            text not null check (char_length(nickname) between 2 and 20),
  started_at          timestamptz not null default now(),
  current_question    int not null default 1,
  current_served_at   timestamptz not null default now(),
  status              text not null default 'active' check (status in ('active','completed')),
  client_fingerprint  text
);

-- ---------- Per-question answers (unique => no double scoring) ----------
create table if not exists public.attempt_answers (
  attempt_id    uuid not null references public.attempts(id) on delete cascade,
  question_id   int  not null references public.questions(id),
  selected      int  check (selected between 0 and 3),
  is_correct    boolean not null,
  points        int not null default 0,
  expired       boolean not null default false,
  answered_at   timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- ---------- Final results (unique per attempt => one score per attempt) ----------
create table if not exists public.results (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null unique references public.attempts(id) on delete cascade,
  nickname      text not null,
  score         int not null,
  correct_count int not null,
  duration_ms   int not null,
  created_at    timestamptz not null default now()
);
create index if not exists results_rank_idx on public.results (score desc, duration_ms asc);

-- ---------- Public leaderboard view: only display fields ----------
create or replace view public.leaderboard
with (security_invoker = true) as
  select id, nickname, score, correct_count, duration_ms, created_at
  from public.results
  order by score desc, duration_ms asc, created_at asc;

-- =====================================================================
-- Row Level Security
-- Default: everything locked. The Edge Function uses the service-role key,
-- which bypasses RLS. The browser (anon key) can only read questions and
-- the leaderboard/results display columns.
-- =====================================================================
alter table public.questions        enable row level security;
alter table public.answer_keys      enable row level security;
alter table public.attempts         enable row level security;
alter table public.attempt_answers  enable row level security;
alter table public.results          enable row level security;

drop policy if exists "questions are public"  on public.questions;
create policy "questions are public" on public.questions for select to anon, authenticated using (true);

drop policy if exists "results readable for leaderboard" on public.results;
create policy "results readable for leaderboard" on public.results for select to anon, authenticated using (true);

-- answer_keys, attempts, attempt_answers: NO policies => anon cannot read or write at all.

-- Explicit grants. New Supabase projects grant nothing by default, so both the
-- browser role (anon) and the Edge Function role (service_role) need them.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.questions, public.results, public.leaderboard to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

-- ---------- Realtime: broadcast changes on results ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'results') then
    alter publication supabase_realtime add table public.results;
  end if;
end $$;

-- =====================================================================
-- Seed content
-- =====================================================================
insert into public.questions (id, "order", prompt, options, image, image_caption, evidence_label) values
(1, 1, 'What was one of the main causes of the Aral Sea''s disappearance?',
 '["A sudden shift in the regional climate during the 1960s","Water diverted from rivers for agricultural irrigation","Earthquakes that opened cracks in the seabed","Overfishing that collapsed the lake ecosystem"]',
 '/images/satellite.jpg', 'Exhibit A. NASA Earth Observatory, 1989 (left) and 2014 (right).', 'Exhibit A · Satellite record'),
(2, 2, 'What do satellite images reveal about the Aral Sea?',
 '["Its surface area shrank dramatically","It slowly migrated northwards","It became deeper but narrower","Its water turned green from algae only"]',
 '/images/kokaral.jpg', 'Exhibit B. Sentinel-2 true colour, 2021. European Space Agency.', 'Exhibit B · Orbital evidence'),
(3, 3, 'What was one major consequence of the sea''s decline for local communities?',
 '["A boom in tourism along the new shoreline","Job losses and the decline of fishing communities","Cheaper electricity from new hydro plants","Larger harvests thanks to a milder climate"]',
 '/images/seabed.jpg', 'Exhibit C. Fishing boats stranded on the former seabed. Photo: Aliyaassubayeva, CC BY-SA 4.0.', 'Exhibit C · Field evidence'),
(4, 4, 'Which project helped improve conditions in the North Aral Sea?',
 '["Redirecting the Volga river into the basin","Desalination plants on the eastern shore","The construction of the Kok-Aral Dam","Cloud seeding over the Kyzylkum desert"]',
 '/images/ships.jpg', 'Exhibit D. The ship graveyard at Moynaq. Photo: Arian Zwegers, CC BY 2.0.', 'Exhibit D · Witness material'),
(5, 5, 'Which approach creates the most reliable digital environmental investigation?',
 '["Relying on a single dramatic photograph","Using only anonymous social media posts","Combining verified data, documentary images, and interactive storytelling","Avoiding data so the story stays emotional"]',
 null, null, 'Final question · Method')
on conflict (id) do update set prompt = excluded.prompt, options = excluded.options, image = excluded.image,
  image_caption = excluded.image_caption, evidence_label = excluded.evidence_label;

insert into public.answer_keys (question_id, correct_index, explanation) values
(1, 1, 'From the 1960s the Amu Darya and Syr Darya were diverted to irrigate cotton and rice fields, cutting the inflow that kept the sea alive.'),
(2, 0, 'Satellite records from 1960 to today show the sea losing roughly 90% of its surface area and splitting into separate basins.'),
(3, 1, 'Ports such as Aralsk and Moynaq lost their fishing fleets; tens of thousands of jobs disappeared with the water.'),
(4, 2, 'The Kok-Aral Dam, completed in 2005 with World Bank support, raised the North Aral Sea level and brought fish back.'),
(5, 2, 'Verified data gives credibility, documentary images give evidence, and interactive storytelling keeps the audience engaged.')
on conflict (question_id) do update set correct_index = excluded.correct_index, explanation = excluded.explanation;
