-- Extend the same single preference to all existing badges. RLS and grants remain unchanged.
-- A normal badge does not require an event save; authenticated ownership stays anchored to auth.users.
alter table public.halloween_featured_badges
 drop constraint halloween_featured_badges_user_id_season_fkey,
 drop constraint halloween_featured_badges_season_check,
 drop constraint halloween_featured_badges_badge_id_check,
 add constraint profile_badge_scope_check check (
  (season='halloween-2026' and badge_id in ('midnight-conqueror','crown-of-midnight'))
  or (season='studentos' and badge_id in ('hello','try','hard','nah','unstoppable','deep','tree','sophyra','genesis','metaworld','err404'))
 );
comment on table public.halloween_featured_badges is 'One optional earned StudentOS or event badge per account; accepted friends read the projection only. Verified service writes; no task or reward details are shared.';
