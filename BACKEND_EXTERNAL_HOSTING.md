# Option 2: Host the Express/Supabase Backend Externally

This guide explains how to keep Firebase Hosting for the static website while hosting your Express/Supabase backend on a separate service.

## Why use Option 2

- Firebase Spark plan cannot deploy Cloud Functions for your backend.
- Hosting the frontend on Firebase and the API elsewhere keeps your bookings and Supabase data working.
- Your frontend will call the backend using `window.API_ORIGIN`.

## Recommended hosting providers

Choose one of these services:
- Railway: https://railway.app
- Render: https://render.com
- Fly.io: https://fly.io
- Deta: https://www.deta.sh
- DigitalOcean App Platform: https://www.digitalocean.com/products/app-platform

Railway and Render are easiest for Node.js + PostgreSQL.

## What to deploy

Deploy this repository or the Express backend code:
- `server.js`
- `package.json`
- `.env` (not committed to git)
- `uploads/` if you need file upload support locally

The backend listens on `PORT` and exposes routes under `/api/*`.

## Required environment variables

Set these values in your host service:

```env
DATABASE_URL="postgresql://postgres.wshqkwuizjgeetmsfyzt:iPfQ425CO2lSxYQw@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
SUPABASE_URL="https://wshqkwuizjgeetmsfyzt.supabase.co"
SUPABASE_KEY="sb_secret_jq3mZ1xE2y4alHkdg69kqQ_KjgAQOOO"
SUPABASE_STORAGE_BUCKET="profilePhoto"
JWT_SECRET="your_secure_secret_key_here_change_in_production"
PORT=3000
```

If your host uses different names, map them exactly.

## Deploying to Railway (example)

1. Sign in to Railway and create a new project.
2. Connect your GitHub repo or choose "Deploy from local".
3. Use the `server.js` repo and let Railway detect Node.
4. Set environment variables from above.
5. Deploy the project.
6. Railway will give you a public backend URL, for example:
   `https://my-zigzag-api.uprailway.app`

## Deploying to Render (example)

1. Sign in to Render and create a new Web Service.
2. Connect your GitHub repo.
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables from above.
6. Deploy and note the generated URL.

## Update your Firebase website to point to backend

In your Firebase-hosted HTML pages, update this snippet:

```html
<script>
  window.API_ORIGIN = 'https://your-backend-url.example.com';
</script>
```

Put it before the module scripts in:
- `index.html`
- `booking.html`
- `staff.html`

## Final step

1. Deploy your backend externally.
2. Update `window.API_ORIGIN` with the backend URL.
3. Run:

```powershell
firebase deploy --only hosting
```

Now the frontend will call the external backend at:
- `https://your-backend-url.example.com/api/...`

## Notes

- Firebase Hosting remains your static website host.
- Supabase remains the database and storage provider.
- The backend must be reachable from the browser.
- If your host provides HTTPS, use the HTTPS backend URL.

## Troubleshooting

- If the frontend still calls Firebase origin, make sure `window.API_ORIGIN` is set correctly.
- If the backend API returns CORS errors, enable CORS in `server.js`:
  `app.use(cors());`
- If the backend cannot connect to Supabase, verify `DATABASE_URL` and `SUPABASE_KEY`.
- If login or booking fails, open browser DevTools and check network requests to `/api`.
