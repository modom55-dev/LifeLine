# LifeLine — builder takeover

**LifeLine · Connecting the Church Beyond Sunday. · Powered by The O Factor**

This package hands another builder the current WholeLife Community Church pilot, its source, safe bulletin content and faithful branding references. It is a continuation starting point, not a turnkey deployment outside Manus. The original workspace is `/home/ubuntu/churchconnect`; its internal name remains ChurchConnect for compatibility.

**Live access page:** https://churchconnec-35mxgbzl.manus.space/access  
**Member route:** https://churchconnec-35mxgbzl.manus.space/c/wholelife  
**Published source version:** `e0ffdeb6dc1a62ef30b0e157d1f7656ccf763de0`

The generated hosting name does not change the app’s LifeLine identity. This app is separate from https://www.wholelifechurch.org/ and did not replace that church website.

## What to give the next builder

Start with [LifeLine-Project-Prompt.md](LifeLine-Project-Prompt.md), the full copy-ready requirements, known state and completion prompt. [LifeLine-Getting-Started.md](LifeLine-Getting-Started.md) describes the intended owner workflow; it is not evidence that the owner completed it.

[Source ZIP](source/lifeline-source.zip) contains the exact Git-tracked source at the published version, including the lockfile, migrations, tests and Dockerfile. No GitHub repository is attached to this handoff: the recipient must create their own repository if desired. The archive is not a transferred GitHub account or managed deployment.

[Current bulletin export](data/wholelife-current-bulletin.json) preserves safe church information and the existing draft/published content. It is a content export, not a complete database backup. User records, owner identifiers, activation secrets and invitation secrets are intentionally excluded. Establish ownership securely in a new setup rather than treating missing identity fields as permission to claim the church.

[Branding assets](branding/) supply the genuine church artwork, faithful Morning Manna reference, supplied video and font licensing materials. [Screenshots](screenshots/) are app snapshots for visual reference. They do **not** include evidence of the reported Manus provider-page/script error. Keep the full prompt, source, export, assets and screenshots together.

## Services actually used

The published application runs on **Manus-managed Node container hosting**. Its durable content and identity records use a **MySQL-compatible managed database**. Owner authentication uses **Manus OAuth**, with application session cookies. Brand images use **Manus object storage**, exposed through project-relative `/manus-storage/` URLs.

There is **no Firebase, Supabase, Stripe, runtime AI or outbound email service** in the implemented bulletin workflow. Newsletter copying produces text; it does not send email. Giving and livestream fields are external links, not payment processing or broadcasting. The starter contains unused AI, image, transcription, data, mapping, notification and storage helper code; those files are not proof that these features are connected. The active router deliberately has no email/notification feature.

Platform credentials are neither portable nor bundled. Do not expect the original database, OAuth registration, session-signing configuration or storage permissions to follow the ZIP. Code alone cannot deploy unchanged with working login and storage on another host.

## Stack and controlled setup

The source uses **React 19, TypeScript, Vite, Express, tRPC, Drizzle and mysql2**, with **pnpm 10.18.0**. The Dockerfile uses **Node 22** and serves the compiled Node application, not just a static frontend.

In a separate working copy, use the pinned package manager and review:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

These commands verify installation, types and compilation; they do not validate external OAuth or establish ownership. `pnpm test` is available, but inspect database-dependent tests and use isolated test infrastructure, never the current production database.

Apply reviewed migrations with `pnpm db:migrate` only against an explicitly configured, authorized new database. Do not automatically run migrations, `db:push`, seed scripts or imports against current production. `scripts/setup-pilot.ts` assumes MySQL and a Manus-authenticated ownership claim, creates sample content and writes a private activation file outside the source tree. Review and adapt it before any new-platform use; it is not a general-purpose content-import command.

## Authentication and data migration boundaries

Off Manus, replace the Manus-specific authentication integration with an explicit real provider and verified server-side sessions, then bind the intended owner securely. This guide does not select a provider. Never fabricate an authenticated user, let the first visitor become owner, or remove authorization to make a demo work.

Primary adaptation points are `client/src/const.ts`, `server/_core/oauth.ts`, `server/_core/sdk.ts`, `server/_core/publicConfig.ts` and `server/_core/env.ts`. Also review context/cookie handling and the exact owner gate in `server/church.ts`: a real authenticated user must have a positive user ID, must not be a `cron_` identity, and must exactly match the church’s nonempty `ownerOpenId`. An admin role alone does not grant church ownership.

Retain the `x-churchconnect` mutation-header contract, `webdev_app_session` session cookie, `cc_pilot_access` tester cookie and `churchconnect:notes:${slug}:${serviceDate}` browser-local note keys unless deliberately migrating them. Preserve secure cookie behavior, OAuth state protection and server-side admission checks. Notes are local, unsynced and not part of the database export.

`drizzle/schema.ts` and checked-in migrations define `users`, `churches`, `churchBulletins` and `pilotInvites`. Draft/published JSON snapshots and optimistic revisions must survive migration. The driver, schema, migrations and some query/result behavior are MySQL-specific; choosing PostgreSQL requires adaptation, not merely changing the connection string.

## Branding and asset portability

Preserve the editorial navy/silver/gold/warm-white direction and the genuine WholeLife logo beside LifeLine. Cormorant Garamond and DM Sans are self-hosted through Fontsource imports in `client/src/index.css`; retain the copied package-root font licenses with redistributed font files.

The official logo originated at `https://wholelifechurch.org/manus-storage/wholelife-official-logo_873f9ff3.webp`. Its current app mapping is `/manus-storage/wholelife-official-logo_52875987.webp`. The Morning Manna PNG is a faithful crop from the owner’s `08_Intro.mp4`, mapped to `/manus-storage/morning-manna-reference_ced04beb.png`. Rehost the supplied branding files and update `shared/identity.ts` to the new asset URLs. Preserve artwork and aspect ratios. Morning Manna is a ministry reference, not the LifeLine or church logo. No authentic standalone The O Factor logo was obtained; use the text attribution.

## What remains unfinished

The published pilot’s admission gate remains intact, weekly content remains labeled **sample data**, and giving/livestream links remain blank. Sunday worship is **11:00 AM**. Saving a draft is distinct from publishing a bulletin; deploying the website does neither automatically.

The actual owner remains **unclaimed**. The owner reports a Manus script-download failure after redirect to its sign-in page; owner login, activation and the real owner publishing workflow are unfinished. Do not label that provider failure fixed or infer its cause from app snapshots. For this Manus-hosted issue, use **https://help.manus.im**; never send private activation keys. Preserve the current authentication flow unless a replacement is explicitly authorized.
