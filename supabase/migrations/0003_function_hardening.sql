-- Security advisor fixes.
-- * touch_updated_at: pin search_path so it can't be hijacked by a same-named
--   object earlier in a caller's path.
-- * handle_new_user: trigger-only; it must not be callable through the API.

alter function public.touch_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
