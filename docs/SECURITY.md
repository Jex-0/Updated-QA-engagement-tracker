# Security review

Review of the current codebase (React app in `src/`, archived app in `legacy/`, Pages workflow in
`.github/`). The platform is a browser-only application: all data lives in `localStorage` and the
optional Firebase adapter talks to Firestore directly from the client. That shape sets the ceiling
for what any client-side control can guarantee — see *Residual risk* below.

## Fixed

| Issue | Severity | Where | Fix |
| --- | --- | --- | --- |
| Role self-assignment let anyone become Administrator: the sign-in form accepted an unknown name plus a chosen role, and sign-up accepted any role | Critical | `src/views/AuthView.tsx` | Sign-in only accepts existing accounts and always takes the role/team from the stored account; sign-up creates agents (the first account is still the Administrator) |
| Pasted Firebase config was executed with `new Function()` — arbitrary code execution from clipboard/shared-config content | High | `src/views/SettingsView.tsx`, `legacy/index.html` | `parseFirebaseConfig()` normalises the object literal to JSON, parses it with `JSON.parse`, and validates keys against an allowlist of string-valued config fields |
| Firebase project credentials (API key, project/app IDs) committed in source | Medium | `legacy/index.html` | Replaced with `null`; the config is supplied at runtime via Cloud Setup |
| Firebase SDK loaded from a CDN with no integrity check | Medium | `src/lib/cloud.ts` | Pinned bundles now carry `integrity` (SHA-384) and `crossorigin="anonymous"` |
| `vite`/`esbuild` dev-server advisories (GHSA-67mh-4wv8-2f99 arbitrary cross-origin requests to the dev server, GHSA-4w7w-66w2-5vf9 path traversal) | Moderate | `package.json` | Upgraded to `vite@6.4.3` (`npm audit`: 0 vulnerabilities) |
| Interim speech-recognition text written into `innerHTML` unescaped | Low | `legacy/index.html` | Escaped with `escapeHtml` |

## Checked, no issue found

- **SQL injection** — no database or query building anywhere; persistence is `localStorage` and the
  Firestore SDK.
- **XSS in the React app** — no `dangerouslySetInnerHTML`, `eval`, or `document.write` on untrusted
  data. The print/PDF report builds HTML in a new window but escapes every interpolated value.
- **CSV formula injection** — `safeCell()` already prefixes cells starting with `= + - @`.
- **CORS** — no server and no CORS configuration; the dev server keeps default (non-permissive)
  settings.
- **Debug endpoints** — none. The Pages workflow builds `dist/` only, so `legacy/` is not deployed;
  sourcemaps are disabled for production builds.

## Residual risk (needs a backend, not a client-side patch)

1. **No real authentication.** Sign-in is name-based with no password, so any user of the device can
   sign in as an existing manager or administrator. Role checks (`canAccess`, per-view guards) are
   UI-level only — anyone can edit `localStorage` (`qe-platform-v2`) and change their own role.
   Every engagement, dispute and audit entry of every agent is readable on the device.
2. **Firestore sync is unauthenticated.** `src/lib/cloud.ts` reads and writes the `engagements`
   collection without signing in, so the data is only as protected as the project's security rules.
   Publish rules that require authentication before enabling cloud sync.
3. **Rotate the exposed key.** The Firebase web API key that was committed in `legacy/index.html`
   remains in git history. Firebase web keys are not secrets by themselves, but the project is now
   publicly identifiable — restrict the key (Google Cloud → Credentials → API restrictions) and
   verify Firestore/Storage rules for `client-engagement-tracker`.
4. **Route guard gap.** `canAccess()` has no entry for the `engagement` and `agent` routes, so those
   routes fall through to `false` and every role is bounced to its default page. The detail views
   already enforce their own ownership checks, so this is a functional gap rather than an exposure —
   fixing it should keep those checks.
5. **No Content-Security-Policy.** Adding one to `index.html` would need `script-src` to allow the
   Firebase CDN and to accommodate the inline script the print-report window writes.
