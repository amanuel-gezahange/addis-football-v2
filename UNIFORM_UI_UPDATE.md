# Addis Football — Uniform UI Update

This build standardizes the app around the existing Profile visual language:

- Background: `#07131D`
- Card/surface: `#0C1F2B`
- Raised/selected surface: `#102D3E`
- Border: `#173442`
- Primary accent: `#00B77A`
- Main text: `#F7FAFC`
- Secondary text: `#8FA1AF`

Updated across player tabs, game details/booking UI, friends, messages, profile/edit profile/settings/notifications, authentication, organizer/admin flows, and shared components.

`src/constants/colors.ts` and `src/constants/theme.ts` now use the same palette so future screens can stay consistent.

TypeScript check: `npx tsc --noEmit` passes.
