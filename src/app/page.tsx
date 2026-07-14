import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getRole } from '@/lib/auth/require-role'

/**
 * Phase 0 placeholder. The real homepage is a Phase 1 build (full brand, editorial
 * layout) — this exists so the deploy has something to render and so brand + auth
 * wiring is visible end-to-end.
 */
export default async function Home() {
  const role = await getRole()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <p className="label-mono">Trajectory Coaching</p>
      <h1 className="mt-4 text-5xl leading-tight">Own your trajectory.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Coaching from people who already have the job you want.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {role ? (
          <p className="text-sm text-slate">
            Signed in as <span className="font-mono uppercase">{role}</span>.
          </p>
        ) : (
          <>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
