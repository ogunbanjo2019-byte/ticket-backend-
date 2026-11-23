# Ticketly backend

Node.js 18+ API. Run `npm install && npm start`. Set `ALLOWED_ORIGINS` to the exact frontend origin and `TM_API_KEY` if live event discovery is wanted. Render deployment: Root Directory `backend`, Build Command `npm install`, Start Command `npm start`, Health Check `/api/health`.

See `SETUP-SUPABASE.md` for SMTP delivery, Supabase rate limits, Turnstile CAPTCHA, private ticket-file storage, Vercel/Render setup, and monitoring. Apply `supabase-schema.sql` in Supabase SQL Editor.
