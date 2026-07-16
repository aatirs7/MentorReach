import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Coach Handbook',
  description:
    'How we expect coaches to operate on Trajectory. Completing onboarding means you agree to these standards.',
}

/**
 * Public, no login — an invited coach reads this before signing up, and the onboarding
 * checklist links here for the required acknowledgment. Authored in the site's type
 * system rather than parsed from markdown so it uses the real heading/label styles.
 */
export default function CoachHandbookPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-line/15 bg-sand">
        <div className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
          <p className="label-mono">For coaches</p>
          <h1 className="text-section mt-3">Coach Handbook</h1>
          <p className="mx-auto mt-4 max-w-prose leading-relaxed text-slate">
            How we expect coaches to operate on Trajectory. Completing onboarding means you
            agree to these standards. Read it once. It is short on purpose.
          </p>
        </div>
      </section>

      <article className="mx-auto w-full max-w-2xl px-6 py-16">
        <Block title="What we are">
          <P>
            Trajectory connects students with people who already have the job or seat they are
            aiming for. Students come here for honest, specific, useful conversations. Not
            motivation, not fluff, not a sales pitch. Your value is that you did the thing they
            are trying to do, and you will tell them the truth about it.
          </P>
          <P>Everything below protects that.</P>
        </Block>

        <Block title="Before a session">
          <List
            items={[
              'Read the student’s survey and goals before you join. You have their year, field, and what they asked for help with. Do not make them repeat it.',
              'Be on time. Join at the scheduled minute, not five past.',
              'If you cannot make it, cancel or reschedule at least 24 hours ahead so the student is not left waiting. See cancellations below.',
            ]}
          />
        </Block>

        <Block title="During a session">
          <List
            items={[
              'Lead with substance. The student paid for your specific experience, so give them the real version, including the parts that are uncomfortable to hear.',
              'Be direct and honest. If their resume is not landing, their target is unrealistic, or they are focusing on the wrong thing, say so plainly and kindly.',
              'Keep it actionable. They should leave with clear next steps, not vague encouragement.',
              'Stay in your lane. Speak to what you actually know. If something is outside your experience, say so rather than guessing.',
              'Respect the time. Cover what matters most first so the value is front-loaded.',
            ]}
          />
        </Block>

        <Block title="After a session">
          <List
            items={[
              'Leave brief session notes when it helps the student remember what to do next. This is optional but appreciated.',
              'Do not promise ongoing free help outside the platform. If they want more time, they book more time.',
            ]}
          />
        </Block>

        <Block title="Code of conduct">
          <P>These are not suggestions. Breaking them can get you removed.</P>
          <List
            items={[
              ['Everything stays on-platform.', ' All scheduling and all payment happen through Trajectory. Never arrange sessions or take payment off-platform, at any commission tier. Being asked to, or asking a student to, is a serious violation.'],
              ['Be who you say you are.', ' Represent your role, employer, and experience accurately. No inflation, no borrowed credentials.'],
              ['No guarantees.', ' You do not promise a job, an admission, an offer, or any specific outcome. You share experience and honest guidance. Nothing more is promised.'],
              ['Confidentiality.', ' What a student shares with you stays between you. Do not repeat, share, or post anything from a session.'],
              ['Professional conduct always.', ' No harassment, no discrimination, no romantic or sexual advances, no pressure. Treat every student with respect regardless of background.'],
              ['No outside solicitation.', ' Do not use sessions to recruit students into other services, sell them something, or push them off the platform.'],
            ]}
          />
        </Block>

        <Block title="Payments">
          <List
            items={[
              'You set your own rates and the session lengths you offer.',
              'Payment runs through Stripe. After each completed session, your earnings are paid out to your connected account automatically. You never chase an invoice.',
              'Trajectory takes a platform commission on each session. The rest is yours.',
              'You are an independent contractor, not an employee. You handle your own taxes on what you earn. Stripe provides your tax documentation directly.',
            ]}
          />
        </Block>

        <Block title="Cancellations, reschedules, and no-shows">
          <List
            items={[
              'Students can cancel or reschedule free up to 24 hours before a session. Inside 24 hours, the session is non-refundable and you are paid for the held time.',
              'The same 24-hour standard applies to you. Cancel or reschedule with as much notice as possible. Repeatedly canceling on students late, or not showing up, will get you removed.',
              'A no-show on your part is the fastest way off the platform. Students trusted you with their time and money.',
            ]}
          />
        </Block>

        <Block title="What gets you removed">
          <P>
            We personally selected every coach here, and we will remove anyone who breaks that
            trust. Grounds for removal include off-platform payment, misrepresenting your
            background, any form of harassment or discrimination, repeated late cancellations or
            no-shows, and sharing what students tell you in confidence.
          </P>
        </Block>

        <Block title="The bar we hold">
          <P>
            We tell students that a session here is a real conversation with someone who did the
            thing they are trying to do, and that we personally review every coach before they
            join. Your job is to make that true every single time. If every student leaves
            thinking <em>that was worth it and that person was honest with me</em>, we are doing
            this right.
          </P>
        </Block>

        <div className="mt-14 border-t border-line/15 pt-10 text-center">
          <p className="text-slate">You agree to the handbook when you complete onboarding.</p>
          <Button asChild size="lg" className="mt-5">
            <Link href="/coach/setup">Continue setup</Link>
          </Button>
        </div>
      </article>
    </main>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line/15 py-8 first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl leading-snug">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-prose leading-relaxed text-ink/90">{children}</p>
}

/** Items are either a plain string or a [lead, rest] pair rendered with a bold lead-in. */
function List({ items }: { items: Array<string | [string, string]> }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed text-ink/90">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
          <span className="max-w-prose">
            {Array.isArray(item) ? (
              <>
                <strong className="font-medium text-ink">{item[0]}</strong>
                {item[1]}
              </>
            ) : (
              item
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
