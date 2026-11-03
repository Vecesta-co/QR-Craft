import type { MaterialSet, StyleDefinition } from "@/lib/blocks/style-types";
import { MEDIEVAL_STYLES } from "@/lib/blocks/styles-medieval";
import { CLASSICAL_STYLES } from "@/lib/blocks/styles-classical";
import { ASIAN_STYLES } from "@/lib/blocks/styles-asian";
import { REGIONAL_STYLES } from "@/lib/blocks/styles-regional";
import { FANTASY_STYLES } from "@/lib/blocks/styles-fantasy";

/**
 * Canonical V2 style order. The first three entries are the preserved V1 styles;
 * their identifiers and visual identities do not change.
 */
export const STYLE_IDS = [
  "gothic",
  "royal",
  "rustic",
  "norman-keep",
  "romanesque-abbey",
  "french-chateau",
  "tudor-half-timber",
  "alpine-chalet",
  "hanseatic-brick",
  "nordic-longhouse",
  "bavarian-fachwerk",
  "english-manor",
  "renaissance-palazzo",
  "greco-roman",
  "imperial-roman",
  "byzantine-mosaic",
  "neoclassical",
  "baroque-palace",
  "venetian-gothic",
  "crusader-fortress",
  "moorish-courtyard",
  "andalusian-mudejar",
  "ottoman-courtyard",
  "japanese-castle",
  "japanese-minka",
  "zen-temple",
  "chinese-imperial",
  "chinese-garden",
  "korean-hanok",
  "khmer-temple",
  "thai-pavilion",
  "himalayan-monastery",
  "persian-garden",
  "adobe-kasbah",
  "saharan-citadel",
  "mediterranean-whitewash",
  "aegean-island",
  "swahili-coral",
  "caribbean-colonial",
  "nordic-coastal",
  "arctic-timber",
  "tropical-lodge",
  "highland-croft",
  "dark-fantasy",
  "high-fantasy",
  "elven-organic",
  "dwarven-stonework",
  "arcane-observatory",
  "crystal-architecture",
  "steampunk-brass",
  "industrial-foundry",
  "solarpunk-garden",
  "ancient-ruins",
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

const ALL_STYLES: Record<string, StyleDefinition> = {
  ...MEDIEVAL_STYLES,
  ...CLASSICAL_STYLES,
  ...ASIAN_STYLES,
  ...REGIONAL_STYLES,
  ...FANTASY_STYLES,
};

export const STYLES = ALL_STYLES as Record<StyleId, StyleDefinition>;

export const STYLE_ORDER: readonly StyleId[] = STYLE_IDS;

export const STYLE_CATEGORIES = [
  "Medieval",
  "Classical",
  "Asian",
  "Regional",
  "Fantasy",
  "Industrial",
  "Nature-inspired",
] as const;

export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

export function styleFor(id: StyleId): StyleDefinition {
  const definition = STYLES[id];
  if (!definition) throw new Error(`Unknown architectural style: ${id}`);
  return definition;
}

export function materialsFor(style: StyleId, dark: boolean): MaterialSet {
  const definition = styleFor(style);
  return dark ? definition.palette.dark : definition.palette.light;
}

export function styleLabel(id: StyleId): string {
  return STYLES[id]?.label ?? id;
}

export function styleCategory(id: StyleId): StyleCategory {
  return (STYLES[id]?.category ?? "Medieval") as StyleCategory;
}

export function assertStyleRegistryComplete(): void {
  const missing = STYLE_IDS.filter((id) => !ALL_STYLES[id]);
  const extra = Object.keys(ALL_STYLES).filter(
    (id) => !(STYLE_IDS as readonly string[]).includes(id),
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Style registry mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
  }
}
