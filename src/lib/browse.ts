import 'server-only'
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { mentorAvailabilityRules, mentorOfferings, mentorProfiles, users } from '@/db/schema'
import { isMentorLive } from './mentor-publish'
import { mentorHasAvailability } from './scheduling'

/**
 * Spec §8 — browse.
 *
 * The "is this mentor live?" rule is applied HERE, once, so an unpublished mentor cannot
 * leak into a listing because someone forgot a WHERE clause. It mirrors isMentorLive() in
 * mentor-publish.ts: not suspended, AND either a seed/demo mentor OR a real mentor whose
 * DB-cheap publish requirements are met (photo, availability, Stripe payouts, handbook ack).
 * The ≥1-active-offering requirement is added by the offerings inner join below.
 */
export type MentorCard = {
  userId: string
  fullName: string | null
  headshotUrl: string | null
  isSeed: boolean
  industry: string
  currentTitle: string
  bio: string
  specialties: string[]
  startingPriceCents: number
  lengths: number[]
}

export type BrowseFilters = {
  industry?: string
  maxPriceCents?: number
  lengthMinutes?: number
}

/**
 * The DB-cheap half of isMentorLive(), as a SQL condition. Kept in lockstep with
 * mentor-publish.ts — bio/currentTitle/industry are NOT NULL columns so they're always
 * present, and the active-offering requirement comes from the offerings join.
 */
function liveMentorSql(): SQL {
  // A real mentor needs at least one native availability rule (§9 scheduler).
  const hasAvailability = sql`EXISTS (SELECT 1 FROM ${mentorAvailabilityRules} WHERE ${mentorAvailabilityRules.mentorId} = ${mentorProfiles.userId})`
  const realComplete = and(
    isNotNull(mentorProfiles.headshotUrl),
    hasAvailability,
    eq(mentorProfiles.stripePayoutsEnabled, true),
    isNotNull(mentorProfiles.handbookAckAt),
  )
  // biome-ignore lint: and()/or() are non-null here with fixed args.
  return and(ne(mentorProfiles.status, 'suspended'), or(eq(mentorProfiles.isSeed, true), realComplete))!
}

export async function listIndustries(): Promise<string[]> {
  // Only industries that have a browsable (live + offering) mentor, so the filter never
  // shows an empty category.
  const rows = await db
    .selectDistinct({ industry: mentorProfiles.industry })
    .from(mentorProfiles)
    .innerJoin(mentorOfferings, and(eq(mentorOfferings.mentorId, mentorProfiles.userId), eq(mentorOfferings.isActive, true)))
    .where(liveMentorSql())
    .orderBy(asc(mentorProfiles.industry))

  return rows.map((r) => r.industry)
}

export async function browseMentors(filters: BrowseFilters = {}): Promise<MentorCard[]> {
  /**
   * A mentor is only listed if they have at least one ACTIVE offering — a profile with no
   * bookable session is a dead end, and the card's "from $X" price has nothing to show.
   * The join makes that structural rather than a post-filter, and it supplies the
   * offering half of the live check.
   */
  const conditions = [liveMentorSql(), eq(mentorOfferings.isActive, true)]

  if (filters.industry) conditions.push(eq(mentorProfiles.industry, filters.industry))
  if (filters.lengthMinutes) conditions.push(eq(mentorOfferings.lengthMinutes, filters.lengthMinutes))
  if (filters.maxPriceCents) conditions.push(lte(mentorOfferings.priceCents, filters.maxPriceCents))

  const rows = await db
    .select({
      userId: mentorProfiles.userId,
      fullName: users.fullName,
      headshotUrl: mentorProfiles.headshotUrl,
      isSeed: mentorProfiles.isSeed,
      industry: mentorProfiles.industry,
      currentTitle: mentorProfiles.currentTitle,
      displayEmployerGenerally: mentorProfiles.displayEmployerGenerally,
      generalTitle: mentorProfiles.generalTitle,
      bio: mentorProfiles.bio,
      specialties: mentorProfiles.specialties,
      priceCents: mentorOfferings.priceCents,
      lengthMinutes: mentorOfferings.lengthMinutes,
    })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .innerJoin(mentorOfferings, eq(mentorOfferings.mentorId, mentorProfiles.userId))
    .where(and(...conditions))
    .orderBy(asc(mentorOfferings.priceCents))

  // One row per offering → collapse to one card per mentor, keeping the cheapest price
  // as the "from" and collecting the lengths that survived filtering.
  const byMentor = new Map<string, MentorCard>()

  for (const r of rows) {
    const existing = byMentor.get(r.userId)

    if (existing) {
      existing.startingPriceCents = Math.min(existing.startingPriceCents, r.priceCents)
      if (!existing.lengths.includes(r.lengthMinutes)) existing.lengths.push(r.lengthMinutes)
      continue
    }

    byMentor.set(r.userId, {
      userId: r.userId,
      fullName: r.fullName,
      headshotUrl: r.headshotUrl,
      isSeed: r.isSeed,
      industry: r.industry,
      // Respect the mentor's employer-visibility choice on the public card.
      currentTitle: r.displayEmployerGenerally && r.generalTitle ? r.generalTitle : r.currentTitle,
      bio: r.bio,
      specialties: r.specialties,
      startingPriceCents: r.priceCents,
      lengths: [r.lengthMinutes],
    })
  }

  return [...byMentor.values()]
    .map((c) => ({ ...c, lengths: c.lengths.sort((a, b) => a - b) }))
    .sort((a, b) => a.startingPriceCents - b.startingPriceCents)
}

