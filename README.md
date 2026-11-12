# PreetoMind Academy Website (prototype)

* `site/` is the complete 13-page responsive website. Open `site/index.html` in a browser, or host the folder on any static host.
* `GOOGLE-SITES-GUIDE.md` explains how to rebuild it in Google Sites (setup, the form, SEO limitations, and a placeholder checklist).
* `src/` contains the generator. Add verified contact details and the form endpoint in `src/core.py` (`CONFIG`), then run `python3 src/build.py` to regenerate `site/`.

Yellow **[placeholders]** mark details the founder must supply or verify. No qualifications, awards, testimonials or prices have been invented.

## Forms

The Admission Enquiry and Team Application forms post to FormSubmit (`CONFIG["form_endpoint"]` in `src/core.py`) and are emailed to preetomindacademy@gmail.com. Activate once by clicking the link FormSubmit sends to that inbox after the first submission. To change the destination, edit `form_endpoint` and rebuild.

## Student portal

Run `db/setup.sql` first if the existing `submissions` table is not already present, then run `db/student-portal.sql` in the same Supabase project. Keep `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `ADMIN_PASSWORD` configured in Vercel, and add `STUDENT_SESSION_SECRET` as a high-entropy random value for every deployed environment. Redeploy after changing variables. The student portal is intended for HTTPS Vercel hosting because its login cookie is Secure. After a manual UPI or bank payment, use `/admin-students.html` to assign a batch, create the Student ID and password, and add weekly reports. Students sign in at `/student-login.html` and view their private reports at `/student-dashboard.html`.
