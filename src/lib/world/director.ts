import { SITE_LABELS, type Complexity, type SiteSize } from "@/lib/world/site";
import type { SiteLayout } from "@/lib/world/site";
import { STYLES, type StyleId } from "@/lib/blocks/registry";
import { QUALITY_LABELS, type QualityLevel } from "@/lib/blocks/style-types";
import { siteFor } from "@/lib/sites/registry";
import type { SiteId } from "@/lib/sites/types";
import type { ProjectionReport } from "@/lib/qr/projector";
import type { CityResult } from "@/lib/world/city";
import type { SceneScore, WorldBrief, WorldStats } from "@/lib/world/types";

export function createWorldBrief(
  layout: SiteLayout,
  config: {
    seed: number;
    size: SiteSize;
    site: SiteId;
    style: StyleId;
    quality: QualityLevel;
    complexity: Complexity;
  },
  city: CityResult,
  terrain: { fieldCount: number; hasHamlet: boolean; siteFeatures: readonly string[] },
): WorldBrief {
  const style = STYLES[config.style];
  const site = siteFor(config.site);
  const districts = [
    "Castle Ward",
    "Cathedral Close",
    "Bastion Yard",
    city.marketModules > 0 ? "Market Ward" : "Town Ward",
  ];
  if (terrain.hasHamlet) districts.push("Outer Hamlet");
  if (terrain.fieldCount > 0) districts.push("Farmland");

  const infrastructure = ["Stone bridge", "Processional avenue", "Ring roads", "Moat", "City plateau"];
  if (terrain.fieldCount > 0) infrastructure.push("Crop fields");
  if (terrain.hasHamlet) infrastructure.push("Outer hamlet lane");

  const extra = [
    terrain.hasHamlet ? "an outer hamlet" : null,
    terrain.fieldCount > 0 ? `${terrain.fieldCount} crop field${terrain.fieldCount === 1 ? "" : "s"}` : null,
    terrain.siteFeatures.length > 0 ? terrain.siteFeatures.join(", ") : null,
  ].filter((entry): entry is string => entry !== null);

  return {
    theme: "medieval",
    themeLabel: site.name,
    site: config.site,
    siteLabel: site.name,
    siteDescription: site.shortDescription,
    style: config.style,
    styleLabel: style.label,
    quality: config.quality,
    qualityLabel: QUALITY_LABELS[config.quality],
    size: layout.worldSize,
    sizeLabel: SITE_LABELS[layout.worldSize],
    complexity: config.complexity,
    seed: config.seed,
    qrVersion: layout.qr.version,
    moduleCount: layout.qr.moduleCount,
    cellSize: layout.cellSize,
    terrain: `${site.biomeProfile}. ${site.worldShape}.`,
    primaryLandmark: site.primaryLandmarks[0] ?? "High Keep",
    secondaryLandmarks: [...site.primaryLandmarks.slice(1), ...site.secondaryLandmarks],
    districts,
    infrastructure,
    summary: `${style.label} architecture at ${QUALITY_LABELS[config.quality].toLowerCase()} quality in ${site.name}: ${site.shortDescription} The QR city contains ${city.buildings} buildings and ${city.structures} structures around its ${city.tallestLandmark}${
      extra.length > 0 ? `, with ${extra.join(", ")}` : ""
    }.`,
  };
}

/**
 * Deterministic, documented scene heuristics. These are not human quality
 * ratings; each field measures something concrete in the generated world.
 */
export function scoreScene(
  layout: SiteLayout,
  city: CityResult,
  stats: WorldStats,
  projection: ProjectionReport,
): SceneScore {
  const landmarkHeight = Math.max(...city.landmarks.map((landmark) => landmark.topY), layout.cityGroundY + 1);
  const prominence = Math.max(
    0,
    Math.min(100, Math.round(40 + ((landmarkHeight - layout.cityGroundY) / 40) * 55)),
  );
  const hierarchy = Math.max(
    0,
    Math.min(100, Math.round(30 + city.landmarks.length * 10 + city.towers * 2.5)),
  );
  const coherence = Math.round(projection.coverage * 100);
  const density = Math.max(
    0,
    Math.min(100, Math.round((stats.structures / Math.max(1, layout.worldSize / 32)) * 12)),
  );
  const qrCoverage = Math.round(projection.coverage * 100);
  const total = Math.round(
    prominence * 0.24 + hierarchy * 0.18 + coherence * 0.22 + density * 0.14 + qrCoverage * 0.22,
  );
  return {
    total,
    landmarkProminence: prominence,
    verticalHierarchy: hierarchy,
    materialCoherence: coherence,
    densityBalance: density,
    qrCoverage,
    notes: {
      landmarkProminence: "Landmark height above city ground compared with a 40-block design target.",
      verticalHierarchy: "Count of major landmarks and towers contributing distinct silhouette heights.",
      materialCoherence: "Share of projected columns whose top block belongs to the correct QR colour class.",
      densityBalance: "Structures per 32x32 block district, clamped to a 0-100 scale.",
      qrCoverage: "Percentage of QR columns whose top surface matches the target module.",
      disclaimer: "Heuristic scene metrics for deterministic comparison, not a validated human preference score.",
    },
  };
}
