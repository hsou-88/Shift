# Cleaning Shift Booking

A serverless cleaning-shift booking app built for Cloudflare Pages Functions and D1. All interface text is in English.

## Booking rules

- Administrators set the booking date range, weekday choices, and daily capacity separately for new and current residents.
- Administrators maintain a list of new-resident room numbers. The server assigns those rooms to the new-resident group; all other rooms are current residents. Residents cannot select their own group.
- Spaces are counted independently by resident group and date. Administrators can choose different weekdays for the two groups to keep their booking days separate.
- Each room can book once. The database applies the relevant group-capacity check in the same SQL insert that creates the reservation.
- `/admin` is protected by an eight-hour signed, HTTP-only session. Sign in at `/admin-login.html` with `ADMIN_KEY`.
- Initial weekday defaults are Wednesday for new residents and Sunday for current residents. Administrators can change either selection.

## Deploy with Cloudflare's free plan

1. Create a Cloudflare account and an empty GitHub repository for this project. This working folder is not currently a Git repository. From PowerShell in this folder, run the following after replacing the repository URL with the one GitHub gives you:

   ```powershell
   git init
   git add .
   git commit -m "Prepare Cloudflare booking app"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   Keep `.dev.vars` out of Git; it is listed in `.gitignore`.
2. Install dependencies with `npm install`. In Cloudflare, create a D1 database named `cleaning-shift-booking`. Copy its database ID into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`, then commit and push the updated file.
3. Authenticate Wrangler with `npx wrangler login`.
4. Apply the schema to the remote database with `npm run db:apply:remote`.
5. In **Workers & Pages → Create application → Pages → Connect to Git**, select the GitHub repository. Use the `wrangler.toml` settings in the repository; the Pages output directory is `.`.
6. In the Pages project's **Settings → Variables and Secrets**, add `ADMIN_KEY` as a production secret. Use a randomly generated value of at least 32 characters. Never commit it to GitHub.
7. Disable preview deployments unless you configure a separate preview D1 database. Otherwise preview builds could share the production booking database.
8. Open the generated `*.pages.dev` URL. Residents use that URL; administrators add `/admin-login.html`.

The production site runs without a continuously running Node.js server. Pages serves the static files; `functions/api/` runs as serverless Functions; D1 stores the shared settings and bookings. The D1 binding is named `DB` in `wrangler.toml`.

The Cloudflare Free plan currently includes 100,000 Pages Functions/Workers requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day, and 5 GB of D1 storage. Static asset requests are free and unlimited. Free limits are hard limits: once exceeded, requests or database operations can fail. A custom domain may have a separate registration cost. Review [current Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/) before deployment.

## Local preview

Requirements: Node.js 22 or 24 and npm. First create the D1 database and replace its ID in `wrangler.toml` as described above.

Create a `.dev.vars` file in the project root (ignored by Git):

```text
ADMIN_KEY=use-a-random-secret-at-least-32-characters-long
```

Apply the schema to the local D1 database, then start the preview:

```sh
npm install
npm run db:apply:local
npm run dev
```

Wrangler uses local storage for D1 while developing. `npm run db:apply:remote` changes the Cloudflare database; use it only when intended.

## Resident identity

Room numbers in the administrator's new-resident list determine the booking group. The booking API prevents duplicate room bookings, but it does not verify that a visitor is the resident assigned to that room. Add resident authentication if that verification is required.
