export type Role = 'student' | 'coach' | 'admin'

declare global {
  /**
   * Shape of the custom claims we add to Clerk's session token.
   *
   * ⚠️ REQUIRES A DASHBOARD STEP WITH NO CODE EQUIVALENT:
   * Clerk Dashboard → Sessions → Customize session token → Claims editor:
   *
   *   { "metadata": "{{user.public_metadata}}" }
   *
   * Without it, `sessionClaims.metadata.role` is silently `undefined` forever and
   * every role check fails. This is the most commonly missed step in Clerk RBAC.
   */
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Role
    }
  }
}
