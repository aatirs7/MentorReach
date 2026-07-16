import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
