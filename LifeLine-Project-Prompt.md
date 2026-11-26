# LifeLine — copy-ready project and completion prompt

Copy the prompt below into your next development task. It contains project requirements and public references, not passwords, activation keys, session cookies, or temporary OAuth URLs.

---

Act as a senior full-stack developer and product implementation lead. Continue and complete **LifeLine**, a functional church bulletin web application powered by **The O Factor**, for **WholeLife Community Church**. This must be a working application, not a marketing page or static mockup. Preserve the existing deployed MVP when its repository is available rather than rebuilding it unnecessarily.

Execute the requested work using reasonable assumptions and do not ask me clarification questions. State any actual blocker clearly. Do not replace missing facts with invented church information, fabricated login success, or insecure shortcuts.

## Project identity and verified information

Use the exact app name **LifeLine**, tagline **Connecting the Church Beyond Sunday.**, and attribution **Powered by The O Factor**. Put the genuine WholeLife logo immediately beside the LifeLine wordmark. Keep these strings consistent across the access screen, owner workspace, member header, printable bulletin, newsletter and page metadata where applicable.

The church is **WholeLife Community Church**, at **105 Church Street, Totowa, NJ 07512**. Sunday worship is **11:00 AM**. Its official website is **https://www.wholelifechurch.org/**. Display the address and clickable website clearly on the access screen and weekly bulletin, including printable and newsletter output. Do not hide these essential details only inside an expandable information panel.

The verified mission is: “We believe in reconciliation and restoration to wholeness through faith in Jesus Christ.” The mission references **1 Thessalonians 5:23**. The Senior Pastor is **Pastor Michael H. Odom, Sr.** and the Executive Pastor is **Pastor Pamela Y. Odom**. Distinguish this verified church identity from illustrative weekly sermon and event content.

Use these public source references, reviewed November 26, 2026:

- Official home: https://www.wholelifechurch.org/
- Official About page: https://wholelifechurch.org/about
- Genuine church logo: https://wholelifechurch.org/manus-storage/wholelife-official-logo_873f9ff3.webp
- Observed official website stylesheet: https://wholelifechurch.org/assets/index-D3dv93TI.css

The church logo is a 720×675 transparent WebP. Preserve its original artwork, transparency, aspect ratio and colors; do not redraw or recolor it. If a versioned asset URL changes, find the current logo on the official site rather than substituting a similar church’s logo.

I supplied an intro video named **08_Intro.mp4**. It contains the real **Morning Manna** ministry logo with Pastor Michael H. Odom, Sr., and the line “Strength for the journey, grace for the calling,”. Use that faithful reference only for a separately labeled Morning Manna ministry area. It is not the LifeLine app name or the church logo. The official site lists Morning Manna Tuesday and Thursday at 7:00 AM, and Bible Study Wednesday at 7:00 PM. Do not invent streaming destinations. No genuine standalone The O Factor logo was obtained, so use the exact text attribution.

## Visual design

Maintain the editorial application design with navy **#14283F**, silver **#C8D1DB**, gold **#D6BD87**, and warm white **#FAF9F6**. Use self-hosted **Cormorant Garamond** for display typography and **DM Sans** for interface text. The official site’s blue **#56AEE0**, orange **#E8722C**, and deeper orange **#C9581B** are modest church-specific accents. Approximate blue **#335791** sampled from the supplied video is a ministry-reference accent, not an official brand specification.

Make the member experience mobile-first and usable at 375 pixels. Keep the logo, title, service time, address and website readable. The owner workspace should make the weekly publishing process clear, without turning the application into a promotional landing page.

## Required application behavior

Provide secure owner login with server-side authorization. Only the activated church owner may edit or publish; an ordinary signed-in user, a role label, or the first visitor must not gain ownership. The current implementation uses Manus OAuth plus a private one-time owner activation key. Store only the key’s hash in the database and deliver the raw key privately, outside the repository and public storage.

Persist an editable weekly bulletin containing service date and time, sermon title, scripture, optional speaker and summary, announcements, events, and giving/livestream URL fields. Maintain separate durable draft and published snapshots. **Save draft** must not change the member bulletin. **Preview** shows the saved draft. **Publish saved draft** intentionally copies the saved draft to the member snapshot. Use optimistic revisions to prevent silent overwrites and preserve unsaved work on conflicts.

Members need no account or AI subscription. During the restricted pilot, admit them using revocable, expiring seven-day tester invitations. A tester can read only the published bulletin, never owner APIs or unpublished drafts. Generate a stable congregation route **/c/wholelife** and downloadable QR code without embedding owner keys or invitation secrets. Redeeming an invitation in one browser does not automatically admit another browser opened by a QR scanner.

Provide browser-local sermon notes, a printable bulletin, and a copyable plain-text newsletter. Notes must not be uploaded or sent to church staff. Explain that they are not encrypted or synced, can be seen by others using the same browser profile, and can be lost when browser data is cleared. Printing must exclude private notes and owner controls. Newsletter copying must not send email.

Keep the pilot weekly content clearly labeled **sample data**. Leave giving and livestream URLs blank until actual church-approved HTTPS destinations are supplied. The official website link is informational, not a substitute giving or streaming URL. Do not add AI calls, app billing, donation processing, outbound emails or unrelated analytics.

Design church-scoped records for future multiple churches, but prioritize the existing functional single-church pilot. Do not claim multi-church administration, staff roles, historical archives, automated backups or ownership transfer already exist.

## Existing implementation and deployment

The current stack is **React 19, TypeScript, Vite, Express, tRPC, Drizzle and managed MySQL**, with pnpm. On the current Manus environment the project directory is **/home/ubuntu/churchconnect**. That internal directory name is retained for compatibility even though the app is LifeLine. A different environment will need the repository and authorized configuration supplied to it.

