# KawanSport Mobile App — UI/UX Design Brief (Eksternal)

> Untuk desainer/tools UI di luar. Repo: `kawansport`, brand KawanSport — "main bareng, naik level".

Design a modern, energetic mobile app UI (Indonesian language) for **KawanSport** — a sports + social platform where users find sparring partners, book courts, join events/leagues, chat, rate venues, and shop gear. Target: Indonesian athletes 18–35, casual to competitive. Platform: React Native (iOS + Android). Style: sporty-fresh, rounded, orange primary CTA + deep green/navy, light mode first.

## Brand tokens

- Primary green `#15803D` / `#16A34A`, energy lime `#A3E635`, conversion orange `#F97316`, night navy `#0B1B33`, star amber `#F59E0B`, ink `#0F172A`, bg white / `#F6FAF7`.
- Radius 8/14/20/full, 8pt spacing, Inter/system font.
- Tone: casual Indonesian sportif ("Sparing", "Sapa dulu", "Slot tersisa").

## Screens / flows (with empty, loading, error states each)

1. Auth: splash/onboarding (3 slides) → login → register (with password rules)
2. Bottom tabs (6): Event, Booking, Shop, Partner, Chat (unread badge), Profil (avatar)
3. Events: list (filter chips + cards with slot bar) → detail (hero, Info/Peserta tabs, sticky Join) → create (sport, title, datetime picker, map pin, capacity, confirm summary)
4. Partner search: filters in bottom sheet (sport, skill, radius, GPS) → result cards (match %, skill, distance) → "Ajak Main" → chat
5. Booking: venue list → venue detail (court chips, 14-day strip, slot grid with status icons, running total, rating summary) → checkout (dominant Pay button, copyable VA) → My Bookings (status filter, repay)
6. Marketplace: cart (product images, per-seller groups, big steppers) → checkout → orders (status badges, tracking)
7. Chat: list (avatar, snippet, time, unread) → room (bubbles, timestamps, read status, human connection status, 48px composer)
8. Rating: venue rating summary (distribution bars) → review list (sort segmented) → rating form modal (interactive stars, 1000-char counter)
9. Profile: social card (avatar, skill chips, sports, stats) → edit with live preview + one-tap GPS
10. Global: toasts, skeleton loaders, error banners, human (non-technical) copy throughout

## Deliverables

Mobile-first screens (360×800), one component library page, one design-token sheet. Max 3 taps to core actions (join event, book slot, chat partner).
