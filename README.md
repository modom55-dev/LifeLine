# LifeLine

**Connecting the Church Beyond Sunday. · Powered by The O Factor**

Weekly bulletin app for WholeLife Community Church (105 Church Street, Totowa, NJ 07512 · Sunday 11:00 AM).
Moved off Manus in November 2026. It now runs on any Node 22 host with MySQL, and owners sign in with Google.

## How it works
- **Owner** signs in with Google. While the church is unclaimed, only the Google-verified address in `OWNER_EMAIL` can press **Activate owner workspace**. Once claimed, ownership never changes automatically.
- **Weekly bulletin:** Save draft → Preview → Publish saved draft. Saving never changes what members see.
- **Members/testers** need no account. During the pilot they use 7-day invitations the owner creates under **Pilot access**.
- **Sermon notes** stay in each member's browser only. Print hides notes and owner controls. Newsletter copy is text only, so nothing is emailed.
- Weekly content is still labeled **sample data**. Giving and livestream links stay blank until the church supplies real ones.

## Settings (environment variables)
See `.env.example`. Required: `DATABASE_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`.
`SESSION_SECRET` is optional; if blank, the app generates one and keeps it in the database.

## Start-up
`scripts/start-production.sh` (the Docker default) runs migrations, imports `data/wholelife-current-bulletin.json`
**only if the church doesn't exist yet**, then starts the server. Re-running never overwrites content.

## Development
```sh
pnpm install --frozen-lockfile
pnpm check && pnpm build
DATABASE_URL=... SESSION_SECRET=<32+ chars> pnpm test   # uses disposable test records
```

## Changes from the Manus version
- Manus OAuth → direct Google sign-in (server-side code exchange, verified ID token, state cookie).
- Owner bound by verified `OWNER_EMAIL`; the old one-time activation key path still works.
- Logos served from `client/public/brand/` instead of Manus storage. Leader titles: Bishop Michael H. Odom, Sr.; Pastor Pamela Y. Odom.
- Removed unused Manus starter helpers (AI, maps, storage, notifications).
- Kept: `x-churchconnect` header, `webdev_app_session` and `cc_pilot_access` cookies (now SameSite=Lax), local-note keys.
