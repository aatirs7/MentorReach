import type { ReactNode } from 'react'

/**
 * The LLC formation walkthrough, as data.
 *
 * Content lives here rather than in the wizard component so reordering or inserting a
 * step is moving an array entry, not surgery on JSX. The wizard renders exactly one at a
 * time and knows nothing about what's in them.
 *
 * NO OWNERSHIP SPLIT IS ASSUMED ANYWHERE. It is genuinely undecided, and a guide that
 * quietly hardcodes a number turns an open decision into a settled one by accident.
 * Where the split matters, the step says so and leaves the figure to them.
 */
export type StepNote = {
  tone?: 'watch' | 'pro'
  heading: string
  body: ReactNode
}

export type Step = {
  id: string
  phase: string
  title: string
  body: ReactNode
  note?: StepNote
  afterNote?: ReactNode
  links?: Array<{ label: string; href: string }>
  chips?: Array<{ tone: 'cost' | 'free' | 'time' | 'pro'; text: string }>
}

/**
 * A table cell, as DATA rather than JSX.
 *
 * Deliberate: writing cells as `<span className="font-mono">$100</span>` inside array
 * literals means every one is a keyless element in an array, which React can't reconcile
 * reliably and eslint rightly rejects. Describing the cell instead — plain text, a figure,
 * or emphasis — lets Table decide the markup and keeps the content readable.
 */
type Cell = string | { num: string } | { strong: string }

