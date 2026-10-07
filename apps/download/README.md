# Miithii Android download page

Static download page for `voice.miithii.in`, hosted by the `miithii-voice` Cloudflare Worker
in the Promptmafia account. No framework or provider credentials. `worker.js` redirects the APK
download to a versioned GitHub release; large binaries are excluded from static asset uploads.

The prepared APK is the locally available 5 October theme-preload build, 120182039 bytes,
SHA-256 `81dc512270f06593593e8b317ebbfc565b2652da4026c4509927cafc11cc6cb2`.
It has recorded installation/phone evidence in `docs/current-work.md`. That note also records
a different share-polish APK; do not describe this file as that build or the latest share build.
The binary is ignored by Git. If replacing it, update the page's date, size, and hash together.

Deploy from the repository root with `pnpm dlx wrangler deploy --config apps/download/wrangler.jsonc`.
The terminal's Cloudflare token must have access to the account named in that config. Vercel is
not used for this page. Verify the release URL, HTTPS page, and downloaded file hash after publishing.
