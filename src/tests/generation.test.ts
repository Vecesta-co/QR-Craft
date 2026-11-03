import { describe, expect, it } from "vitest";
import { createQrMatrix } from "@/lib/qr/matrix";
import { generateWorld } from "@/lib/world/generate";

describe("generated world projection", () => {
  it("matches the canonical matrix and decodes its rendered top view", () => {
    const qr = createQrMatrix("https://example.com/qrcraft", { errorCorrectionLevel: "M", quietZone: 4 });
    const result = generateWorld({
      qr,
      seed: 1337,
      size: 192,
      style: "gothic",
      complexity: "balanced",
    });

    expect(result.projection.conflicts).toBe(0);
    expect(result.projection.matrixMatched).toBe(true);
    expect(result.projection.coverage).toBe(1);
    expect(result.softwareDecode.decoded).toBe(true);
    expect(result.softwareDecode.text).toBe(qr.payload);
    expect(result.softwareDecode.payloadMatched).toBe(true);
    expect(result.city.buildings).toBeGreaterThan(10);
    expect(result.plan.tasks.length).toBeGreaterThan(10);
    expect(result.plan.totalBlocks).toBeGreaterThan(5000);
  });
});
