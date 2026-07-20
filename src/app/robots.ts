import type { MetadataRoute } from 'next'
import { PRIVATE_PATHS, absoluteUrl } from '@/lib/seo'

/**
 * Served at /robots.txt.
 *
 * Disallow rules come from PRIVATE_PATHS so this file and the per-page `noindex` metadata
 * can't drift apart. The two are not redundant: robots.txt asks a crawler not to FETCH a
 * URL, while `noindex` tells it not to LIST one. A URL blocked here but linked from
 * elsewhere can still appear in results as a bare link, which is why both exist.
 *
 * The sitemap reference is what lets a crawler find the coach profiles without following
 * links through the browse filters.
 */
export default function robots(): MetadataRoute.Robots {
  /**
   * TWO rules per path, and neither one is redundant:
   *
   *   `/coach$`  — the `$` anchors an exact match, blocking the page itself.
   *   `/coach/`  — the trailing slash blocks everything beneath it.
   *
   * The obvious spelling, a bare `Disallow: /coach`, is a prefix match: it would also
   * block `/coaches` and `/coaches/<id>`, i.e. the entire public roster and every coach
   * profile — the only pages on this site that have any reason to rank.
   *
   * The equally obvious fix of using only `/coach/` is what this file shipped first, and
   * it leaves `/report` and `/style-guide` crawlable, because a trailing-slash rule never
   * matches the bare path. Both forms are needed to mean "this page and everything under
   * it, and nothing else".
   */
  const disallow = PRIVATE_PATHS.flatMap((p) => [`${p}$`, `${p}/`])

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
