# Atrio vision

Atrio is the entrance to your home server: calm, fast, and clear about what is going on.

## Look: calm glass

- Full-screen wallpaper with translucent, blurred panels and generous spacing.
- One typeface (Manrope), soft corners (16–28 px), a dark ground; the brand gradient
  (`#22D3EE` → `#6366F1`) is kept for small accents.
- Status is never told by colour alone: running apps have a round dot, stopped apps a square one, and
  every dot comes with a label.
- Works at phone width: panels stack, toolbars wrap.

## First priorities

1. **Dashboard and widgets.** A new home page with system widgets that keep some history (CPU, memory,
   disk, network over the last hour) and room for widgets added later.
2. **App management.** Each app opens a side panel with its health, live logs, terminal, and one-click
   open, restart, stop and update.
3. **Command palette.** `Ctrl K` opens apps, runs actions ("restart Immich") and jumps to settings.

Later: mobile and PWA polish, custom widgets, a reworked file manager and app store.

## Technical plan

The codebase inherited from CasaOS-UI uses Vue 2.7 (end of life), Buefy/Bulma and vue-cli. The redesign
goes onto a modern base first:

1. **Migrate to Vue 3 + Vite** while keeping today's features working against the CasaOS v0.4.x API.
   The app runs on the Vue 3 compatibility build (`@vue/compat`) with Buefy 3, still styled with the
   Bulma 0.9 / Buefy 0.9 SCSS; components move to plain Vue 3 one by one until compat can be dropped.
2. **Build the new design system** (tokens, glass panels, buttons, inputs) as plain Vue components.
3. **Ship the priorities above**, one screen at a time.

Atrio keeps talking to the stock CasaOS backend: no backend changes are required to run it.
