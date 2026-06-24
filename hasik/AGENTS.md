# AGENTS.md

## Project Notes

- Work in `/Users/jinu/dev/hasik`.
- The project is a Next.js/Supabase realtime chat MVP for `hasik`.
- Use Korean for user-facing updates unless the user asks otherwise.

## Verification

- The user will do actual visual/device verification directly, especially mobile and PC UI checks.
- Codex should still run local checks that do not replace user visual review, such as `npm run typecheck` and `npm run build`, when relevant.
- Do not spend time launching browser automation for final UI confirmation unless the user explicitly asks for it.

## UI Direction

- Mobile UI is the priority while the early product shape is being decided.
- Design mobile and PC as related but different layouts, not as a simple scale-up/scale-down of the same surface.
- On mobile, prioritize one-handed use, short vertical panels, fixed/floating controls, and full-width touch targets where helpful.
- On PC, give panels, lists, buttons, forms, and modals deliberate max widths so UI elements do not stretch across the whole screen unnecessarily.
- Keep PC behavior in mind during every UI change, but do not treat PC visual polish as the blocking verification path unless requested.
