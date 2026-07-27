/**
 * The legal entity, for display in the founder console and as the single source for the
 * company facts that also appear in the legal documents' contact sections.
 *
 * These are all PUBLIC RECORD — they are on the Virginia SCC filing (searchable at
 * cis.scc.virginia.gov) and in the Terms of Service served at /legal/terms — so keeping
 * them in the repo is fine. The EIN is deliberately NOT here: this repository is public,
 * and while an EIN is only semi-sensitive, there is no reason to publish it. It is read
 * from the optional COMPANY_EIN env var at the point of display instead (see
 * src/app/admin/legal/page.tsx).
 */
export const COMPANY = {
  legalName: 'MentorReach LLC',
  dba: 'MentorReach',
  state: 'Virginia',
  filingAgency: 'Virginia State Corporation Commission',
  /** SCC entity ID from the certificate of organization. */
  sccId: '12050080',
  /** Effective date of the certificate of organization. */
  formedOn: '2026-07-21',
  /** Registered / principal office address on the formation documents. */
  registeredAddress: '44056 Riverpoint Drive, Leesburg, VA 20176',
  /** Filed as a multi-member LLC → partnership for federal tax (IRS assigned Form 1065). */
  taxClassification: 'Multi-member LLC — partnership (IRS Form 1065)',
  supportEmail: 'support@mentorreach.com',
} as const
