This is a [Next.js](https://nextjs.org) app configured for Cloudflare Workers with `@opennextjs/cloudflare`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the app under `app/`. The page auto-updates as you edit files.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare

This app uses OpenNext for Cloudflare, which builds a Worker in `.open-next/worker.js` and static assets in `.open-next/assets`.

Use a Cloudflare Workers project, not the old Cloudflare Pages Next.js preset. The Pages preset expects `.vercel/output/static`, which OpenNext does not generate.

For Cloudflare Workers Builds, set the project root directory to this `client-next` folder and use:

```bash
npm run cf:build
```

as the build command, then:

```bash
npm run deploy
```

as the deploy command. For a local production-like preview, run:

```bash
npm run preview
```
