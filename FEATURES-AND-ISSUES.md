# LifeLine feature and issue notes

## Existing behavior to preserve

The owner-requested application is LifeLine — Connecting the Church Beyond Sunday., Powered by The O Factor. The official WholeLife logo is next to its wordmark. Church information is Sunday 11:00 AM, 105 Church Street, Totowa, NJ 07512 and www.wholelifechurch.org. The design uses editorial typography, navy/silver/gold/warm white, and faithful cyan/orange church artwork rather than generated logos.

The implemented MVP has owner-only bulletin APIs, persistent draft/published snapshots, optimistic revision conflicts, draft preview, intentional bulletin publication, revocable seven-day tester invitations, a stable /c/wholelife route and QR, a mobile member bulletin, local-only sermon notes, browser print and plain-text newsletter copying. Giving and livestream fields are present but empty. Sample data stays clearly labeled. There is no runtime AI dependency, billing flow, donation processing or outbound email.

TypeScript and the production build passed, and 26 automated tests across four files passed on the saved version. Real-browser member verification exercised temporary authorized invitations and revoked them afterward. These results do not establish successful owner OAuth completion.

## Current reported blocker

The owner says **Sign in securely** redirects to Manus at manus.im/app-auth, where Manus shows **“This page couldn't load.”** A Manus-hosted script fails to download; reloading once did not help. The actual owner sign-in, activation and owner browser editing workflow have not been completed. The published app itself rendered in verification, its health returned HTTP 200, and unauthenticated member access returned HTTP 403. The provider-page problem was reported by the owner; no screenshot of that failed script is included because the owner did not upload one.

For an independent takeover, replacing the Manus authentication dependency with a real login provider/session implementation is a migration requirement. Do not turn the activation key into a password, invent an authenticated owner, allow first-login ownership, or bypass authentication. Bind the intended owner's identity securely through a deliberate setup process. Manus-specific provider support is at https://help.manus.im.

## Included screenshots

`lifeline-mobile-access.png` is the 375-pixel access page after the confirmed logo, 11:00 AM, address and website changes. `lifeline-published-desktop.webp` shows the published access screen at the live domain. `wholelife-ministry-reference.webp` shows the expanded mission/leadership/Morning Manna panel; it was captured in development before the final service/contact update, and its temporary Preview banner is not a production requirement. All screenshots are copied from prior verification, not a claim that the owner's browser login succeeded.

## Migration boundaries

This is one church, one owner and one current bulletin, not a completed multiple-church administration service. No staff permissions, historical archive, automated restore UI or ownership-transfer UI exist. Browser-local notes cannot be exported from the server; changing domains will not automatically transfer them. The user must copy important notes in the browser that contains them.

The bundled content JSON contains church identity and current bulletin snapshots only. It deliberately excludes user records, owner identifiers, activation material and invitations. Establish new authorized ownership and issue new invitations on the replacement system. The source ZIP is an exact export of the saved code, not a credential-equipped, already migrated standalone deployment.

The original stable hosting address contains “churchconnec” even though the app is LifeLine. The church website www.wholelifechurch.org is separate and was not replaced. Keep the existing deployed app running until the replacement is tested and deliberately cut over; this export does not disable, delete or redirect it.
