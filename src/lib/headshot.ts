/**
 * The single place a coach's avatar is resolved.
 *
 * THE RULE THIS ENFORCES: placeholder faces are for SEED coaches only. A real coach's
 * profile must never render a generated face while the site tells students every coach
 * is "verified against their stated employer". A stock face on a supposedly-vetted
 * profile isn't a cosmetic slip, it's the vetting promise being false at the most
 * visible point on the page.
 *
 * It's enforced here rather than by remembering: even if a real profile somehow ends up
 * with a pravatar URL (pasted by a coach, copied from seed data, restored from a bad
 * backup), this function refuses it and falls back to initials. `isSeed` defaults to
 * false in the schema, so a real coach cannot become seed by omission either.
 *
 * Not 'server-only': used by client card components.
 */

/**
 * Hosts that serve stock/generated faces or imagery. Anything from one of these is a
 * placeholder by definition, whoever set it.
 *
 * ADD TO THIS LIST whenever a new placeholder source is introduced anywhere — the
 * guardrail below is only as good as this list, and a source that isn't here would sail
 * straight onto a real coach's profile.
 */
const PLACEHOLDER_HOSTS = [
  'randomuser.me',
  'i.pravatar.cc',
  'pravatar.cc',
  'picsum.photos',
  'fastly.picsum.photos',
  'placehold.co',
  'placekitten.com',
  'loremflickr.com',
]

export function isPlaceholderImage(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return PLACEHOLDER_HOSTS.includes(host)
  } catch {
    return false
  }
}

export type HeadshotSource =
  | { kind: 'image'; url: string }
  /** Render the initials circle. `reason` is for debugging, not for users. */
  | { kind: 'initials'; reason: 'none-set' | 'placeholder-on-real-profile' | 'invalid-url' }

export function resolveHeadshot(profile: {
  headshotUrl: string | null
  isSeed: boolean
}): HeadshotSource {
  if (!profile.headshotUrl) return { kind: 'initials', reason: 'none-set' }

  let parsed: URL
  try {
    parsed = new URL(profile.headshotUrl)
  } catch {
    return { kind: 'initials', reason: 'invalid-url' }
  }

  // No mixed content, and no javascript:/data: URLs reaching an <img src>.
  if (parsed.protocol !== 'https:') return { kind: 'initials', reason: 'invalid-url' }

  // THE GUARDRAIL. A real profile never renders a generated face, no matter who set it.
  if (!profile.isSeed && isPlaceholderImage(profile.headshotUrl)) {
    return { kind: 'initials', reason: 'placeholder-on-real-profile' }
  }

  return { kind: 'image', url: profile.headshotUrl }
}

/**
 * Placeholder portrait for a seed coach.
 *
 * `portrait` is an explicit randomuser.me path ("women/44"), chosen per demo persona
 * rather than hashed from an id. Two reasons:
 *
 *  - Consistency. randomuser.me returns actual headshots — plain background, face
 *    centred, shoulders up. A "random face" service returns holiday snaps and art shots,
 *    which read as unserious the moment faces are the first thing on the page.
 *  - Coherence. These personas are invented, so the portrait is authored alongside the
 *    rest of the persona. Deriving it from a hash produced obvious mismatches, which
 *    looks careless on a page whose whole claim is "these are real people".
 *
 * Still a placeholder, and still gated: randomuser.me is in PLACEHOLDER_HOSTS, so this
 * can only ever render on an is_seed profile.
 */
export function seedHeadshotUrl(portrait: string): string {
  return `https://randomuser.me/api/portraits/${portrait}.jpg`
}

export function initialOf(fullName: string | null): string {
  return (fullName?.trim()?.[0] ?? '?').toUpperCase()
}
