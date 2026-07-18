import { eq } from 'drizzle-orm'
import { stopViewAsCoach } from '../admin/coaches/view-as-actions'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { users } from '@/db/schema'
import { ensureUser } from '@/lib/auth/ensure-user'
import { readViewAsCoachId } from '@/lib/auth/view-as'

/**
 * Coach area shell. Its only job is the "viewing as coach" banner: when an admin is
 * previewing a coach read-only (src/lib/auth/view-as.ts), every /coach page shows a bar
 * with an Exit control. For everyone else it renders nothing extra.
 */
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const banner = await viewAsBanner()

  return (
    <>
      {banner}
      {children}
    </>
  )
}

async function viewAsBanner() {
  const user = await ensureUser()
  if (!user || user.role !== 'admin') return null

  const targetId = await readViewAsCoachId()
  if (!targetId) return null

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { fullName: true, email: true },
  })
  const name = target?.fullName ?? target?.email ?? 'this coach'

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-ink px-6 py-2.5 text-center text-sm text-paper">
      <span>
        Viewing as <span className="font-medium">{name}</span> — read only. Changes are disabled.
      </span>
      <form action={stopViewAsCoach}>
        <Button type="submit" size="sm" variant="secondary">
          Exit coach view
        </Button>
      </form>
    </div>
  )
}
