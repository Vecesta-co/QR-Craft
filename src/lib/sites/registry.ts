import { LEGACY_SITES } from "@/lib/sites/legacy";
import { WEST_SITES } from "@/lib/sites/catalog-west";
import { EAST_SITES } from "@/lib/sites/catalog-east";
import {
  SITE_ID_VALUES,
  type SiteDimension,
  type SiteId,
  type WorldSiteDefinition,
} from "@/lib/sites/types";
import type { StyleId } from "@/lib/blocks/styles";
import { FEATURE_LANDSCAPE_BAND } from "@/lib/world/site";

/**
 * The canonical V2 site registry. The four V1 presets are first and retain their
 * exact IDs, requested-size behavior and legacy valley generator flag.
 */
export const SITE_IDS = SITE_ID_VALUES;
export type { SiteId };

const ALL_SITES: Record<string, WorldSiteDefinition> = {
  ...LEGACY_SITES,
  ...WEST_SITES,
  ...EAST_SITES,
};

export const SITES = ALL_SITES as Record<SiteId, WorldSiteDefinition>;
export const SITE_ORDER: readonly SiteId[] = SITE_IDS;

export function siteFor(id: SiteId): WorldSiteDefinition {
  const site = SITES[id];
  if (!site) throw new Error(`Unknown QRCraft site: ${id}`);
  return site;
}

export function siteLabel(id: SiteId): string {
  return SITES[id]?.name ?? id;
}

export function siteMinimumSize(id: SiteId): SiteDimension {
  return siteFor(id).minimumSize;
}

/** V2 sites reserve room for outer landmarks; V1 presets keep their layout. */
export function siteLandscapeBand(id: SiteId): number {
  return siteFor(id).legacy ? 0 : FEATURE_LANDSCAPE_BAND;
}

export function isLegacySite(id: SiteId): boolean {
  return siteFor(id).legacy;
}

export function siteSupportsStyle(id: SiteId, style: StyleId): boolean {
  const site = siteFor(id);
  return site.excellentStyles.includes(style) || site.goodStyles.includes(style);
}

export function assertSiteRegistryComplete(): void {
  const missing = SITE_ID_VALUES.filter((id) => !ALL_SITES[id]);
  const extra = Object.keys(ALL_SITES).filter(
    (id) => !(SITE_ID_VALUES as readonly string[]).includes(id),
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Site registry mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
  }
  for (const id of SITE_ID_VALUES) {
    const site = ALL_SITES[id];
    if (site.id !== id) {
      throw new Error(`Site registry key ${id} contains definition ${site.id}.`);
    }
    if (!site.excellentStyles.includes(site.excellentStyles[0])) {
      throw new Error(`Site ${id} has no excellent style.`);
    }
    if (!site.legacy && site.terrain.profile !== site.terrainProfile) {
      throw new Error(`Site ${id} terrain profile disagrees with its terrain rules.`);
    }
  }
}

assertSiteRegistryComplete();
