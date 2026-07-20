import { ImageResponse } from 'next/og'

/**
 * The default share card, used by every route that doesn't supply its own.
 *
 * Drawn rather than shipped as a static PNG so the brand palette stays in one place
 * conceptually — and because a 1200x630 asset for every page is a maintenance burden the
 * moment copy changes.
 *
 * Fonts are the system stack on purpose: next/og cannot use next/font, so pulling
 * Fraunces in would mean fetching and embedding the .ttf at request time. That is a real
 * cost on a route whose entire job is to be scraped once per link, and a silent failure
 * mode if the fetch is slow. Weight and scale carry the brand here instead.
 */
export const alt = "MentorReach — Reach the people who've been there."
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#0e1826'
const PAPER = '#f5f4f0'
const GOLD = '#c89b3c'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 4, background: GOLD }} />
          <div
            style={{
              color: GOLD,
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            MentorReach
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            color: PAPER,
            fontSize: 82,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Reach the people who&#8217;ve been there.
        </div>

        <div style={{ display: 'flex', color: '#9aa5b4', fontSize: 28 }}>
          Book time with people who already have the job you want.
        </div>
      </div>
    ),
    size,
  )
}
