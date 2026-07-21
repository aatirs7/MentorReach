import { eq } from 'drizzle-orm'
import { stopViewAsMentor } from '../admin/mentors/view-as-actions'
import { MentorShell } from '@/components/mentor-shell'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { users } from '@/db/schema'
import { ensureUser } from '@/lib/auth/ensure-user'
import { readViewAsMentorId } from '@/lib/auth/view-as'

/**
 * Mentor area shell. Wraps every /mentor page in the sidebar workspace (src/components/
 * mentor-shell.tsx) and, when an admin is previewing a mentor read-only
 * (src/lib/auth/view-as.ts), surfaces the "viewing as mentor" banner with an Exit control.
 * The banner is computed here (it needs the DB) and handed to the client shell to render.
 */
export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const banner = await viewAsBanner()

  return <MentorShell banner={banner}>{children}</MentorShell>
}

async function viewAsBanner() {
  const user = await ensureUser()
  if (!user || user.role !== 'admin') return null

  const targetId = await readViewAsMentorId()
  if (!targetId) return null

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { fullName: true, email: true },
  })
  const name = target?.fullName ?? target?.email ?? 'this mentor'

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-ink px-6 py-2.5 text-center text-sm text-paper">
      <span>
        Viewing as <span className="font-medium">{name}</span> (read only). Changes are disabled.
      </span>
      <form action={stopViewAsMentor}>
        <Button type="submit" size="sm" variant="secondary">
          Exit mentor view
        </Button>
      </form>
    </div>
  )
}
