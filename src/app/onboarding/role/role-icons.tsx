/**
 * Role-choice icons — inline SVG, stroke-only, no fills and no icon library.
 *
 * Both borrow the logo mark's language: a line that RISES to the right. The student
 * icon is that arrow literally, climbing over rungs; the mentor icon is the same energy
 * inverted into a signal radiating outward ("reach the people who've been there").
 *
 * `stroke="currentColor"` rather than a hardcoded hex, so the caller sets the color with
 * `text-gold` and the brand palette keeps its single source (see globals.css). Stroke
 * width stays 1.5 at a 48px box — heavier reads as an app icon rather than a drawn mark.
 */
const BASE = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

/** An arrow climbing over ascending rungs. */
export function StudentIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      {/* ground line + three rungs stepping up to the right */}
      <path d="M6 42h36" />
      <path d="M13 42V30" />
      <path d="M23 42V24" />
      <path d="M33 42V18" />
      {/* the arrow clears the rung tops rather than crossing them, so the two
          shapes stay legible at 48px instead of turning into hatching */}
      <path d="M10 28 40 8" />
      <path d="M31.5 8.6 40 8 39.4 16.5" />
    </svg>
  )
}

/** A beacon radiating outward. */
export function MentorIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...BASE} className={className}>
      {/* source */}
      <circle cx="24" cy="35" r="3.5" />
      <path d="M24 39.5V43" />
      {/* three arcs widening upward — each chord is shorter than its diameter, so
          every arc renders as a shallow sweep rather than a near-semicircle */}
      <path d="M15 28a12.7 12.7 0 0 1 18 0" />
      <path d="M9.5 22.5a20.5 20.5 0 0 1 29 0" />
      <path d="M4 17a28 28 0 0 1 40 0" />
    </svg>
  )
}
