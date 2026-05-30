# VibeZone Online Deployment

This backend is ready for Railway or Render. It must run as an ASGI app because chat, notifications, Socket.IO calls, and WebSockets need long-lived realtime connections.

## Required Services

- FastAPI host: Railway or Render
- PostgreSQL: Supabase PostgreSQL
- Media storage: Supabase Storage bucket named `vibezone-media`
- Expo app: development build for WebRTC calling

## Backend Environment Variables

Set these on Railway or Render:

```env
DATABASE_URL=postgresql://...
SECRET_KEY=generate-a-long-random-secret
CORS_ORIGINS=*
WEB_CONCURRENCY=1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=vibezone-media
SUPABASE_PUBLIC_BUCKET=true
```

Use `WEB_CONCURRENCY=1` until Socket.IO presence/call state is moved to Redis. Multiple workers without Redis can split users across processes.

## App Environment Variable

Set this before building the Expo development build:

```env
EXPO_PUBLIC_API_BASE_URL=https://vibezone-mwg7.onrender.com
```

The Android production app uses only `https://vibezone-mwg7.onrender.com`.
Do not add local backend fallback URLs to the mobile app.

## Railway

1. Push this repo to GitHub.
2. Create a Railway project from the repo.
3. Add the environment variables above.
4. Deploy. Railway will use `Dockerfile` and `railway.json`.
5. Copy the generated Railway domain into `EXPO_PUBLIC_API_BASE_URL`.

## Render

1. Push this repo to GitHub.
2. Create a new Blueprint or Docker Web Service.
3. Use `render.yaml` or select Docker manually.
4. Add the environment variables above.
5. Deploy and copy the Render URL into `EXPO_PUBLIC_API_BASE_URL`.

## Supabase

1. Create a Supabase project.
2. Copy the PostgreSQL connection string into `DATABASE_URL`.
3. Create a public Storage bucket named `vibezone-media`.
4. Copy the project URL into `SUPABASE_URL`.
5. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

Never put Supabase service role keys inside the React Native app.
