import { redirect } from 'next/navigation'
import { getMySurvey } from './actions'
import { SurveyForm } from './survey-form'
import { requireUser } from '@/lib/auth/guards'

export const metadata = { title: 'A few questions' }

/**
 * Spec §7 — the mandatory student survey. Hard rule §2.3 gates booking on it.
 *
 * The page is a bare shell: SurveyForm is a full-bleed split layout that owns its own
 * heading and progress in the left panel, so a header here would just be a second title
 * competing with it.
 */
export default async function SurveyPage() {
  const user = await requireUser()

  if (user.role === 'coach') redirect('/coach')
  if (user.role === 'admin') redirect('/admin')

  const existing = await getMySurvey()

  return (
    <SurveyForm
      existing={
        existing
          ? {
              educationLevel: existing.educationLevel,
              gradeYear: existing.gradeYear,
              school: existing.school,
              major: existing.major,
              careerInterest: existing.careerInterest,
              target: existing.target,
              pathCertainty: existing.pathCertainty,
              priorExperience: existing.priorExperience,
              helpWith: existing.helpWith,
              helpWithOther: existing.helpWithOther,
              heardFrom: existing.heardFrom,
            }
          : null
      }
    />
  )
}
