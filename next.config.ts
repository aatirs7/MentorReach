import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    /**
     * ⚠️ PLACEHOLDER HOSTS — REMOVE WHEN REAL ASSETS LAND.
     *
     * randomuser.me  demo coach portraits (seed data ONLY — enforced in
     *                src/lib/headshot.ts, which refuses to render these on a real
     *                profile regardless of this allowlist)
     * picsum.photos  the hero's editorial placeholder art. Redirects to
     *                fastly.picsum.photos, so both hosts are needed or next/image throws
     *                on the redirect.
     *
     * Real coach photos will be served from storage we control, at which point these all
     * come out and the allowlist gets the real bucket instead. Leaving them in production
     * once real coaches exist lets an arbitrary third party serve imagery onto our pages.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'randomuser.me' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
}

export default nextConfig
