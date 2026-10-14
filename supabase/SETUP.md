# Supabase golf log setup

The site remains hosted on GitHub Pages. Supabase stores the rounds, permits public reads, and restricts changes to user IDs explicitly added to `golf_log_admins`. The browser uses only the Supabase project URL and publishable anon key; never put a service-role or secret key in the site.

## Create the project

1. Create a Supabase project.
2. In its SQL Editor, run [`schema.sql`](./schema.sql).
   If the project already ran an earlier version of `schema.sql`, do not run that original file again. Run [`friends-migration.sql`](./friends-migration.sql) if it has not yet been applied, then [`player-name-migration.sql`](./player-name-migration.sql) if it has not yet been applied. Run [`course-configuration-migration.sql`](./course-configuration-migration.sql) to add course pars and nine-hole segment support, then [`course-image-migration.sql`](./course-image-migration.sql) to enable course watermark uploads. Run [`course-notes-migration.sql`](./course-notes-migration.sql) after it to enable course ratings, notes, and hole photos. Existing rounds are preserved and default to the front nine.
3. In Project Settings > API, copy the project URL and publishable anon key into [`public/config.json`](../public/config.json). These values are designed for browser use; the SQL policies enforce access.
4. Create your user from the Supabase dashboard with a password. Password sign-in does not require email delivery or redirect URL configuration.
5. Add that user's UUID to the admin allow-list in SQL Editor:

   ```sql
   insert into public.golf_log_admins (user_id)
   values ('YOUR-AUTH-USER-UUID');
   ```

   Creating a Supabase account alone does not grant permission to manage rounds; the UUID must also be present in `golf_log_admins`.

## Import existing rounds

Open the Golf Log page and sign in with the existing account's email and password. Use **Import rounds** to select either the original 18Birdies JSON export or the sanitized `scripts/data/golf-rounds.json` file. The app reads the export locally and sends only the account display name and round date, course, calculated score, and hole scores to Supabase; email, account IDs, contacts, feed, and chat data are not uploaded. Names and scores are public.

To add players, edit a round or create one and enter scores hole-by-hole in the scorecard grid. Add one scorecard per player; existing player names are suggested while typing. Leave unrecorded holes blank. Each player's total is calculated from recorded hole scores. Use the course dropdown above the rounds to filter past rounds by course.

Open **Course Details & Stats** from the Golf Log to review scoring statistics. Open **Notes & Course Config** from Course Details or any round to configure 9 or 18 hole pars using the hole-by-hole grid, including adding a course if none exists yet. The Notes & Course Config page also shows public course ratings, general notes, and hole-by-hole notes and photos. Each signed-in golf admin can maintain one rating per course; all golf admins can add or remove shared notes and upload or replace one photo per hole. Authorized admins can also upload an optional JPEG, PNG, or WebP course image (up to 5 MB) for a faint scorecard watermark. Watermark opacity is adjustable per course from 3% to 50%, and horizontal and vertical framing controls set which part of the image remains visible across the round card. If the course-image migration was already applied, run the updated [`course-image-migration.sql`](./course-image-migration.sql) again to add the image framing settings and ensure the opacity limit is 50%. Course images are publicly readable with the scorecards; only authorized admins can upload or change them. A nine-hole round can be marked as front or back nine; existing rounds and imported nine-hole rounds default to the front nine until edited.

Imported scorecards for the same date and course are combined when their scorecard lengths and nine-hole segments match. If the same player is imported again for that round, the newly imported scorecard replaces their previous one. If an import fails part-way through, selecting the file again safely retries it.

Supabase is the live source of truth; the generated JSON stays outside the website's deployed public assets and is only needed as an import file.
