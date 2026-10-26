# Addis Football

Addis Football is a mobile-first pickup football app for Addis Ababa, Ethiopia.

Players can discover local football games, reserve spots, join waitlists, manage bookings, and handle payment instructions for paid games. Organizers and admins can create and manage games and confirm organizer-direct payments.

## Tech Stack

- React Native
- Expo
- Expo Router
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security (RLS)
- Supabase RPC
- EAS Build

## Authentication

Addis Football currently supports:

- Google Sign-In
- Email and password

Phone OTP and SMS authentication are not used.

Authentication is handled by Supabase Auth.

## Languages

The app supports:

- English
- Amharic
- Afaan Oromoo

Language selection is available from the player's profile and is managed through the app's language context.

## Main Player Features

Players can:

- Sign in with Google or email/password
- Browse available football games
- View games by date
- View game location, time, format, skill level, price, and availability
- Reserve available spots
- Join waitlists when appropriate
- View their bookings
- Cancel eligible bookings
- Submit organizer-direct payments as paid
- View payment status
- Manage their profile and preferred language

## Game Payment Modes

Each game uses one of three payment modes.

### Free

No payment is required.

The player reserves a spot and the booking can be confirmed immediately when capacity is available.

### Pay at Venue

The player reserves the game through Addis Football and pays at the venue.

Addis Football does not process the venue payment.

### Pay Organizer Directly

This is the primary paid-game flow for V1.

```text
Player reserves spot
        ↓
Addis Football shows organizer payment details
        ↓
Player pays organizer externally
        ↓
Player taps "I've Paid"
        ↓
Payment request appears for organizer
        ↓
Organizer checks their payment account
        ↓
Organizer taps "Mark Paid"
        ↓
Booking/payment is confirmed
```

The organizer may provide information such as:

- Payment provider
- Payment phone/account
- Account holder name
- Amount to pay

For example, an organizer may use Telebirr.

Addis Football does not itself verify that an external transfer reached the organizer. The organizer is responsible for checking their payment account before confirming the payment.

The app therefore uses wording such as:

> Payment confirmed by organizer

## Organizer and Admin Features

Authorized organizers/admins have access to Admin Tools.

Current tools include:

### Create Game

Create a football game and configure:

- Title
- Organizer
- Area/location
- Date
- Start and end time
- Format
- Skill level
- Capacity
- Image
- Payment method
- Price
- Organizer payment details when required

### Manage Games

Organizers can manage games they created.

Admins can manage games according to their elevated permissions.

Management includes viewing, editing, and cancelling games.

### Payment Requests

For organizer-direct payments, organizers/admins can view payments submitted by players.

Before selecting **Mark Paid**, the organizer should verify the transfer in their external payment account.

## Booking States

Important booking states include:

```text
pending_payment
confirmed
waitlisted
cancelled_by_player
cancelled_by_organizer
```

Bookings also maintain payment state separately.

Important payment states include:

```text
not_required
pending
submitted
paid
failed
refund_pending
refunded
```

## Organizer-Direct Payment States

Typical organizer payment progression:

```text
pending
   ↓
Player pays externally
   ↓
submitted
   ↓
Organizer verifies payment
   ↓
paid
```

The app maintains the booking and payment status while the actual transfer occurs outside Addis Football.

## Cancellation

Players can cancel eligible bookings.

Organizers/admins can cancel games when authorized.

For organizer-direct payments, Addis Football does not automatically reverse an external payment. If a player already paid the organizer and a refund is required, the player may need to contact the organizer.

Legacy integrated-payment refund functionality may still exist in the codebase but is not the primary V1 organizer-payment flow.

## Waitlist

When a game is full, eligible players may join the waitlist.

The backend contains support for paid waitlist offers and expiration handling.

Paid waitlist payment-before-expiry behavior should be fully tested before relying on it in production.

## Database

Supabase PostgreSQL is the application's primary database.

### `profiles`

Important fields include:

```text
id
full_name
phone
skill_level
avatar_url
role
chapa_subaccount_id
```

Roles include:

```text
player
organizer
admin
```

The `phone` field may still be used as profile/contact information. It does not mean the app uses phone OTP authentication.

### `games`

Important fields include:

```text
id
title
organizer
area
distance
time
format
skill
price
spots_left
status
image_url
created_by
starts_at
ends_at
payment_method
payment_provider
payment_phone
payment_account_name
```

Supported payment methods:

```text
free
venue
organizer
```

### `bookings`

Important fields include:

```text
id
created_at
user_id
game_id
status
price_paid
payment_status
payment_offer_expires_at
```

### `payments`

The payments table maintains payment history and state.

Important fields include:

```text
id
created_at
updated_at
booking_id
user_id
game_id
provider
amount
currency
status
checkout_url
paid_at
submitted_at
confirmed_at
confirmed_by
player_reference
metadata
```

Payment/refund-related fields may also exist for legacy integrated payment functionality.

## Important Supabase RPCs

The application uses Supabase RPC functions for important business operations.

Current functionality includes RPCs such as:

```text
create_game
update_game
join_game
reserve_organizer_paid_game
submit_organizer_payment
confirm_organizer_payment
cancel_booking
cancel_game
```

Additional waitlist, expiration, and legacy payment functions may also exist in the database.

The deployed Supabase database should be treated as the authoritative source for exact RPC signatures.

## Security

Security-sensitive business rules should be enforced by Supabase rather than trusted only to the mobile client.

