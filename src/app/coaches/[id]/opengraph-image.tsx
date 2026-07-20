import { ImageResponse } from 'next/og'
import { getPublicCoach } from '@/lib/browse'
import { formatPrice } from '@/lib/coach-schema'

/**
 * Per-coach share card. The profile is the link people actually paste into LinkedIn and
 * group chats, so this is the highest-traffic image on the site.
 *
 * It reuses getPublicCoach(), which returns null for anyone not live — so a suspended or
 * half-finished coach cannot have their name and rate rendered into an image that then
 * sits in a scraper's cache long after the page itself started 404ing.
 */
export const alt = 'Coach on MentorReach'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#0e1826'
const PAPER = '#f5f4f0'
const GOLD = '#c89b3c'
const MUTED = '#9aa5b4'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicCoach(id)

  const name = data?.coach.fullName ?? 'Coach'
  const title = data?.profile.currentTitle ?? ''
  const industry = data?.profile.industry ?? ''
  const cheapest = data?.offerings.length
    ? Math.min(...data.offerings.map((o) => o.priceCents))
    : null

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
          <div style={{ color: GOLD, fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>
            {industry || 'MentorReach'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
          <div style={{ display: 'flex', color: PAPER, fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>
            {name}
          </div>
          {title ? (
            <div style={{ display: 'flex', color: MUTED, fontSize: 34, lineHeight: 1.3 }}>{title}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: MUTED, fontSize: 26 }}>
            Book a session on MentorReach
          </div>
          {cheapest !== null ? (
            <div style={{ display: 'flex', color: GOLD, fontSize: 30 }}>
              from {formatPrice(cheapest)}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  )
}
