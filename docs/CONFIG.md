# Configuration, build, and static assets

## Build configuration

- `next.config.ts` includes the `pdfjs-dist` worker in Next output tracing so server-side PDF extraction works in deployment.
- `tsconfig.json` uses strict TypeScript, bundler resolution, `@/*` mapped to the repository root, and Next's type plugin.
- `tsconfig.node.json` compiles `scripts/**/*.ts` to `dist-scripts` with CommonJS compatibility.
- `eslint.config.mjs` uses Next core-web-vitals and TypeScript rules; `.next`, `out`, and `build` are ignored.
- `postcss.config.mjs` enables Tailwind CSS 4 through `@tailwindcss/postcss`.
- `app/globals.css` contains Tailwind imports and the shared card/button/input/badge classes.
- `vercel.json` only configures immutable public caching and CORS for `/corpus/*`; it does not define a cron schedule.

## Ignored files

`.env*`, `node_modules`, `.next`, build output, Vercel metadata, debug logs, TypeScript build info, and local OS files are ignored. Do not force-add `.env.local`.

## Public assets

- `public/corpus/index.html` links the corpus pages.
- `public/corpus/page1.html` through `page5.html` are the static corpus.
- `public/corpus/reference-table.json` contains expected count data.
- `public/corpus/manifest.json` describes generated corpus metadata.
- `public/favicon.*`, `public/*.svg` are UI/static assets and are not application data.

## Generated artifacts

`dist-scripts/` contains generated script JavaScript and should be regenerated when script sources change. The repository may also contain `mcq-validation.json`, which is validation/support data rather than a runtime secret.

## Deployment note

The current `vercel.json` has no cron entry even though historical handoff text refers to cron. If `/api/cron/verify` is needed in production, configure the scheduler explicitly and protect the route according to the deployed environment; do not assume the JSON currently schedules it.
