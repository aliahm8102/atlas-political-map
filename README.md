# Interactive Political Map

The new Next.js application is in [`atlas/`](./atlas/README.md). The original `wim-main/` folder is preserved.

Start the application:

```bash
cd atlas
npm run dev
```

Open http://127.0.0.1:3000. Dependencies are installed in this workspace; on a fresh checkout, run `npm ci` first.

The application includes the neumorphic map interface, personal customization, bookmarks, browser-local custom characters and draggable markers, notes, Supabase authentication code, and complete database migrations. Sign-in is required to open the map. A local demo account is configured for this workspace; its credentials are in `atlas/.env.demo.local`. It works without Supabase or email confirmation and stores personal data in this browser. See the app's README for local account setup or Supabase connection instructions.
