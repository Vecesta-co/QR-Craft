import type { StyleId } from "@/lib/blocks/styles";
import { siteFor } from "@/lib/sites/registry";
import type { SiteCompatibility, SiteId } from "@/lib/sites/types";

/**
 * Honest curation-based compatibility, not a hidden physical simulation.
 * Excellent style/site combinations are explicitly authored; good combinations
 * are adjacent traditions; everything else is unusual but fully supported.
 */
export function compatibilityFor(siteId: SiteId, style: StyleId): SiteCompatibility {
  const site = siteFor(siteId);
  if (site.excellentStyles.includes(style)) {
    return { level: "excellent", score: 3, label: "Excellent match" };
  }
  if (site.goodStyles.includes(style)) {
    return { level: "good", score: 2, label: "Good match" };
  }
  return { level: "unusual", score: 1, label: "Unusual pairing" };
}

export function compatibilityLabel(siteId: SiteId, style: StyleId): string {
  return compatibilityFor(siteId, style).label;
}
