import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * The coach -> mentor URL change, made survivable for search.
   *
   * /coaches was one of three URLs submitted to Google Search Console, and Google was
   * mid-crawl when the rename landed. Renaming without these would have turned a freshly
   * submitted URL into a 404 on a domain with no track record — the worst possible timing,
   * since a new property has no accumulated trust to absorb it.
   *
   * `permanent: true` emits a 308 (the modern 301): search engines transfer ranking
   * signals to the new URL and update their index, rather than treating it as a temporary
   * outage and holding the old one.
   *
   * `:path*` preserves everything after the prefix, so /coaches/<uuid> lands on the same
   * mentor's profile rather than dumping every deep link on the index page. That matters
   * for the profile URLs already in the sitemap.
   *
   * Keep these. They cost one config entry and they are the only thing standing between
   * an external link written today and a dead end.
   */
  async redirects() {
    return [
      { source: '/coaches', destination: '/mentors', permanent: true },
      { source: '/coaches/:path*', destination: '/mentors/:path*', permanent: true },
      { source: '/coach', destination: '/mentor', permanent: true },
      { source: '/coach/:path*', destination: '/mentor/:path*', permanent: true },
      { source: '/admin/coaches', destination: '/admin/mentors', permanent: true },
      { source: '/admin/coaches/:path*', destination: '/admin/mentors/:path*', permanent: true },
    ]
  },
  experimental: {
    // Coach headshot uploads go through a server action, so the default 1MB action body
    // limit is too small for a phone photo. Matches the 8MB cap enforced in lib/storage.ts.
    serverActions: { bodySizeLimit: '8mb' },
  },
  images: {
    /**
     * ⚠️ PLACEHOLDER HOSTS — REMOVE WHEN REAL ASSETS LAND.
     *
     * i.pravatar.cc  demo coach portraits (seed data only — enforced in
     *                src/lib/headshot.ts, which refuses to render these on a real
     *                profile regardless of this allowlist)
     * picsum.photos  the hero's editorial placeholder art
     *
     * Real coach photos will be served from storage we control, at which point both of
     * these come out and the allowlist gets the real bucket instead. Leaving them in
     * production once real coaches exist means an arbitrary third party can serve
     * imagery onto our pages.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      // Real coach headshots, uploaded to Vercel Blob. This one STAYS — it's our storage.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
}

export default nextConfig
