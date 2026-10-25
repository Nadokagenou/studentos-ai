-- One optional public badge per account. Only the verified service can write.
create table public.halloween_featured_badges (
 user_id uuid primary key references auth.users(id) on delete cascade,
 season text not null default 'halloween-2026' check (season='halloween-2026'),
 badge_id text not null check (badge_id in ('midnight-conqueror','crown-of-midnight')),
 earned_at timestamptz,
 selected_at timestamptz not null default now(),
 foreign key(user_id,season) references public.halloween_states(user_id,season) on delete cascade
);
alter table public.halloween_featured_badges enable row level security;
revoke all on public.halloween_featured_badges from public,anon,authenticated;
grant select on public.halloween_featured_badges to authenticated;
grant select,insert,update,delete on public.halloween_featured_badges to service_role;
create policy "own or accepted friend badge" on public.halloween_featured_badges
 for select to authenticated using (
  user_id=(select auth.uid()) or (
   not public.is_blocked((select auth.uid()),user_id)
   and exists(select 1 from public.friendships f
    where f.a=least((select auth.uid()),user_id)
      and f.b=greatest((select auth.uid()),user_id) and f.status='accepted')
  )
 );
create policy "active account badge reader" on public.halloween_featured_badges
 as restrictive for select to authenticated using ((select public.staff_account_allowed()));
comment on table public.halloween_featured_badges is 'Opt-in badge display for accepted friends. Private reward receipts remain in halloween_states.';
