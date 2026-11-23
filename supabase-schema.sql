-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run for schema/policy updates.
create table if not exists public.purchased_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_title text not null check (char_length(event_title) between 1 and 160),
  venue text not null check (char_length(venue) between 1 and 120),
  event_date date,
  quantity integer not null default 1 check (quantity between 1 and 10),
  barcode text check (barcode is null or char_length(barcode) <= 300),
  attachment_path text,
  created_at timestamptz not null default now()
);
alter table public.purchased_tickets add column if not exists attachment_path text;
create index if not exists purchased_tickets_user_id_event_date_idx on public.purchased_tickets (user_id, event_date);
alter table public.purchased_tickets enable row level security;
drop policy if exists "Users can read their own tickets" on public.purchased_tickets;
drop policy if exists "Users can add their own tickets" on public.purchased_tickets;
drop policy if exists "Users can edit their own tickets" on public.purchased_tickets;
drop policy if exists "Users can delete their own tickets" on public.purchased_tickets;
create policy "Users can read their own tickets" on public.purchased_tickets for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own tickets" on public.purchased_tickets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can edit their own tickets" on public.purchased_tickets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tickets" on public.purchased_tickets for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.purchased_tickets to authenticated;
revoke all on public.purchased_tickets from anon;

-- Private bucket for ticket scans/PDFs. Files are never public; the browser requests short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-attachments', 'ticket-attachments', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists "Owners can view own ticket files" on storage.objects;
drop policy if exists "Owners can upload own ticket files" on storage.objects;
drop policy if exists "Owners can replace own ticket files" on storage.objects;
drop policy if exists "Owners can delete own ticket files" on storage.objects;
create policy "Owners can view own ticket files" on storage.objects for select to authenticated using (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners can upload own ticket files" on storage.objects for insert to authenticated with check (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners can replace own ticket files" on storage.objects for update to authenticated using (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners can delete own ticket files" on storage.objects for delete to authenticated using (bucket_id = 'ticket-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
