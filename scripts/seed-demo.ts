/**
 * Seed demo coaches so browse has something to show in a walkthrough.
 *
 *   npx tsx scripts/seed-demo.ts          # insert (idempotent)
 *   npx tsx scripts/seed-demo.ts --undo   # remove every seeded row
 *
 * SAFETY / HONESTY:
 * - Every seeded user's clerk_id starts with SEED_PREFIX, so this data is trivially
 *   identifiable and removable, and it can never collide with a real Clerk id.
 * - These accounts CANNOT sign in — no matching Clerk user exists. They exist only to
 *   populate browse.
 * - Photos are deliberately omitted. The card falls back to an initial avatar; putting
 *   real people's headshots on fake coaches would be misrepresentation, not seed data.
 * - --undo refuses to touch anything without the prefix.
 *
 * Builds its own DB client rather than importing src/db, which is 'server-only' and
 * throws outside the Next runtime.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { and, eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/db/schema'
import { coachOfferings, coachProfiles, users } from '../src/db/schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — check .env.local')

const db = drizzle({ client: neon(url), schema })

const SEED_PREFIX = 'seed_demo_'

type DemoCoach = {
  slug: string
  fullName: string
  email: string
  industry: string
  currentTitle: string
  bio: string
  linkedinUrl: string
  employerNote?: string
  referralCode: string
  offerings: Array<{ lengthMinutes: number; priceCents: number }>
}

const COACHES: DemoCoach[] = [
  {
    slug: 'maya-rao',
    fullName: 'Maya Rao',
    email: 'maya.rao@demo.trajectorycoaches.com',
    industry: 'Investment banking',
    currentTitle: 'Investment Banking Analyst at Evercore',
    bio: "I went through SA recruiting from a non-target and got there without a network, so I know exactly how opaque this process feels from the outside.\n\nI help with: reading a deal on your resume the way a banker will, the technical set that actually comes up in a first round, and how to network without sounding like a script. I'm blunt about whether your story is landing — that's the useful part.",
    linkedinUrl: 'https://www.linkedin.com/in/example-maya-rao',
    employerNote: 'Cannot discuss live deals or anything non-public.',
    referralCode: 'MRDEMO01',
    offerings: [
      { lengthMinutes: 30, priceCents: 7500 },
      { lengthMinutes: 60, priceCents: 13000 },
    ],
  },
  {
    slug: 'daniel-osei',
    fullName: 'Daniel Osei',
    email: 'daniel.osei@demo.trajectorycoaches.com',
    industry: 'Software engineering',
    currentTitle: 'Senior Software Engineer at Stripe',
    bio: "I've been on both sides of about 200 interview loops now, most recently as an interviewer at Stripe.\n\nWhat I'm actually useful for: figuring out why you're getting rejected after the onsite, system design when you've never designed a system, and deciding between offers. If your fundamentals are fine and something else is going wrong, I can usually find it in one session.",
    linkedinUrl: 'https://www.linkedin.com/in/example-daniel-osei',
    referralCode: 'DODEMO02',
    offerings: [
      { lengthMinutes: 30, priceCents: 6500 },
      { lengthMinutes: 45, priceCents: 9000 },
      { lengthMinutes: 60, priceCents: 11000 },
    ],
  },
  {
    slug: 'priya-venkatesan',
    fullName: 'Priya Venkatesan',
    email: 'priya.v@demo.trajectorycoaches.com',
    industry: 'Consulting',
    currentTitle: 'Engagement Manager at McKinsey',
    bio: "Six years at McKinsey, and I've interviewed well over a hundred candidates.\n\nCase prep is the obvious one, but honestly most people who don't make it aren't failing the case — they're failing the personal experience interview and don't know it. I'll run a real case at real pace and tell you which of the two is your problem.",
    linkedinUrl: 'https://www.linkedin.com/in/example-priya-venkatesan',
    employerNote: 'Views are my own; nothing client-specific.',
    referralCode: 'PVDEMO03',
    offerings: [
      { lengthMinutes: 45, priceCents: 11000 },
      { lengthMinutes: 60, priceCents: 14000 },
    ],
  },
  {
    slug: 'jordan-whitfield',
    fullName: 'Jordan Whitfield',
    email: 'jordan.w@demo.trajectorycoaches.com',
    industry: 'Product management',
    currentTitle: 'Group Product Manager at Figma',
    bio: "I switched into PM from design, so I'm a good person to talk to if you don't have the 'standard' background and are wondering whether that's fatal. It isn't, usually.\n\nI help with breaking into APM programs, PM interview loops, and the thing nobody tells you: how to talk about work you did on a team without either overclaiming or disappearing from your own story.",
    linkedinUrl: 'https://www.linkedin.com/in/example-jordan-whitfield',
    referralCode: 'JWDEMO04',
    offerings: [
      { lengthMinutes: 30, priceCents: 7000 },
      { lengthMinutes: 60, priceCents: 12500 },
    ],
  },
  {
    slug: 'aisha-mensah',
    fullName: 'Aisha Mensah',
    email: 'aisha.mensah@demo.trajectorycoaches.com',
    industry: 'Medicine',
    currentTitle: 'Resident Physician, Internal Medicine at Johns Hopkins',
    bio: "I applied to med school twice. The second time worked, and the difference wasn't my MCAT.\n\nI help pre-meds with the parts that actually move the needle: what your personal statement is really saying, how to talk about a gap year or a reapplication without apologizing for it, and whether the clinical experience you have is the clinical experience they want.",
    linkedinUrl: 'https://www.linkedin.com/in/example-aisha-mensah',
    referralCode: 'AMDEMO05',
    offerings: [
      { lengthMinutes: 30, priceCents: 5500 },
      { lengthMinutes: 45, priceCents: 8000 },
    ],
  },
  {
    slug: 'tom-brennan',
    fullName: 'Tom Brennan',
    email: 'tom.brennan@demo.trajectorycoaches.com',
    industry: 'Law',
    currentTitle: 'Associate at Cravath',
    bio: "Cravath associate, and I sat on my law school's admissions committee as a student reader.\n\nUseful for: whether your softs are actually competitive at the schools you're targeting, OCI and what firms are really screening for, and the honest version of the biglaw tradeoff before you commit to it rather than after.",
    linkedinUrl: 'https://www.linkedin.com/in/example-tom-brennan',
    employerNote: 'Nothing client- or matter-specific.',
    referralCode: 'TBDEMO06',
    offerings: [
      { lengthMinutes: 30, priceCents: 8000 },
      { lengthMinutes: 60, priceCents: 15000 },
    ],
  },
]

async function undo() {
  const seeded = await db.query.users.findMany({
    where: like(users.clerkId, `${SEED_PREFIX}%`),
  })

  if (!seeded.length) {
    console.log('No seeded rows found. Nothing to remove.')
    return
  }

  for (const u of seeded) {
    // Belt and braces: never delete anything without the prefix, even if the query above
    // were somehow wrong.
    if (!u.clerkId.startsWith(SEED_PREFIX)) continue

    await db.delete(coachOfferings).where(eq(coachOfferings.coachId, u.id))
    await db.delete(coachProfiles).where(eq(coachProfiles.userId, u.id))
    await db.delete(users).where(and(eq(users.id, u.id), like(users.clerkId, `${SEED_PREFIX}%`)))
  }

  console.log(`Removed ${seeded.length} seeded coaches.`)
}

async function seed() {
  for (const c of COACHES) {
    const clerkId = `${SEED_PREFIX}${c.slug}`

    const [user] = await db
      .insert(users)
      .values({ clerkId, role: 'coach', email: c.email, fullName: c.fullName })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { email: c.email, fullName: c.fullName, role: 'coach' },
      })
      .returning()

    await db
      .insert(coachProfiles)
      .values({
        userId: user.id,
        industry: c.industry,
        currentTitle: c.currentTitle,
        bio: c.bio,
        linkedinUrl: c.linkedinUrl,
        employerNote: c.employerNote ?? null,
        referralCode: c.referralCode,
        // Demo coaches are pre-approved so browse has something in it. Real coaches
        // still default to 'pending' — this bypasses nothing in the app itself.
        status: 'approved',
        approvedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: coachProfiles.userId,
        set: {
          industry: c.industry,
          currentTitle: c.currentTitle,
          bio: c.bio,
          linkedinUrl: c.linkedinUrl,
          status: 'approved',
        },
      })

    for (const o of c.offerings) {
      await db
        .insert(coachOfferings)
        .values({ coachId: user.id, lengthMinutes: o.lengthMinutes, priceCents: o.priceCents })
        .onConflictDoUpdate({
          target: [coachOfferings.coachId, coachOfferings.lengthMinutes],
          set: { priceCents: o.priceCents, isActive: true },
        })
    }

    console.log(`  ✓ ${c.fullName} — ${c.industry}`)
  }

  console.log(`\nSeeded ${COACHES.length} demo coaches.`)
  console.log(`Remove them any time with:  npx tsx scripts/seed-demo.ts --undo`)
}

const main = process.argv.includes('--undo') ? undo : seed

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
