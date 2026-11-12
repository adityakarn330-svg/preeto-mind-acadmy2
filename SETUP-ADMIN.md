# Admin dashboard setup (about 10 minutes, free)

Visitors fill a form on the website. The enquiry is saved in a Supabase database and a copy is emailed to preetomindacademy@gmail.com. You see everything on `/admin`.

## 1. Create the database (Supabase)
1. Sign up at supabase.com (free), click **New project**, choose a name and a strong database password, and wait for it to finish.
2. Open **SQL Editor -> New query**, paste the contents of `db/setup.sql`, and click **Run**.
3. Open **Project Settings -> API**. Copy the **Project URL** and the **service_role** key.
   The service_role key is a secret. Never put it in a website file, GitHub or a chat.

## 2. Connect it to Vercel
In Vercel open your project -> **Settings -> Environment Variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_SERVICE_KEY` | the service_role key |
| `ADMIN_PASSWORD` | a long password only you know |

Then go to **Deployments -> Redeploy** so the new values are used.

## 3. Use it
- Open `https://YOUR-SITE.vercel.app/admin` and log in with ADMIN_PASSWORD.
- **Enquiries / Team:** change the status, add private notes, message the parent on WhatsApp, download a CSV.
- **Reviews:** a review appears on the Testimonials page only after you click **Publish**.
- The page refreshes every 30 seconds, and the tab title shows how many items are new.

## Notes
- If the database is not connected, the forms still email you, so nothing is lost.
- Change ADMIN_PASSWORD in Vercel (and redeploy) whenever you want to lock out an old password.