Important principles:

- Use Row Level Security
- Require authentication for protected operations
- Protect organizer/admin operations
- Prevent unauthorized role escalation
- Keep service-role credentials out of the app
- Never commit private credentials
- Validate important booking/payment transitions server-side
- Do not trust the client to mark its own organizer payment as confirmed

Organizer payment confirmation is intentionally separated:

```text
Player → submits payment claim
Organizer → confirms payment
```

## Addis Ababa Time

Games are scheduled according to Addis Ababa time.

Administrative game scheduling must preserve the intended Ethiopian kickoff time even when the organizer/admin is physically located in another timezone.

## Core Project Structure

A simplified structure is:

```text
addis-football/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── (auth)/
│   │   │   └── login.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── bookings.tsx
│   │   │   └── profile.tsx
│   │   └── admin/
│   │       ├── create-game.tsx
│   │       ├── edit-game.tsx
│   │       ├── manage-games.tsx
│   │       └── payment-requests.tsx
│   ├── components/
│   │   ├── GameCard.tsx
│   │   └── ConfirmModal.tsx
│   ├── constants/
│   │   └── colors.ts
│   ├── i18n/
│   └── lib/
│       └── supabase.ts
├── assets/
├── app.json
├── eas.json
├── package.json
└── README.md
```

Supporting/generated files may differ from this simplified structure.

## Important Screens

### Login

Handles:

- Google authentication
- Email/password authentication
- Account creation

There is no SMS verification screen in the current authentication flow.

### Discover

Displays available football games and provides the appropriate reservation, payment, or waitlist action.

### Bookings

Displays the player's current and historical booking state, including organizer payment status and cancellation information.

### Profile

Allows players to manage profile information, skill level, and language.

Authorized organizers/admins also receive access to Admin Tools.

### GameCard

Displays game information and handles major player actions such as reservations and organizer-direct payment instructions.

### Create Game

Allows authorized users to create games and configure the game's payment method.

### Edit Game

Allows authorized users to modify existing games and handle authorized cancellation behavior.

### Manage Games

Allows organizers/admins to manage their games.

### Payment Requests

Allows organizers/admins to review player-submitted organizer payments and mark verified payments as paid.

## Environment Variables

Client configuration uses environment variables such as:

```bash
EXPO_PUBLIC_SUPABASE_URL=YOUR_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never place a Supabase service-role key or other privileged secret in the mobile application.

## Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Start with a cleared cache when needed:

```bash
npx expo start -c
```

## Production Builds

iOS:

```bash
eas build --platform ios --profile production
```

Android:

```bash
eas build --platform android --profile production
```

A Git push does not update an already-built mobile binary. App Store and Google Play releases require the appropriate new build/submission process when native production changes are being released.

## Legacy Chapa Integration

Earlier development included a more integrated Chapa payment architecture.

Some Chapa-related database fields, RPCs, Edge Functions, refund logic, or other code may remain in the project.

For the current V1, Chapa is not the primary organizer-direct payment path.

The current V1 design intentionally favors:

```text
Addis Football
    ↓
Reservation
    ↓
Organizer payment details
    ↓
External payment
    ↓
Player submits "I've Paid"
    ↓
Organizer verifies
    ↓
Organizer confirms
```

Legacy Chapa functionality should remain isolated from organizer-direct games unless it is intentionally reintroduced later.

## Current Pre-Launch Testing

Before production release, verify at minimum:

- [ ] Google Sign-In works
- [ ] Email/password sign-in works
- [ ] Email/password account creation works
- [ ] Sign out works
- [ ] Discover loads games correctly
- [ ] Calendar/date filtering works
- [ ] Free-game reservation works
- [ ] Pay-at-venue reservation works
- [ ] Organizer-direct reservation works
- [ ] Organizer payment details display correctly
- [ ] "I've Paid" changes payment to submitted
- [ ] Payment Requests shows submitted payments
- [ ] Organizer can mark a verified payment paid
- [ ] Player sees payment confirmed by organizer
- [ ] Duplicate active bookings are prevented
- [ ] Player cancellation works
- [ ] Organizer game cancellation works
- [ ] Organizer-direct refund/contact messaging is correct
- [ ] Waitlist behavior works
- [ ] Authorized organizer/admin can create games
- [ ] Authorized organizer/admin can edit games
- [ ] Authorized organizer/admin can manage games
- [ ] Unauthorized users cannot access protected admin operations
- [ ] English renders correctly
- [ ] Amharic renders correctly
- [ ] Afaan Oromoo renders correctly
- [ ] Addis Ababa game times remain correct from other timezones
- [ ] iPhone safe areas work
- [ ] Android status/navigation areas do not overlap the UI
- [ ] Keyboard behavior works on forms

## Current V1 Summary

Addis Football is an Expo/React Native pickup-football app for Addis Ababa.

Players authenticate using Google or email/password, discover games, reserve spots, join waitlists, manage bookings, and follow the appropriate payment flow for each game.

Games can be free, paid at the venue, or paid directly to the organizer. For organizer-direct games, Addis Football manages reservation and payment status while the player transfers money externally. The organizer verifies receipt and confirms the payment.

Organizers/admins can create, edit, cancel, and manage games and review submitted payment requests.

Supabase provides authentication, PostgreSQL storage, Row Level Security, and RPC-based business logic.

The app supports English, Amharic, and Afaan Oromoo.

---

**Addis Football — Version 1.0**