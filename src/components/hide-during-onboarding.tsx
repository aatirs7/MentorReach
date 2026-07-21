'use client'

import { usePathname } from 'next/navigation'

/**
 * Hides its children on the student onboarding pages (/onboarding/*).
 *
 * A brand-new account has no sessions and no notifications, so those links point at
 * empty pages and compete with the one decision the page is asking for. The logo and
 * the avatar stay — the user still needs to know where they are and how to sign out.
 *
 * A CLIENT component purely to read the pathname: SiteHeader is a server component
 * doing auth + DB work, and there is no request pathname available to it in Next 16
 * without threading a header through src/proxy.ts. This is the smaller change, and it
 * costs nothing — the wrapped links are already rendered markup either way.
 *
 * Scoped by prefix rather than an exact path so the survey step behaves like the role
 * step; both are pre-completion states where the same reasoning holds. /mentor/onboarding
 * is deliberately NOT matched: it has its own shell.
 */
export function HideDuringOnboarding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname?.startsWith('/onboarding')) return null

  return <>{children}</>
}
