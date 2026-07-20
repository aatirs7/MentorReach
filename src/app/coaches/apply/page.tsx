import { ApplicationForm } from './application-form'
import { JsonLd } from '@/components/json-ld'
import { absoluteUrl } from '@/lib/seo'

export const metadata = {
  title: 'Coach with MentorReach',
  description:
    'Apply to coach on MentorReach. Set your own rates and hours, get paid per session, and keep your day job. Applications take about 5 to 10 minutes.',
  alternates: { canonical: '/coaches/apply' },
  openGraph: {
    title: 'Coach with MentorReach',
    description:
      'Set your own rates and hours, get paid per session, and keep your day job. Applications take about 5 to 10 minutes.',
    url: '/coaches/apply',
  },
}

/**
 * The questions this page already answers in its own copy and flow. Kept adjacent to the
 * page rather than in a shared constants file precisely BECAUSE the answers must stay
 * true to what the form says — an FAQ block that drifts from the page it describes is the
 * thing structured-data manual actions are for.
 *
 * This page targets real, low-competition intent ("how to become a career coach"), which
 * is why it's the one marketing page carrying an FAQ graph.
 */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Who can coach on MentorReach?',
    a: 'People who currently hold the role others are trying to reach. We review every application personally, and we look for real, current experience in your field rather than a coaching qualification.',
  },
  {
    q: 'How much does it cost to join?',
    a: 'Nothing. There is no listing fee and no subscription. MentorReach takes a commission on each session you are paid for, and you keep the rest.',
  },
  {
    q: 'Do I set my own rates?',
    a: 'Yes. You set your price for each session length you offer, and you choose which lengths to offer. We will suggest a range if your first number sits well outside what students typically book.',
  },
  {
    q: 'How much time does it take?',
    a: 'You choose your own weekly hours and can block out dates. Most coaches offer a handful of sessions a month around a full-time job.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Payment runs through Stripe on the platform. Your payout is sent automatically after each session, so there is no invoicing and nothing to chase.',
  },
  {
    q: 'Does my employer need to know?',
    a: 'That is your call. You can have your profile show your employer by name, or describe your role generally instead, such as "Investment Banking Analyst".',
  },
]

/**
 * Public coach application — the pre-vetting front door. No login; applicants create an
 * account only at profile setup, after they're accepted.
 */
export default function ApplyPage() {
  return (
    <main className="flex-1">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          '@id': `${absoluteUrl('/coaches/apply')}#faq`,
          mainEntity: FAQ.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }}
      />
      <ApplicationForm />
    </main>
  )
}
