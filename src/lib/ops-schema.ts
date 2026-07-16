/**
 * The ops board's value sets. Plain constants + app validation rather than pg enums —
 * this is an internal tool whose categories/owners churn, and a migration per value is
 * silly (see src/db/schema/tasks.ts).
 */
export const OPS_CATEGORIES = [
  'Business & Legal',
  'Website & Product',
  'Founding Coaches',
  'Marketing & Social',
] as const

export type OpsCategory = (typeof OPS_CATEGORIES)[number]

export const OPS_OWNERS = ['Aatir', 'Isaiah', 'Both', 'Unassigned'] as const
export type OpsOwner = (typeof OPS_OWNERS)[number]

export const OPS_STATUSES = ['todo', 'in_progress', 'done'] as const
export type OpsStatus = (typeof OPS_STATUSES)[number]

export function isCategory(v: unknown): v is OpsCategory {
  return typeof v === 'string' && (OPS_CATEGORIES as readonly string[]).includes(v)
}
export function isOwner(v: unknown): v is OpsOwner {
  return typeof v === 'string' && (OPS_OWNERS as readonly string[]).includes(v)
}
export function isStatus(v: unknown): v is OpsStatus {
  return typeof v === 'string' && (OPS_STATUSES as readonly string[]).includes(v)
}

export const STATUS_LABEL: Record<OpsStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

/** Owner badge tone, kept within the palette (no loud new colors). */
export function ownerTone(owner: string): string {
  switch (owner) {
    case 'Aatir':
      return 'bg-ink text-paper'
    case 'Isaiah':
      return 'border border-gold/60 text-ink'
    case 'Both':
      return 'bg-secondary text-ink'
    default:
      return 'border border-line/30 text-slate'
  }
}