/** Shared table shell — its own scroll container so the page never scrolls sideways. */
function Table({ head, rows }: { head?: string[]; rows: Cell[][] }) {
  function render(cell: Cell) {
    if (typeof cell === 'string') return cell
    if ('num' in cell) return <span className="font-mono tabular-nums">{cell.num}</span>
    return <span className="font-medium text-ink">{cell.strong}</span>
  }

  return (
    <div className="mx-auto mt-5 max-w-prose overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
        {head ? (
          <thead>
            <tr>
              {head.map((h) => (
                <th
                  key={h}
                  className="border-b border-line/25 pr-4 pb-2 font-mono text-[10px] tracking-widest text-slate uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="border-b border-line/12 py-2.5 pr-4 align-top last:pr-0">
                  {render(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="mx-auto mt-4 max-w-prose leading-relaxed text-ink/90 first:mt-0">{children}</p>
)

const B = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-ink">{children}</span>
)

export const STEPS: Step[] = [
  /* ------------------------------------------------------------- start here */
  {
    id: 'intro',
    phase: 'Start here',
    title: 'What you are about to do',
    body: (
      <>
        <P>
          You are forming <B>one company that you both own</B>. It costs about <B>$100</B> to start
          and <B>$50 a year</B> to keep alive.
        </P>
        <P>
          You will not be employees. You will be owners, taking money out as distributions rather
          than paychecks. The company itself pays no income tax — profit is divided by whatever
          split you agree, and each of you reports your share on your personal return.
        </P>
        <P>
          About two hours of actual work, spread over one to two weeks of waiting on approvals.
        </P>
      </>
    ),
    note: {
      heading: 'Your ownership split is still open',
      body: (
        <>
          This guide never assumes a number. Wherever the split matters it says so and leaves the
          figure to you — settle it in Phase 2, in writing, before money moves.
        </>
      ),
    },
  },
  {
    id: 'veil',
    phase: 'Start here',
    title: 'The one rule that keeps the protection',
    body: (
      <>
        <P>
          An LLC separates the business from you personally. If a student sues over something in a
          session, they sue MentorReach, not your savings account.
        </P>
        <P>
          <B>That separation only holds if you respect it.</B> A court can ignore your LLC if you
          treat it as a personal wallet.
        </P>
        <ul className="mx-auto mt-4 max-w-prose list-disc space-y-1.5 pl-5 leading-relaxed text-ink/90">
          <li>Never pay a personal expense from the business account</li>
          <li>Never pay a business expense from a personal account</li>
          <li>Keep the business bank account genuinely separate</li>
          <li>Sign contracts as the LLC, not as yourself</li>
          <li>Actually follow your operating agreement</li>
        </ul>
        <P>
          Need money out? Take a distribution, then spend it. Do not buy groceries on the business
          card.
        </P>
      </>
    ),
  },
  {
    id: 'taxtrap',
    phase: 'Start here',
    title: 'The tax surprise, up front',
    body: <P>Worth knowing before anything else, because it catches people badly in year one.</P>,
    note: {
      tone: 'watch',
      heading: 'You are taxed on your share of profit, not on what you withdraw',
      body: (
        <>
          If the company makes $50,000 and leaves it in the bank to reinvest, each of you still owes
          tax on your share of that $50,000 — including the part you never took out. Distribute
          enough to cover each person&rsquo;s bill, or set the money aside deliberately. Reserve
          30–35%.
        </>
      ),
    },
  },

  /* ---------------------------------------------------------------- phase 1 */
  {
    id: 'name',
    phase: 'Phase 1 · Form the company',
    title: 'Check the name is available',
    body: (
      <>
        <P>
          Virginia requires &ldquo;LLC&rdquo;, &ldquo;L.L.C.&rdquo; or &ldquo;Limited Liability
          Company&rdquo; in the name, and it must be distinguishable from every entity already
          registered.
        </P>
        <P>
          You are checking <B>MentorReach LLC</B>.
        </P>
      </>
    ),
    links: [{ label: 'SCC entity search', href: 'https://cis.scc.virginia.gov/EntitySearch/Index' }],
    chips: [
      { tone: 'free', text: 'free' },
      { tone: 'time', text: '5 min' },
    ],
  },
  {
    id: 'tm',
    phase: 'Phase 1 · Form the company',
    title: 'Search for conflicting trademarks',
    body: (
      <P>
        Owning mentorreach.com is <B>not</B> the same as owning the name. Check nobody holds a
        conflicting mark in education or coaching services.
      </P>
    ),
    links: [{ label: 'USPTO search', href: 'https://tmsearch.uspto.gov/' }],
    chips: [
      { tone: 'free', text: 'free' },
      { tone: 'time', text: '10 min' },
    ],
  },
  {
    id: 'agent',
    phase: 'Phase 1 · Form the company',
    title: 'Decide who the registered agent is',
    body: (
      <>
        <P>
          Virginia requires a person or company at a physical Virginia street address (no PO boxes)
          to receive legal documents during business hours.
        </P>
        <P>
          Either of you can do it free as a Virginia-resident member. The tradeoff is that your home
          address becomes public record. Reversible later for a small fee.
        </P>
        <Table
          head={['Option', 'Cost', 'Tradeoff']}
          rows={[
            ['One of you serves', { num: '$0' }, 'Home address is public'],
            [
              'Commercial service',
              { num: '$100–150/yr' },
              'Privacy, mail forwarding, never miss a notice',
            ],
          ]}
        />
      </>
    ),
    links: [
      { label: 'Northwest', href: 'https://www.northwestregisteredagent.com/' },
      { label: 'Registered Agents Inc', href: 'https://www.registeredagentsinc.com/' },
    ],
  },
  {
    id: 'articles',
    phase: 'Phase 1 · Form the company',
    title: 'File the Articles of Organization',
    body: (
      <>
        <P>
          This is the document that creates the company. <B>File online</B> — same price, days
          instead of weeks.
        </P>
        <P>
          You will enter the LLC name, the registered agent name and Virginia street address, the
          principal office address, and one organizer signature (either of you).
        </P>
        <P>
          The Articles do <B>not</B> list members or the ownership split. That is deliberate —
          ownership lives in your operating agreement, which stays private. Virginia does not make
          you publish who owns what.
        </P>
      </>
    ),
    links: [{ label: 'File on CIS', href: 'https://cis.scc.virginia.gov/' }],
    chips: [
      { tone: 'cost', text: '$100 once' },
      { tone: 'time', text: '2–5 business days' },
    ],
  },
  {
    id: 'cert',
    phase: 'Phase 1 · Form the company',
    title: 'Receive the Certificate of Organization',
    body: (
      <P>
        It arrives once the filing is approved. Keep it — you need it to open the bank account, and
        it is the proof the company exists.
      </P>
    ),
  },
  {
    id: 'ein',
    phase: 'Phase 1 · Form the company',
    title: 'Apply for the EIN',
    body: (
      <>
        <P>
          The company&rsquo;s tax ID. You need it for the bank account, for Stripe, and for tax
          filings.
        </P>
        <P>
          Do this <B>after</B> the LLC is approved. One of you applies as the &ldquo;responsible
          party&rdquo; using your SSN — that person is just the IRS contact, it does not affect
          ownership.
        </P>
      </>
    ),
    note: {
      tone: 'watch',
      heading: 'Do not pay anyone for this',
      body: (
        <>
          There are companies that charge $200 for an EIN. It is free, takes ten minutes, and the
          number is issued immediately. Apply directly on irs.gov, weekdays roughly 7am–10pm
          Eastern.
        </>
      ),
    },
    links: [
      {
        label: 'IRS EIN Assistant',
        href: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
      },
    ],
    chips: [
      { tone: 'free', text: 'free' },
      { tone: 'time', text: '10 min' },
    ],
  },

  /* ---------------------------------------------------------------- phase 2 */
  {
    id: 'oa-why',
    phase: 'Phase 2 · Agree the terms',
    title: 'Why this matters more than the state filing',
    body: (
      <>
        <P>Virginia does not require an operating agreement. Get one anyway.</P>
        <P>
          Without one, Virginia&rsquo;s default rules apply, and they may not match what you agreed.
          More practically: if you two ever disagree about money, direction, or someone wanting out,
          this document is the only thing that resolves it.
        </P>
        <P>
          <B>Writing it while you both like each other is far easier than writing it later.</B>
        </P>
      </>
    ),
  },
  {
    id: 'split',
    phase: 'Phase 2 · Agree the terms',
    title: 'Settle the ownership split',
    body: (
      <>
        <P>
          This is the decision the whole document hangs on, and it is currently unsettled. Decide it
          here, consciously, and write down <em>why</em>.
        </P>
        <P>What each of you is contributing, as a starting point for the conversation:</P>
        <Table
          rows={[
            ['Isaiah', 'Concept, mentor recruiting, marketing, legal, business development'],
            [
              'Aatir',
              'The entire platform — engineering, infrastructure, product, ongoing maintenance',
            ],
          ]}
        />
        <P>
          Record the percentages and the reasoning. The reasoning is what makes it hold up in a
          disagreement two years from now.
        </P>
      </>
    ),
  },
  {
    id: 'minority',
    phase: 'Phase 2 · Agree the terms',
    title: 'Protect the minority stake',
    body: (
      <P>
        Whatever split you land on, if it is not 50/50 then one of you holds a majority.
      </P>
    ),
    note: {
      tone: 'watch',
      heading: 'A pure majority vote means the majority owner decides everything alone',
      body: (
        <>
          Deliberately list the decisions that require <B>both</B> of you — taking on debt, adding
          an owner, selling, changing the commission structure, spending over some threshold.
          Without that list, a minority stake is decorative. Day-to-day work (shipping a feature,
          posting on social) should not need consent.
        </>
      ),
    },
  },
  {
    id: 'oa-terms',
    phase: 'Phase 2 · Agree the terms',
    title: 'Cover departure, deadlock and vesting',
    body: (
      <>
        <P>The parts templates handle worst, and where the real money is:</P>
        <Table
          head={['Section', 'What it settles']}
          rows={[
            [
              'Distribution',
              'How and when money is paid out — quarterly, say, after reserving for tax and operating costs. Whether either of you can force one.',
            ],
            [
              'Authority',
              'Who decides what, and the dollar threshold each can act alone under. Member-managed is right for two people.',
            ],
            [
              'Departure',
              'What happens if one of you wants out. Buyout terms, how the company is valued, and what happens to the codebase.',
            ],
            ['Deadlock', 'A real tiebreaker for when you genuinely cannot agree.'],
            [
              'Vesting',
              'Strongly recommended: equity vesting over 3–4 years rather than granted on day one. If someone walks in month four they should not keep a permanent share of a business the other keeps building.',
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: 'oa-draft',
    phase: 'Phase 2 · Agree the terms',
    title: 'Draft it, then have it reviewed',
    body: (
      <>
        <P>
          Draft from a good template <B>together</B>, so you make every decision consciously. The
          template gets you about 85% there.
        </P>
        <P>
          Then pay an attorney for one review pass. The review catches the buyout and deadlock
          language, which is exactly where templates are weakest.
        </P>
        <P>Both of you sign. Both keep copies. It does not get filed anywhere.</P>
      </>
    ),
    links: [
      {
        label: 'Northwest free template',
        href: 'https://www.northwestregisteredagent.com/legal-forms/operating-agreement',
      },
    ],
    chips: [
      { tone: 'pro', text: 'review worth paying for' },
      { tone: 'cost', text: '$300–800' },
    ],
  },

  /* ---------------------------------------------------------------- phase 3 */
  {
    id: 'bank',
    phase: 'Phase 3 · Money',
    title: 'Open the business bank account',
    body: (
      <>
        <P>
          Bring the approved Articles, the EIN letter, your operating agreement, and both IDs.{' '}
          <B>Both of you should be signers.</B>
        </P>
        <P>
          Mercury or Novo are the recommendation: no monthly fees, fast setup, clean Stripe
          integration. Your existing bank works too if you want the convenience.
        </P>
      </>
    ),
    links: [
      { label: 'Mercury', href: 'https://mercury.com/' },
      { label: 'Novo', href: 'https://www.novo.co/' },
    ],
    chips: [{ tone: 'free', text: '$0' }],
  },
  {
    id: 'stripe',
    phase: 'Phase 3 · Money',
    title: 'Create Stripe under the LLC',
    body: (
      <P>
        Use the LLC&rsquo;s <B>EIN and business bank account</B>.
      </P>
    ),
    note: {
      tone: 'watch',
      heading: 'Do not create it under a personal SSN or another company',
      body: (
        <>
          Stripe generally will not let you swap the underlying legal entity later, so you would
          have to throw the account away and rebuild — losing your Connect setup and mentor
          onboarding. Until the LLC exists, use Stripe test mode: free, no entity needed, and it
          runs the whole booking and payout flow with fake cards.
        </>
      ),
    },
    chips: [{ tone: 'time', text: 'after EIN + bank' }],
  },
  {
    id: 'books',
    phase: 'Phase 3 · Money',
    title: 'Set up bookkeeping from day one',
    body: (
      <>
        <P>
          Do not put this off. Reconstructing a year of transactions later costs far more than
          tracking them as they happen.
        </P>
        <P>
          <B>Track:</B> all revenue, your commission, mentor payouts, every expense (domain, Vercel,
          Neon, Clerk, Zoom, Resend, legal, the SCC fees), and every distribution to either of you.
        </P>
        <P>Move the domain and every business subscription onto the business card while you are here.</P>
      </>
    ),
    links: [
      { label: 'Wave, free', href: 'https://www.waveapps.com/' },
      { label: 'QuickBooks', href: 'https://quickbooks.intuit.com/' },
    ],
    chips: [{ tone: 'cost', text: '$0–35/mo' }],
  },

  /* ---------------------------------------------------------------- phase 4 */
  {
    id: 'annual',
    phase: 'Phase 4 · Compliance',
    title: 'Calendar the annual $50 fee',
    body: (
      <>
        <P>
          Due by the last day of the month your LLC was organized, every year. Late adds a $25
          penalty, and continued non-payment can cancel the LLC.
        </P>
        <P>
          There is no annual report form for Virginia LLCs, just the fee. Virginia has no LLC
          franchise tax.
        </P>
        <P>
          The SCC mails a notice about two months ahead, but{' '}
          <B>you owe it on time whether or not the reminder arrives</B>. Set the calendar reminder
          with a two-week warning the day you form.
        </P>
      </>
    ),
    links: [{ label: 'Pay on CIS', href: 'https://cis.scc.virginia.gov/' }],
    chips: [{ tone: 'cost', text: '$50/yr' }],
  },
  {
    id: 'bpol',
    phase: 'Phase 4 · Compliance',
    title: 'Check the local business licence',
    body: (
      <>
        <P>
          Chesterfield County and most Virginia localities require a local business licence (BPOL),
          with the requirement and cost depending on gross receipts. Some exempt businesses under a
          threshold.
        </P>
        <P>
          Worth a ten-minute call to the Commissioner of the Revenue rather than a guess.
        </P>
        <P>
          While you are at it: register with Virginia Tax if you will have state tax obligations.
          MentorReach sells services, not goods, so sales tax is likely not an issue — but confirm
          rather than assume.
        </P>
      </>
    ),
    links: [
      { label: 'Chesterfield County', href: 'https://www.chesterfield.gov/159/Business-License' },
      { label: 'Virginia Tax', href: 'https://www.tax.virginia.gov/register-business-virginia' },
    ],
  },
  {
    id: 'boi',
    phase: 'Phase 4 · Compliance',
    title: 'You are exempt from BOI reporting',
    body: (
      <>
        <P>
          You may have read that every new LLC must report its owners to FinCEN. <B>That changed.</B>
        </P>
        <P>
          As of a March 2025 interim final rule, entities created in the United States and their
          beneficial owners are <B>exempt</B> from reporting beneficial ownership to FinCEN. Only
          foreign-formed companies registered to do business in a US state still have active
          obligations.
        </P>
        <P>
          So a Virginia-formed LLC owned by two US persons does not need to file today.{' '}
          <B>Do not pay a service to do it for you.</B>
        </P>
        <P>
          One caveat: it is an interim final rule in regulatory limbo, and the Eleventh Circuit
          upheld the Corporate Transparency Act as constitutional in December 2025. It could come
          back — check once a year.
        </P>
      </>
    ),
    links: [{ label: 'fincen.gov/boi', href: 'https://www.fincen.gov/boi' }],
    chips: [{ tone: 'free', text: 'no filing needed today' }],
  },
  {
    id: 'placeholders',
    phase: 'Phase 4 · Compliance',
    title: 'Fill the placeholders in the legal documents',
    body: (
      <>
        <P>
          Once the entity name, state and address exist, they go into the Terms of Service, Privacy
          Policy, Refund Policy and Mentor Agreement.
        </P>
        <P>
          Five values: <B>legal entity name</B>, <B>state</B>, <B>support email</B>,{' '}
          <B>mailing address</B>, and <B>county</B> for the jurisdiction clause. Plus two decisions
          flagged for counsel: courts vs. arbitration, and the non-circumvention window.
        </P>
      </>
    ),
    note: {
      tone: 'watch',
      heading: 'Do this before the founding mentors sign',
      body: (
        <>
          Editing a legal document is a version bump, and a bump unpublishes every mentor who signed
          the previous version until they re-sign. Before anyone has signed it costs nothing. After,
          it takes all nine offline.
        </>
      ),
    },
  },

  /* ----------------------------------------------------------- how you get paid */
  {
    id: 'pay',
    phase: 'How you get paid',
    title: 'Distributions, not paychecks',
    body: (
      <>
        <P>
          In a multi-member LLC taxed as a partnership, <B>members cannot be on payroll</B>. No W-2,
          no withholding, no paycheck. This is the default, and it is what you said you wanted.
        </P>
        <P>
          Instead you transfer money from the business account to your personal account. That is a
          distribution. No tax is withheld at the time.
        </P>
        <P>
          <B>Guaranteed payments</B> are the optional exception: if one of you does substantially
          more work and should be paid for it <em>before</em> profit is split, the operating
          agreement can say so. Worth considering given the workload asymmetry, though it
          complicates the return.
        </P>
      </>
    ),
  },
  {
    id: 'tax',
    phase: 'How you get paid',
    title: 'How the tax actually works',
    body: (
      <>
        <Table
          rows={[
            [
              { num: '1' },
              'The company files Form 1065, an informational return. The LLC pays no federal income tax.',
            ],
            [
              { num: '2' },
              'Each of you gets a Schedule K-1 showing your agreed share of profit.',
            ],
            [
              { num: '3' },
              'You each report the K-1 on your personal 1040 and pay at your individual rate.',
            ],
          ]}
        />
        <P>
          <B>You do not 1099 each other.</B> The K-1 is the mechanism.
        </P>
        <P>
          Your share is also subject to self-employment tax at <B>15.3%</B> — 12.4% Social Security
          up to a wage base around $184,500, plus 2.9% Medicare with no cap — on top of ordinary
          income tax. Reserve 30–35%.
        </P>
        <P>
          Nothing is withheld, so you each pay the IRS directly four times a year. Approximate
          federal dates: 15 April, 15 June, 15 September, 15 January.
        </P>
      </>
    ),
    links: [
      { label: 'Form 1065', href: 'https://www.irs.gov/forms-pubs/about-form-1065' },
      { label: 'Schedule K-1', href: 'https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065' },
      { label: 'Form 1040-ES', href: 'https://www.irs.gov/forms-pubs/about-form-1040-es' },
    ],
  },
  {
    id: 'savings',
    phase: 'How you get paid',
    title: 'Tax savings, honestly ranked',
    body: (
      <>
        <P>
          <B>1. Deduct everything legitimate.</B> The biggest immediate win, available today.
          Vercel, Neon, Clerk, Resend, Zoom, the domain, design and AI tools, the SCC fees, legal
          and accounting, marketing, a portion of phone and internet, home office if the space is
          used regularly and exclusively, business travel, meals at generally 50%. Pay from the
          business account and keep receipts.
        </P>
        <P>
          <B>2. Retirement accounts.</B> A Solo 401(k) or SEP-IRA shelters far more than a personal
          IRA — the largest legal tax reduction available to a profitable small business. Not urgent
          at $0 revenue.
        </P>
        <P>
          <B>3. Virginia PTET election.</B> A real potential saving whose rules are genuinely in
          flux. Worth a specific question to a Virginia CPA once profitable. Do not act on it from a
          guide.
        </P>
      </>
    ),
    links: [
      { label: 'Solo 401(k)', href: 'https://www.irs.gov/retirement-plans/one-participant-401k-plans' },
      {
        label: 'VA PTET',
        href: 'https://www.tax.virginia.gov/elective-pass-through-entity-tax-guidelines',
      },
    ],
  },
  {
    id: 'scorp',
    phase: 'How you get paid',
    title: 'S-corp: not yet, and read the catch',
    body: (
      <P>
        A lot of content pushes S-corp elections. The savings are real — every dollar shifted from
        salary to distribution saves 15.3 cents in payroll tax. But break-even is roughly{' '}
        <B>$50,000–80,000 in net profit</B>. Below that, payroll and filing costs outweigh it.
      </P>
    ),
    note: {
      tone: 'watch',
      heading: 'It would make you W-2 employees of your own company',
      body: (
        <>
          The IRS requires owner-employees to take reasonable, market-rate compensation — typically
          30–50% of net income — so you would run real payroll and file quarterly employment
          returns. You said you want to be owners, not employees. This reverses that. Reasonable
          compensation is also the audit trigger.
        </>
      ),
    },
    afterNote: (
      <P>
        <B>Recommendation: do not elect now.</B> Revisit at roughly $60,000 in consistent annual net
        profit. Delaying is low risk — Rev. Proc. 2013-30 allows retroactive elections up to 3 years
        and 75 days late.
      </P>
    ),
  },

  /* ----------------------------------------------------------------- needs a pro */
  {
    id: 'pro1',
    phase: 'Needs a professional',
    title: 'Who files the mentor tax forms?',
    body: (
      <>
        <P>This is the one place this guide flags a question rather than answering it.</P>
        <P>
          Stripe&rsquo;s documentation says that if you run a platform or marketplace you{' '}
          <B>may be required to file 1099 forms</B>, and that platforms responsible for filing can
          create and deliver them from the Tax Reporting dashboard. That is tooling for <em>you</em>{' '}
          to file — not Stripe filing on your behalf.
        </P>
        <P>
          The thresholds are confusing in a way that matters: for third-party settlement
          organisations a 1099-K needs $20,000 <em>and</em> 200+ transactions, but for{' '}
          <B>payment card processors there is no threshold at all</B>. From 2026 the 1099-MISC/NEC
          threshold rose from $600 to $2,000, and several states set their own lower ones regardless.
        </P>
      </>
    ),
    note: {
      tone: 'pro',
      heading: 'Ask a CPA exactly this',
      body: (
        <>
          &ldquo;We run a two-sided marketplace on Stripe Connect using destination charges with
          Express accounts. Who is the filer of record for mentor tax forms, us or Stripe? Which
          form applies, and at what threshold, given card-processed payments?&rdquo;
        </>
      ),
    },
    afterNote: (
      <>
        <P>
          <B>When:</B> before your first mentor crosses a meaningful earnings threshold —
          realistically before or shortly after launch. A correct use of a few hundred dollars.
        </P>
        <P>
          Meanwhile enable Stripe Tax Reporting and make sure every mentor completes their tax info
          during Connect onboarding. Collecting it is required either way, so it is never wasted
          work.
        </P>
      </>
    ),
    links: [{ label: 'Stripe Connect 1099', href: 'https://stripe.com/connect/1099' }],
    chips: [
      { tone: 'pro', text: 'needs a pro' },
      { tone: 'cost', text: '$150–400' },
    ],
  },
  {
    id: 'pro2',
    phase: 'Needs a professional',
    title: 'What is already settled about mentors',
    body: (
      <>
        <P>So you know where the uncertainty actually is:</P>
        <P>
          Mentors are <B>independent contractors, not employees</B>. They set their own rates, hours
          and methods, and the Mentor Agreement documents it. You do not withhold tax from them.
        </P>
        <P>
          Money flows through <B>Stripe Connect destination charges</B>: the student pays, Stripe
          splits at the moment of the charge, your commission stays with the LLC and the
          mentor&rsquo;s share routes to their connected account. You never manually pay a mentor.
        </P>
      </>
    ),
    note: {
      heading: 'Your taxable income is the commission, not the gross',
      body: (
        <>
          If you process $100,000 in sessions and keep 30%, your revenue is $30,000 — not $100,000.
          Make sure the bookkeeping reflects that from the start, or your first tax return will
          overstate income by a factor of three.
        </>
      ),
    },
  },

  /* -------------------------------------------------------------------- reference */
  {
    id: 'costs',
    phase: 'Reference',
    title: 'What it costs',
    body: (
      <>
        <P>
          <B>To start</B>
        </P>
        <Table
          rows={[
            ['Articles of Organization', { num: '$100' }],
            ['EIN', { num: '$0' }],
            ['Operating agreement (template)', { num: '$0–100' }],
            ['Business bank account', { num: '$0' }],
            [
              { strong: 'Minimum to be legally operating' },
              { num: '$100' },
            ],
          ]}
        />
        <P>
          <B>Every year</B>
        </P>
        <Table
          rows={[
            ['Virginia annual registration', { num: '$50' }],
            ['Registered agent, if using a service', { num: '$100–150' }],
            ['Bookkeeping software', { num: '$0–420' }],
            ['Tax preparation, Form 1065', { num: '$500–1,200' }],
          ]}
        />
      </>
    ),
  },
  {
    id: 'hire',
    phase: 'Reference',
    title: 'When to pay a professional',
    body: (
      <>
        <Table
          head={['Trigger', 'Who', 'Cost']}
          rows={[
            ['Operating agreement review', 'VA business attorney', { num: '$300–800' }],
            ['Legal document review', 'Business attorney', { num: '$500–1,500' }],
            ['First Form 1065 return', 'CPA or preparer', { num: '$500–1,200' }],
            ['The mentor 1099 question', 'CPA, one consult', { num: '$150–400' }],
            ['Profit over ~$60,000/yr', 'CPA, ongoing', { num: 'varies' }],
          ]}
        />
        <P>
          <B>Do yourselves:</B> name check, Articles, EIN, bank account, bookkeeping, the annual fee.
        </P>
        <P>
          <B>Pay for:</B> the operating agreement review, the first partnership return, and the
          mentor 1099 question.
        </P>
      </>
    ),
  },
]
