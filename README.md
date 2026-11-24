# Project Reach Out

A HOSA Mental Health Promotion campaign site on how isolation affects the developing
brain, and how connection protects it. Students reach it by scanning six QR codes
posted around school.

Live: https://project-reach-out.teenmoney.workers.dev

## What's on the site

| Page | What it does |
|---|---|
| `/` | Home: the idea, the risk and protective factors, the six QR pages, the experiment |
| `/fact/` | QR 1 "Did you know?": one sourced fact in 20 seconds |
| `/challenge/` | QR 2: a 30-second connection challenge |
| `/pulse/` | QR 3 "How connected are you?": three anonymous questions |
| `/listen/` | QR 4: the podcast clip |
| `/your-turn/` | QR 5: anonymous answers to "What helps you feel connected?", shown after approval |
| `/science/` | QR 6: the research, with APA references |
| `/game/` | Wire the Brain, an interactive game |
| `/experiment/` | The 24-hour connection experiment: check in, pick actions, check out |
| `/results/` | Before/after chart, survey results, scan counts, approved answers |
| `/posters/` | Printable sheet of the six QR codes |
| `/admin/` | Approve answers and download CSVs (needs the admin passphrase; not linked) |

## Privacy

No names, accounts, cookies, IP addresses or browser details are stored. Group
numbers stay hidden until at least 5 people have answered. Every page shows the 988
Suicide and Crisis Lifeline.

## Stack

Cloudflare Workers with static assets and a D1 database. Plain HTML, CSS and
JavaScript: no framework, no build step. Details in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it locally

Needs Node.js 20 or later.

```sh
npm install
echo "ADMIN_TOKEN=choose-a-long-random-passphrase" > .dev.vars
npx wrangler d1 migrations apply reach-out --local
npm run dev
```

`.dev.vars` holds the admin passphrase and is git-ignored; never commit it.

## Test

```sh
npm test        # unit and API tests against a local D1
npm run check   # dry-run deploy
```

## Deploy

```sh
npx wrangler login
npx wrangler secret put ADMIN_TOKEN   # once
npm run deploy                        # applies migrations, then deploys
```

## Before printing the QR codes

- Fill in the team, school, chapter, consultant and podcast link in
  `public/data/site.json`.
- The codes encode the site's address. If you move to a custom domain, do it before
  printing.
