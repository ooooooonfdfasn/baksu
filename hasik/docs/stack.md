# hasik Stack

## MVP Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase Realtime for chat and presence
- AWS Amplify Hosting for deployment

## Why This Shape

- The first product loop is mostly client interaction, realtime chat, and presence.
- Supabase keeps the realtime MVP small without building WebSocket infrastructure first.
- Amplify can host the web app and later connect the production domain.
- A future AWS-only backend can replace Supabase after the concept is validated.

## First Release Boundary

- Anonymous role-based entrance
- One shared lounge room
- Realtime chat with persisted recent messages
- Presence count
- Menu-triggered system messages
- Stay-time progress
- Basic reporting and moderation hooks in the next pass

## Later

- Persistent message history
- Admin moderation panel
- Attendance rewards
- Paid cosmetic items
- Watch-party side panel
- Region-themed rooms
