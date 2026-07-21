/**
 * Signature checks that run on BOTH sides.
 *
 * Separate from legal-acceptance.ts because that module is `server-only` (it touches the
 * database and request headers), and the signature form needs these while typing. Pure
 * functions, no I/O — importable from a client component without dragging the database in.
 *
 * The server is still the authority: it calls validateSignature() again before writing.
 * This copy exists so someone learns about a problem before submitting, not so the browser
 * gets to decide.
 */

/** Minimum bar for a typed signature: a real name, not a keystroke. */
export function validateSignature(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ')

  if (trimmed.length < 4) return { ok: false, error: 'Please type your full legal name.' }
  if (!trimmed.includes(' ')) {
    return { ok: false, error: 'Please type your full legal name, first and last.' }
  }
  if (!/[a-z]/i.test(trimmed)) return { ok: false, error: 'That doesn’t look like a name.' }

  return { ok: true }
}

/**
 * Does the typed signature plausibly belong to the account holder?
 *
 * A WARNING, never a block. People sign with middle names, maiden names, or the legal name
 * behind a nickname, and rejecting those would stop a legitimate mentor from onboarding
 * over a formatting difference. Surfacing the mismatch is useful; enforcing it is not.
 */
export function signatureLooksDifferent(signature: string, accountName: string | null): boolean {
  if (!accountName) return false

  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 1),
    )

  const sig = words(signature)
  const acct = words(accountName)
  if (!acct.size || !sig.size) return false

  // Any shared word — usually the surname — is enough to treat it as the same person.
  for (const w of acct) if (sig.has(w)) return false
  return true
}
