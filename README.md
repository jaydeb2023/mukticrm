# Mukti CRM

Full-featured CRM for **MuktiFresh** (e-commerce vegetables/fish/meat) and **Mukti Cloud Kitchen** with offline market sales tracking.

## Features

- ✅ 6 role system: Super Admin, Fresh Admin, Kitchen Admin, Fresh Staff, Kitchen Staff, Market Agent
- ✅ MuktiFresh CRM: Leads, Customers, Complaints, Call Logs, WhatsApp drafts
- ✅ Cloud Kitchen: Live order board (realtime), Leads, Complaints, Call Logs
- ✅ Offline Market: Morning dispatch → Voice/text sales entry → Evening return → Discrepancy detection
- ✅ AI features: Paste any text → Claude extracts leads/customers | AI drafts WhatsApp messages
- ✅ Voice input in Bengali, Hindi, English (Web Speech API)
- ✅ WhatsApp one-tap: opens wa.me with pre-filled message, no API needed
- ✅ Excel/CSV bulk import
- ✅ 100% mobile responsive

## Tech Stack (all free)

| Tool | Free tier |
|------|-----------|
| Next.js 15 | Free |
| Supabase | 500MB DB, 50K users/month |
| Vercel | Unlimited deployments |
| Claude AI (Haiku) | ~₹0.001 per message |
| Web Speech API | Browser built-in, free |

---

## Step 1 — Set up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `mukti-crm`, choose any password, region: **Southeast Asia (Singapore)**
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** → paste the entire contents of `supabase_schema.sql` → click **Run**
5. Go to **Settings → API**
6. Copy:
   - **Project URL** → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Enable Realtime (for kitchen orders)
Go to **Database → Replication** → enable these tables:
- `kitchen_orders`
- `market_dispatches`
- `market_sales`
- `complaints`

---

## Step 2 — Get Anthropic API key (optional, for AI features)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create account → **API Keys → Create Key**
3. Copy key → paste into `.env.local` as `ANTHROPIC_API_KEY`
4. Add ₹500 credits (~50,000 messages — lasts months for this use case)

> **Without the key**: AI paste parsing falls back to regex, WhatsApp messages use pre-written templates. Everything else works fine.

---

## Step 3 — Run locally

```bash
# Clone the repo
git clone https://github.com/jaydeb2023/my-crm.git
cd my-crm

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your Supabase URL and key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**First login:**
- Email: `admin@muktifresh.com`
- Password: `mukti@2024`
- Role: Super Admin

---

## Step 4 — Deploy to Vercel (free, 3 minutes)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
3. In **Environment Variables**, add:
   ```
   NEXT_PUBLIC_SUPABASE_URL = your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
   ANTHROPIC_API_KEY = your-anthropic-key
   ```
4. Click **Deploy** — live in ~2 minutes
5. Your CRM is live at `https://your-project.vercel.app`

---

## Adding your team

After first login as Super Admin:
1. Go to **Team** in sidebar
2. Click **+ Add Team Member**
3. Set their role:
   - `fresh_staff` → can see MuktiFresh leads/customers/calls
   - `kitchen_staff` → can see kitchen orders/complaints
   - `market_agent` → can see dispatch, enter sales by voice/text

---

## Importing existing customer data

### Option A — Excel/CSV
1. Go to **Leads** or **Customers** → **Excel Upload**
2. Headers the system recognises: `name`, `phone`, `email`, `address`, `area`, `city`, `flat no`, `complex`, `pin code`
3. Extra columns are ignored — import up to 1 lakh rows

### Option B — Paste any text (AI)
1. Go to **Leads** → **Paste / AI Import**
2. Paste WhatsApp chat, email list, anything
3. AI extracts names + phones automatically

### Option C — Manual
1. Go to **Customers** → **+ Add Customer**
2. Fill the form

---

## Market module — daily workflow

**Morning (admin/warehouse):**
1. Go to **Dispatch** → Create Morning Dispatch
2. Select market + agent + products with quantities
3. Save — stock is deducted automatically

**During market (agent):**
1. Go to **Add Sales** on mobile
2. Tap 🎤 to speak: *"Tomato 5 kilo 20 rupee"* or *"টমেটো পাঁচ কেজি বিশ টাকা"*
3. Or type manually
4. Save after each batch of sales

**Evening (agent/admin):**
1. Go to **Market Dashboard**
2. Click **Settle Evening Return** on the dispatch
3. System auto-calculates: Sent − Sold − Returned = Discrepancy
4. If discrepancy > ₹50 → flagged as RED on dashboard
5. Owner sees instant alert

---

## WhatsApp workflow

1. Go to **WhatsApp** in sidebar
2. Search and select a customer
3. Choose message type + language (Bengali/Hindi/Hinglish/English)
4. Click **Generate AI Message** → edit draft
5. Click **Open in WhatsApp** → WhatsApp opens with message pre-filled
6. You tap Send — no API needed, no cost

---

## Database backup

Supabase free tier includes:
- Daily automated backups (7 days retention)
- Manual backup: **Database → Backups → Download**

---

## Troubleshooting

**Login not working?**
- Check Supabase URL and key in `.env.local`
- Make sure you ran the full SQL schema
- Check the `users` table has the seed admin row

**Voice input not working?**
- Must be HTTPS (works on Vercel, not on http://localhost)
- Chrome/Edge recommended for best Speech API support
- Allow microphone permission when browser asks

**Realtime orders not updating?**
- Enable Realtime in Supabase → Database → Replication

**AI parse not working?**
- Check `ANTHROPIC_API_KEY` in Vercel environment variables
- Falls back to regex parsing automatically if key missing
