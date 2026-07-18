'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * The coach workspace shell: a persistent left sidebar of tabs + a content column, so a
 * coach can move between their home, sessions, availability, profile, payouts, and docs
 * without hunting for links. Applied to every /coach page via the coach layout.
 *
 * Onboarding is deliberately excluded — it's a full-screen guided wizard, so the shell
 * steps aside and renders the wizard edge-to-edge.
 */

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean }

const NAV: NavItem[] = [
  { href: '/coach', label: 'Home', exact: true, icon: <HomeIcon /> },
  { href: '/sessions', label: 'Sessions', icon: <CalendarIcon /> },
  { href: '/coach/availability', label: 'Availability', icon: <ClockIcon /> },
  { href: '/coach/setup', label: 'Profile & rates', icon: <UserIcon /> },
  { href: '/coach/payouts', label: 'Payouts', icon: <CardIcon /> },
  { href: '/coach/resources', label: 'Resources', icon: <BookIcon /> },
  { href: '/coach/handbook', label: 'Handbook', icon: <FileIcon /> },
]

export function CoachShell({ banner, children }: { banner: ReactNode; children: ReactNode }) {
  const pathname = usePathname()

  // The onboarding wizard owns the whole viewport — no sidebar.
  if (pathname?.startsWith('/coach/onboarding')) {
    return (
      <>
        {banner}
        {children}
      </>
    )
  }

  return (
    <>
      {banner}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:flex-row md:gap-10 md:px-6 md:py-10">
        <aside className="shrink-0 md:w-56">
          <nav className="sticky top-6">
            <p className="label-mono px-3 pb-2">Coach</p>
            <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : Boolean(pathname?.startsWith(item.href))
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-secondary font-medium text-ink'
                          : 'text-slate hover:bg-secondary/60 hover:text-ink'
                      }`}
                    >
                      <span className={active ? 'text-gold' : 'text-slate'}>{item.icon}</span>
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  )
}

/* Inline icons — kept local so the shell has no icon-library dependency. */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function HomeIcon() {
  return (
    <Svg>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Svg>
  )
}

function CalendarIcon() {
  return (
    <Svg>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </Svg>
  )
}

function ClockIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  )
}

function UserIcon() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </Svg>
  )
}

function CardIcon() {
  return (
    <Svg>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 9.5h19M6 15h4" />
    </Svg>
  )
}

function BookIcon() {
  return (
    <Svg>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
      <path d="M5 18a2 2 0 0 0 2 2h11" />
    </Svg>
  )
}

function FileIcon() {
  return (
    <Svg>
      <path d="M6 2h8l4 4v16H6V2Z" />
      <path d="M14 2v4h4M9 13h6M9 17h6" />
    </Svg>
  )
}
