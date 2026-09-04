-- 「みんなの投稿写真」＋コメント機能用スキーマ
-- Supabaseプロジェクト作成後、SQL Editor で実行してください。
-- ログイン不要・匿名(anon)ロールから直接 insert/select する前提のRLS設計です。
-- （投稿は承認なしで即時公開。不適切な投稿はコメントでの報告を想定）

create extension if not exists "pgcrypto";

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null check (char_length(plant_id) <= 60),
  nickname text not null check (char_length(nickname) <= 40),
  caption text check (char_length(caption) <= 200),
  image_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_plant_id_idx on submissions (plant_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  nickname text not null check (char_length(nickname) <= 40),
  body text not null check (char_length(body) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists comments_submission_id_idx on comments (submission_id);

alter table submissions enable row level security;
alter table comments enable row level security;

create policy "anyone can read submissions" on submissions
  for select using (true);

create policy "anyone can create submissions" on submissions
  for insert with check (true);

create policy "anyone can read comments" on comments
  for select using (true);

create policy "anyone can create comments" on comments
  for insert with check (true);

-- Storage: 画像アップロード用の公開バケット
insert into storage.buckets (id, name, public)
values ('flower-photos', 'flower-photos', true)
on conflict (id) do nothing;

create policy "anyone can upload flower photos" on storage.objects
  for insert with check (bucket_id = 'flower-photos');

create policy "anyone can view flower photos" on storage.objects
  for select using (bucket_id = 'flower-photos');
