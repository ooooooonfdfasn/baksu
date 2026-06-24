# Supabase Setup

## 1. Create Project

Create a Supabase project for `hasik`.

Recommended region for a Korea-first launch:

- Northeast Asia when available
- Otherwise the closest stable region in the Supabase console

## 2. Run SQL

Open Supabase Dashboard > SQL Editor and run:

```sql
-- copy from supabase/migrations/0001_hasik_messages.sql
```

The migration creates:

- `public.hasik_messages`
- RLS policies for anonymous read/write
- realtime publication for message inserts

Then run `supabase/migrations/0002_hasik_reports.sql` to enable profile-based reports.

The report migration creates:

- `public.hasik_reports`
- anonymous insert-only RLS policy

This is intentionally permissive for MVP speed. Add rate limiting, reports, and admin moderation before broad public launch.

## 3. Copy Environment Values

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_HASIK_ROOM=main-room
```

Restart the dev server after changing env vars.

## 4. Verify

1. Open `http://localhost:3000` in two browser windows.
2. Send a chat message in one window.
3. Confirm the other window receives it.
4. Refresh the page and confirm recent messages remain.

## 5. Before Public Traffic

- Add simple forbidden-word filtering.
- Add client-side cooldown.
- Add server-side rate limiting or edge middleware.
- Add an admin-only delete/hide flow.
- Add a report button.
