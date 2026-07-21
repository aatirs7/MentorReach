import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { absoluteUrl, siteUrl } from '@/lib/seo'
import './globals.css'

/**
 * Spec §1 typography. next/font self-hosts these at build time: zero requests to
 * fonts.googleapis.com, no layout shift, and no GDPR exposure — which matters for a
 * platform handling minors' education data.
 *
 * Fraunces and Inter are variable fonts, so `weight` is omitted deliberately.
 * IBM Plex Mono is NOT variable — `weight` is mandatory there or the build throws.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

const TAGLINE = "Reach the people who've been there."
const DESCRIPTION =
  'Book one-to-one career mentoring with people who already have the job you want. ' +
  'Hand-picked mentors across finance, technology, engineering, cybersecurity and creative.'

export const metadata: Metadata = {
  /**
   * metadataBase is load-bearing, not boilerplate. Every relative Open Graph image,
   * canonical and alternate below is resolved against it; without it Next emits relative
   * URLs, which crawlers and link-preview scrapers both discard. Set it wrong and the
   * failure is silent — the tags render, they just point somewhere useless.
   */
  metadataBase: new URL(siteUrl()),
  title: {
    default: `MentorReach — ${TAGLINE}`,
    template: '%s · MentorReach',
  },
  description: DESCRIPTION,
  applicationName: 'MentorReach',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'MentorReach',
    title: `MentorReach — ${TAGLINE}`,
    description: DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `MentorReach — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  /**
   * Explicitly permissive at the root so the default is "index me", and the private
   * route trees opt out individually via NO_INDEX. Stating it here means a new public
   * page is indexable without anyone remembering to say so.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
         * Sitewide structured data. Organization establishes the brand as an entity (the
         * `@id` is what per-page graphs reference instead of repeating it), and WebSite
         * declares the site's own search endpoint.
         *
         * Static values only — this renders on every route, so anything requiring a query
         * would put a database round trip on the critical path of the entire app.
         */}
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              '@id': absoluteUrl('/#organization'),
              name: 'MentorReach',
              url: absoluteUrl('/'),
              logo: absoluteUrl('/logo-mentorreach.png'),
              slogan: TAGLINE,
              description: DESCRIPTION,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              '@id': absoluteUrl('/#website'),
              name: 'MentorReach',
              url: absoluteUrl('/'),
              publisher: { '@id': absoluteUrl('/#organization') },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: absoluteUrl('/mentors?industry={search_term_string}'),
                },
                'query-input': 'required name=search_term_string',
              },
            },
          ]}
        />
        {/*
         * ClerkProvider goes INSIDE <body>, not wrapping <html>. This changed in
         * Clerk Core 3; the old placement comes from Core 2 docs.
         */}
        <ClerkProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ClerkProvider>
      </body>
    </html>
  )
}
