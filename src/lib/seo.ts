import 'server-only'
import { env } from './env'

/**
 * One definition of "where this site lives", shared by metadataBase, robots.ts,
 * sitemap.ts, canonical URLs, Open Graph tags and JSON-LD.
 *
 * It reads NEXT_PUBLIC_APP_URL, which is already the origin Stripe return URLs and every
 * email link are built from — so a wrong value fails loudly across the product rather
 * than silently emitting canonical tags that point at localhost.
 *
 * Trailing slashes are stripped because `${siteUrl()}/coaches` is how every caller builds
 * a path, and "https://mentorreach.com//coaches" is a different URL to a crawler.
 */
export function siteUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
}

/** Absolute URL for a path — crawlers and Open Graph both require absolute. */
export function absoluteUrl(path = '/'): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Every route tree that must never reach an index.
 *
 * Authentication already redirects strangers away from most of these, so this is the
 * second layer rather than the only one. It matters anyway: a URL can be indexed from an
 * external link without ever being successfully crawled, and `/style-guide` is genuinely
 * public with no auth in front of it at all.
 *
 * Used verbatim by robots.ts (as Disallow rules) so the two can't drift.
 */
export const PRIVATE_PATHS = [
  '/admin',
  '/ops',
  '/coach',
  '/sessions',
  '/notifications',
  '/onboarding',
  '/book',
  '/join',
  '/report',
  '/style-guide',
  '/api',
] as const

/**
 * Spread into a page's `metadata` to keep it out of search results.
 *
 * `nocache` and `noimageindex` are included because `noindex` alone still lets a crawler
 * retain a cached copy and index images from the page.
 */
export const NO_INDEX = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
} as const
