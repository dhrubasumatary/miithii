# Developer handoff: 7 October 2026

Start with the root README and developer guide. Use `main` for the current system after PR #3
is merged. That pull request records the replacement of the retired tree.
No native generated Android/iOS projects, credentials, private captures, or APKs are
included in source. Fonts and application assets needed to build are included with their licenses.

The available prebuilt APK is version 0.0.1, the 5 October theme-preload build. It is 120182039
bytes with SHA-256 `81dc512270f06593593e8b317ebbfc565b2652da4026c4509927cafc11cc6cb2`.
It has recorded phone-installation evidence. A different share-polish build appears in the
status note but is not available locally. This source snapshot includes later documentation/site
work; it is not a preserved exact build-time source commit for that APK. Do not claim reproducible
binary identity from this snapshot.

Offline validation on 7 October: `pnpm run check` exited 0, with 4 pack tests, 90 mobile tests,
322 agent tests, both typechecks, pack freshness, and Ruff. No new native build, paid provider
probe, or phone listening session was run for the handoff.

The download site is separate from the voice runtime. Cloudflare serves the page and redirects
`/Miithii.apk` to a versioned GitHub release. LiveKit/Modal remain the voice runtime. See
`apps/download/README.md` and `wrangler.jsonc` for the website target and publishing command.

Open engineering questions include unauthenticated token admission, token publishing-source
restrictions, zero-audio transcript fallback, native review, and remaining phone acceptance.
The developer guide explains the evidence limits. A successful offline suite does not close them.

## Publication verification

- Current source: `https://github.com/dhrubasumatary/miithii/tree/codex/developer-handoff`.
- Migration review: `https://github.com/dhrubasumatary/miithii/pull/3`.
- Download page: `https://voice.miithii.in`, verified by HTTP 200 and browser inspection.
- APK release: `voice-2026-10-05-theme-preload`, public prerelease with `Miithii.apk` attached.
- Downloaded the entire APK through the site's public `/Miithii.apk` redirect. Byte count and
  SHA-256 match the artifact recorded above. GitHub's asset digest agrees.
- Cloudflare Worker `miithii-voice` serves the static page and release redirect. Its only remaining
  binding is ASSETS; the retired API service binding and two old Bodhan secret bindings were removed.
- Obsolete Vercel `nullvoid3/miithii-chat` Git connection was disconnected and verified null.
  Separate Cloudflare chat, subtitles, and API Workers were left in place.
- PR #3 publishes this migration to the default branch. No new CI workflow was added;
  the validation counts above are local checks, not a claim of GitHub CI acceptance.