/**
 * Just the ids and change dates of mentors that may be INDEXED, for src/app/sitemap.ts.
 *
 * Deliberately NOT browseMentors(): that fans out to users + offerings and collapses one
 * row per offering in JS to build a rendered card. A sitemap needs two columns, and
 * running the heavier query would put profile bios and prices on a path that only ever
 * emits URLs.
 *
 * SEED MENTORS ARE EXCLUDED, and this is the important part.
 *
 * liveMentorSql() deliberately treats a seed profile as live so the marketplace has
 * something to demo. "Visible on the site" and "safe to hand to a search engine" are not
 * the same question, though. Seed profiles are invented people carrying real employer
 * names, and the profile page attaches Person + Offer structured data — a machine-readable
 * assertion that Maya Rao is an analyst at Evercore. Indexed, those URLs outlive the rows:
 * delete the seed data and they become 404s, and until Google recrawls, fabricated people
 * stay associated with the brand.
 *
 * So the sitemap ships real mentors only. It is empty of mentors today (there are none
 * yet) and fills in on its own as each one publishes, which is what a dynamic sitemap is
 * for. The matching noindex lives in the profile page's generateMetadata.
 */
export async function sitemapMentors(): Promise<Array<{ userId: string; updatedAt: Date }>> {
  const rows = await db
    .selectDistinct({ userId: mentorProfiles.userId, updatedAt: mentorProfiles.updatedAt })
    .from(mentorProfiles)
    .innerJoin(
      mentorOfferings,
      and(eq(mentorOfferings.mentorId, mentorProfiles.userId), eq(mentorOfferings.isActive, true)),
    )
    .where(and(liveMentorSql(), eq(mentorProfiles.isSeed, false)))

  return rows
}

/**
 * A single mentor's public profile (§8). Returns null unless the mentor is LIVE — an
 * incomplete real mentor's page 404s rather than being viewable by URL, matching browse.
 */
export async function getPublicMentor(userId: string) {
  const profile = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, userId),
  })

  if (!profile) return null

  const [mentor, offerings] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.mentorOfferings.findMany({
      where: and(eq(mentorOfferings.mentorId, userId), eq(mentorOfferings.isActive, true)),
      orderBy: [asc(mentorOfferings.lengthMinutes)],
    }),
  ])

  if (!mentor) return null

  const live = isMentorLive({
    isSeed: profile.isSeed,
    status: profile.status,
    headshotUrl: profile.headshotUrl,
    currentTitle: profile.currentTitle,
    bio: profile.bio,
    hasActiveOffering: offerings.length > 0,
    hasAvailability: await mentorHasAvailability(userId),
    stripePayoutsEnabled: profile.stripePayoutsEnabled,
    handbookAckAt: profile.handbookAckAt,
  })

  if (!live) return null

  return { profile, mentor, offerings }
}

/**
 * The employers currently on the roster, for the homepage "Mentors from" strip.
 *
 * DERIVED FROM LIVE DATA, never hardcoded: a hardcoded list becomes a false claim the
 * moment a mentor leaves. If the roster empties, this returns nothing and the strip
 * disappears rather than lying.
 *
 * Employer is parsed out of `current_title` ("Analyst at Evercore" → "Evercore"), a
 * heuristic on free text — hence the conservative bail-outs below.
 */
export async function rosterEmployers(limit = 8): Promise<string[]> {
  const rows = await db
    .selectDistinct({ currentTitle: mentorProfiles.currentTitle })
    .from(mentorProfiles)
    .innerJoin(mentorOfferings, and(eq(mentorOfferings.mentorId, mentorProfiles.userId), eq(mentorOfferings.isActive, true)))
    .where(liveMentorSql())

  const seen = new Set<string>()
  const employers: string[] = []

  for (const r of rows) {
    const employer = employerFromTitle(r.currentTitle)
    if (!employer) continue

    const key = employer.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    employers.push(employer)
  }

  return employers.slice(0, limit)
}

/** "Senior Software Engineer at Stripe" → "Stripe". Null when we can't tell. */
export function employerFromTitle(title: string): string | null {
  const idx = title.toLowerCase().lastIndexOf(' at ')
  if (idx === -1) return null

  const employer = title.slice(idx + 4).trim()

  // Bail rather than print rubbish: an empty tail, or something long enough that it's
  // probably a sentence rather than a company name.
  if (!employer || employer.length > 40) return null

  return employer
}

export async function priceBounds(): Promise<{ minCents: number; maxCents: number }> {
  const [row] = await db
    .select({
      min: sql<number>`COALESCE(MIN(${mentorOfferings.priceCents}), 0)::int`,
      max: sql<number>`COALESCE(MAX(${mentorOfferings.priceCents}), 0)::int`,
    })
    .from(mentorOfferings)
    .innerJoin(mentorProfiles, eq(mentorProfiles.userId, mentorOfferings.mentorId))
    .where(and(liveMentorSql(), eq(mentorOfferings.isActive, true)))

  return { minCents: row?.min ?? 0, maxCents: row?.max ?? 0 }
}

/** Used by the sessions dashboard to name counterparties in bulk. */
export async function usersByIds(ids: string[]) {
  if (!ids.length) return []
  return db.query.users.findMany({ where: inArray(users.id, ids) })
}

export { gte }
