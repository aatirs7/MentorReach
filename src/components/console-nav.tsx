'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Shared nav for the founder console — the same tabs on every admin and ops page, so the
 * two stop feeling like separate areas. Rendered by both the /admin and /ops layouts.
 */
const ITEMS = [
  // Order requested by the founders; Task Board sits centrally. Dashboard leads as the
  // console home (it was the one tab not named in the request). `exact` on /ops keeps it
  // from lighting up for /ops/applications and /ops/expenses, which share the prefix.
  { href: '/ops/applications', label: 'Applications' },
  { href: '/admin/mentors', label: 'Mentors' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/users', label: 'Accounts' },
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/ops/expenses', label: 'Expenses' },
  { href: '/ops', label: 'Task Board', exact: true },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/agreements', label: 'Agreements' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/legal', label: 'Legal' },
  // LLC setup is hidden from the nav for now but still reachable at /ops/llc — the page
  // and its gate are untouched, so re-adding the tab is a one-line change here.
  // { href: '/ops/llc', label: 'LLC setup' },
]

export function ConsoleNav() {
  const pathname = usePathname()

  /*
   * The scroll container and the centering live on DIFFERENT elements on purpose.
   * `justify-center` directly on an `overflow-x-auto` flex row centers by overflowing
   * BOTH edges, and the leading items then can't be scrolled back to. An inner `w-fit`
   * row with `mx-auto` centers while it fits and, once it's wider than the container,
   * the auto margins collapse to zero and normal scrolling takes over.
   */
  return (
    <div className="-mb-px overflow-x-auto">
      <nav className="mx-auto flex w-fit gap-1">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                active
                  ? 'border-gold font-medium text-ink'
                  : 'border-transparent text-slate hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
