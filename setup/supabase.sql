-- ============================================================
-- PyForge · 云端同步建表脚本（无引号版，怎么粘都不会坏）
-- 用法：Supabase 控制台 → SQL Editor → New query
--       先 Ctrl+A 全选删除旧内容，再粘贴下面的语句，点 Run
-- 成功标志：出现 Success. No rows returned
-- ============================================================

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb,
  updated timestamptz default now()
);

alter table public.progress enable row level security;

drop policy if exists read_own on public.progress;
drop policy if exists insert_own on public.progress;
drop policy if exists update_own on public.progress;

create policy read_own on public.progress for select using (auth.uid() = user_id);

create policy insert_own on public.progress for insert with check (auth.uid() = user_id);

create policy update_own on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 自检：应返回 3 行策略，以及 relrowsecurity = true
select policyname, cmd from pg_policies where tablename = 'progress';
select relname, relrowsecurity from pg_class where relname = 'progress';
