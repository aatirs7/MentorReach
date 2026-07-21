# Changing a legal document

Any edit to a file in `src/content/legal/` needs this procedure. `npm test` fails if you
skip it, on purpose.

## Why the ceremony

An acceptance row records **a version and a hash**. The version says *which* document; the
hash says *what it said*. Edit a document without bumping its version and every prior
signature silently starts pointing at text nobody ever saw — and nothing in the system can
tell, because the version it references still exists.

The hash lock in `src/lib/legal.test.ts` is what makes that impossible to do by accident.

## The procedure

1. **Archive the current version** before editing:

   ```
   src/content/legal/archive/<key>/<old-version>.md
   ```

   e.g. `src/content/legal/archive/mentor_agreement/1.0.0.md`. Someone who signed 1.0.0 is
   entitled to see 1.0.0, not whatever it became.

2. **Edit the document**, then **bump `version`** in its frontmatter. Semver:
   - **patch** — typos, formatting, nothing that changes meaning
   - **minor** — clarification, new non-onerous detail
   - **major** — anything that changes what someone agreed to

3. **Update `effective_date`** in the frontmatter.

4. **Run `npm test`.** It fails with the old hash and the new one. Update **both** the
   version and the hash in the `LOCKED` table in `src/lib/legal.test.ts`.

   Do **not** just paste the new hash in while leaving the version alone. That is the
   exact failure the lock exists to catch.

5. Commit the archive copy, the edited document, and the updated lock together.

## What a bump does to people

**Mentor Agreement or Mentor Handbook** — every mentor who signed the previous version is
**unpublished immediately**. `isMentorLive()` requires a signature at the *current*
version, and `liveMentorSql()` mirrors that, so they disappear from browse until they sign
again. Their profile data is untouched; `/mentor/agreement` shows a banner explaining what
happened and the checklist puts re-signing at the top.

This is deliberate. A profile is live on the strength of an agreement; if the agreement
changed, so did the basis for being live.

**Terms or Privacy Policy** — no one is blocked. Existing acceptances simply show as *out
of date* in `/admin/agreements`.

## Before launch: fill the placeholders

The documents still contain `[LEGAL ENTITY NAME]`, `[STATE]`, `[SUPPORT EMAIL]`,
`[MAILING ADDRESS]`, `[COUNTY, STATE]`, and two clauses marked for counsel. A dev-only
banner lists them on every `/legal/*` page; it never renders in production.

**Do this before the founding mentors sign.** Filling them is a version bump, and a bump
after they have signed unpublishes all of them until they sign again. Before anyone signs,
it costs nothing.