The deployed app is **https://churchconnec-35mxgbzl.manus.space/**. Its direct access page is **https://churchconnec-35mxgbzl.manus.space/access** and member route is **https://churchconnec-35mxgbzl.manus.space/c/wholelife**. The hosting slug still reflects the original project name; the user-facing identity is LifeLine. This is separate from the church’s official website and did not replace its domain.

The published version is **e0ffdeb6dc1a62ef30b0e157d1f7656ccf763de0**. The current pilot service time was corrected to 11:00 AM in the church record and both existing bulletin snapshots, preserving every other content field. That correction brought the bulletin revision to 2. Do not reseed or overwrite current content just to apply branding or service information.

The existing project serves the original church logo from **/manus-storage/wholelife-official-logo_52875987.webp** and the faithful Morning Manna crop from **/manus-storage/morning-manna-reference_ced04beb.png**. These paths belong to this project’s managed storage; do not assume they are portable to a new host.

Preserve the existing **x-churchconnect** mutation-header contract, **webdev_app_session** owner session cookie, **cc_pilot_access** tester cookie, and **churchconnect:notes:${slug}:${serviceDate}** local-note keys. Renaming visible branding must not lose notes, invalidate working routes, or weaken auth. Keep secrets server-side, use secure HttpOnly session cookies, protect sensitive API responses from caching, and keep development file-serving restrictions intact.

## Current blocker and requirements to finish

The website was successfully published, and the access screen and health endpoint were verified. Unauthenticated member API access correctly returned HTTP 403. However, the owner’s actual end-to-end sign-in, activation and owner browser publishing workflow are **not yet completed**.

The owner reports that clicking **Sign in securely** reaches **manus.im/app-auth**, but Manus’s own page shows **“This page couldn’t load.”** A Manus script fails to download, and one reload did not resolve it. This is a reported provider-page failure, not proof of a bad LifeLine callback. Do not claim it has been fixed without evidence. The public OAuth app ID is **35mXGBZLHkwE7TgGoNkh6n** and the app callback is **https://churchconnec-35mxgbzl.manus.space/api/oauth/callback**. Never reuse the owner’s temporary OAuth state URL or publish its cookies.

For a Manus provider-page support issue, direct the owner to **https://help.manus.im** with the error screenshot and failed script URL. Do not send private activation keys. Preserve the current real authentication flow; do not fabricate a user, bypass login or silently replace the provider. If the owner explicitly authorizes a different authentication provider later, implement a real secure replacement while preserving ownership and content.

Completion requires a working authentication provider; authorized hosting with HTTPS; database connectivity and migrations; durable asset storage; valid server-side session configuration; the owner personally signing into the intended account and activating ownership; and owner-approved weekly content and actual giving/streaming links before real congregational use. Runtime AI access is not required. Hosting and authentication are infrastructure dependencies, not proof that church members need an AI subscription.

The current privately delivered owner key expires **December 3, 2026 at 11:48 UTC**. If it has expired and the church is still unclaimed, an authorized maintainer can issue a replacement through the existing unclaimed-key rotation process and deliver it privately. Do not claim ownership on the owner’s behalf or alter an already-claimed account.

## Implementation and completion sequence

1. Inspect the existing repository, deployment, data model, source assets and access controls. Separate working functionality from the reported provider failure. Reuse the verified source facts above; recheck time-sensitive information if working later.
2. Confirm the published app is reachable, its assets load, the church logo is next to LifeLine, and the 11:00 AM time, full address and website appear in the relevant screens and outputs.
3. Check the application’s OAuth redirect parameters and callback/state validation. Keep the return origin correct and the state nonce bound to the initiating browser. Escalate a Manus-hosted script failure through its support channel rather than inventing an app-side fix.
4. Have the owner complete real sign-in and privately enter the activation key. Verify that only that account receives owner access. Do not report successful activation until it actually occurs.
5. Verify an owner edit, save, draft preview and intentional bulletin publication. Protect existing content and unsaved edits. The managed database is shared with the deployed app; tests must use isolated disposable records and clean them up.
6. Create a temporary authorized tester invitation, verify the published member view on mobile, and test revocation. Keep no permanent test invitation or bearer secret in logs, source code or handoff files.
7. Verify notes remain local, print excludes notes, newsletter copying works, and the live QR resolves to the published congregation route without secrets. Do not reuse a QR pointing to the development Preview.
8. Run the affected checks. The current implementation previously passed **pnpm check**, **26 tests across four files**, and **pnpm build**. Preserve that evidence but rerun affected checks after changes; do not claim the previous tests completed the owner’s external OAuth flow.
9. Save authorized changes as a checkpoint. The first website publication was explicitly authorized and completed, but do not redeploy later modifications or widen bulletin access merely because the site is already published. Respect the current request and obtain any required publication approval through the platform’s normal flow.
10. Deliver a working link, concise setup instructions, verification results and honest remaining limitations. Explain the difference between deploying the website and publishing a saved weekly bulletin inside it.

## Owner’s first-use workflow

Once the provider login works: open LifeLine → **Church owner** → **Sign in securely** → sign in with the intended owner account → enter the private activation key → **Activate owner workspace**. Then use **Weekly bulletin** → edit → **Save draft** → **Preview** → **Publish saved draft**. Use **Pilot access** for tester invitations and **Sharing & QR code** on the live site for the published congregation QR.

The final result must be usable by the owner and invited testers, with genuine church branding, persistent weekly content and no authentication bypass. Clearly state whether the provider issue, owner activation and real owner browser workflow remain unfinished.
