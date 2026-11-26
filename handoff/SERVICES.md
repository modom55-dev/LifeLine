# LifeLine services

LifeLine currently runs on **Manus-managed web/container hosting**, a **Manus-managed MySQL-compatible database**, **Manus OAuth** for owner login, and **Manus-managed object storage** for church/ministry logos. The published hostname is `churchconnec-35mxgbzl.manus.space`.

The app code uses Node.js, React, TypeScript, Express, tRPC, Drizzle, Vite, pnpm and qrcode.react. Fonts are self-hosted Cormorant Garamond and DM Sans. Browser localStorage holds sermon notes; browser printing and the Clipboard API provide print/copy actions.

No Firebase, Supabase, Stripe, external email delivery, payment processor or runtime AI service is used by the church bulletin workflows. Unused AI/map/notification/storage helper files in the exported starter are not evidence of active product features or required AI subscriptions.

On an independent host, provision a suitable Node runtime with HTTPS, a database, real owner authentication and static/durable asset hosting. The Manus credentials are not bundled or promised portable. See TAKEOVER-README.md for the files that need adaptation and the reported owner-login blocker.
