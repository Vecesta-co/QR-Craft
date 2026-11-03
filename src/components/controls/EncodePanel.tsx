"use client";

import { useMemo, useRef, useState } from "react";
import { createQrMatrix } from "@/lib/qr/matrix";
import { decodeQrImageFile } from "@/lib/qr/image";
import {
  COMPLEXITIES,
  SITE_LABELS,
  SITE_SIZES,
  chooseWorldSize,
  type Complexity,
  type SiteSize,
} from "@/lib/world/site";
import {
  QUALITY_COPY,
  QUALITY_LABELS,
  QUALITY_LEVELS,
  STYLE_ORDER,
  STYLES,
  type QualityLevel,
  type StyleId,
} from "@/lib/blocks/registry";
import { SITE_ORDER, SITES, siteFor, siteLandscapeBand } from "@/lib/sites/registry";
import { compatibilityFor } from "@/lib/sites/compatibility";
import type { SiteId } from "@/lib/sites/types";
import { useQrCraft } from "@/state/useQrCraft";
import { QrPreview } from "@/components/ui/QrPreview";
import { generateWorld } from "@/lib/client/generation-service";

const SITE_CATEGORIES = Array.from(new Set(SITE_ORDER.map((id) => SITES[id].category)));

const COMPLEXITY_COPY: Record<Complexity, string> = {
  serene: "Lower houses, no manors, and a quieter landscape.",
  balanced: "The default mix of houses, manors, towers and terrain.",
  dense: "More watchtowers, trees and rocks around the city.",
};

export function EncodePanel() {
  const payload = useQrCraft((state) => state.payload);
  const seed = useQrCraft((state) => state.seed);
  const size = useQrCraft((state) => state.size);
  const site = useQrCraft((state) => state.site);
  const style = useQrCraft((state) => state.style);
  const quality = useQrCraft((state) => state.quality);
  const complexity = useQrCraft((state) => state.complexity);
  const generating = useQrCraft((state) => state.generating);
  const error = useQrCraft((state) => state.error);
  const uploadNote = useQrCraft((state) => state.uploadNote);
  const dirty = useQrCraft((state) => state.dirty);
  const hasWorld = useQrCraft((state) => state.result !== null);
  const setPayload = useQrCraft((state) => state.setPayload);
  const setSeed = useQrCraft((state) => state.setSeed);
  const setSize = useQrCraft((state) => state.setSize);
  const setSite = useQrCraft((state) => state.setSite);
  const setStyle = useQrCraft((state) => state.setStyle);
  const setQuality = useQrCraft((state) => state.setQuality);
  const setComplexity = useQrCraft((state) => state.setComplexity);
  const setUploadNote = useQrCraft((state) => state.setUploadNote);

  const fileInput = useRef<HTMLInputElement>(null);
  const [decodingImage, setDecodingImage] = useState(false);

  const siteDefinition = SITES[site];
  const compatibility = compatibilityFor(site, style);

  const effective = useMemo(() => {
    try {
      const qr = createQrMatrix(payload, { errorCorrectionLevel: "M", quietZone: 4 });
      return chooseWorldSize(qr, size, siteFor(site).minimumSize, siteLandscapeBand(site));
    } catch {
      return null;
    }
  }, [payload, size, site]);

  const canGenerate = Boolean(payload.trim()) && !generating;

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setDecodingImage(true);
    setUploadNote(null);
    try {
      const decoded = await decodeQrImageFile(file);
      setPayload(decoded);
      setUploadNote(`Decoded from ${file.name}`);
    } catch (uploadError) {
      setUploadNote(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setDecodingImage(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = () => {
    if (!canGenerate) return;
    generateWorld();
  };

  return (
    <div className="encode-panel">
      <QrPreview
        payload={payload}
        size={size}
        minimumSize={siteDefinition.minimumSize}
        landscapeBand={siteLandscapeBand(site)}
      />

      <label className="field">
        <span className="field__label">
          Payload
          <span className="field__hint">URL, text, or a decoded QR image</span>
        </span>
        <textarea
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={3}
          spellCheck={false}
          className="text-input text-input--area"
          data-testid="payload-input"
          aria-label="QR payload"
          disabled={generating}
        />
      </label>

      <div className="upload-row">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          data-testid="upload-input"
          onChange={(event) => void onUpload(event.target.files?.[0])}
        />
        <button
          type="button"
          className="button button--ghost"
          onClick={() => fileInput.current?.click()}
          disabled={decodingImage || generating}
          data-testid="upload-button"
        >
          {decodingImage ? "Decoding image…" : "Upload QR image"}
        </button>
        <span className="upload-row__hint">PNG · JPEG · WebP</span>
      </div>
      {uploadNote && <p className="inline-note inline-note--accent">{uploadNote}</p>}

      <div className="field-grid">
        <label className="field">
          <span className="field__label">Seed</span>
          <div className="seed-row">
            <input
              type="number"
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value))}
              className="text-input"
              data-testid="seed-input"
              aria-label="World seed"
              disabled={generating}
            />
            <button
              type="button"
              className="button button--icon"
              aria-label="Randomize seed"
              onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))}
              disabled={generating}
            >
              ↻
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field__label">World size</span>
          <select
            value={size}
            onChange={(event) => setSize(Number(event.target.value) as SiteSize)}
            className="text-input"
            data-testid="size-select"
            aria-label="World size"
            disabled={generating}
          >
            {SITE_SIZES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {SITE_LABELS[candidate]} · {candidate}²
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">
          World site
          <span className="field__hint">Terrain, landmark and skyline</span>
        </span>
        <select
          value={site}
          onChange={(event) => setSite(event.target.value as SiteId)}
          className="text-input"
          data-testid="site-select"
          aria-label="World site"
          disabled={generating}
        >
          {SITE_CATEGORIES.map((category) => (
            <optgroup key={category} label={category}>
              {SITE_ORDER.filter((id) => SITES[id].category === category).map((id) => (
                <option key={id} value={id}>
                  {SITES[id].name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="site-summary">
        <p className="site-summary__copy">{siteDefinition.shortDescription}</p>
        <ul className="site-summary__landmarks" aria-label="Site landmarks">
          {[siteDefinition.primaryLandmarks[0], ...siteDefinition.secondaryLandmarks.slice(0, 2)]
            .filter(Boolean)
            .map((landmark) => (
              <li key={landmark}>{landmark}</li>
            ))}
        </ul>
        <span className={`compatibility compatibility--${compatibility.level}`}>
          {compatibility.label}
        </span>
      </div>

      {effective && effective.upgraded && (
        <p className="inline-note">
          {effective.minimumForced ? (
            <>
              <strong>{siteDefinition.name}</strong> needs at least{" "}
              {SITE_LABELS[siteDefinition.minimumSize]} ({siteDefinition.minimumSize}²) so its
              dominant landmark is not shrunk. The build will use{" "}
              <strong>{SITE_LABELS[effective.size]}</strong> at {effective.cellSize} blocks per
              module.
            </>
          ) : effective.landscapeForced ? (
            <>
              {SITE_LABELS[size]} is too small to leave room for the outer landmarks. The build
              will use <strong>{SITE_LABELS[effective.size]}</strong> at {effective.cellSize}{" "}
              blocks per module.
            </>
          ) : (
            <>
              {SITE_LABELS[size]} is too small for this payload. The build will use{" "}
              <strong>{SITE_LABELS[effective.size]}</strong> at {effective.cellSize} blocks per
              module.
            </>
          )}
        </p>
      )}

      <div className="field">
        <span className="field__label">Architecture</span>
        <div className="style-grid">
          {STYLE_ORDER.map((id: StyleId) => {
            const definition = STYLES[id];
            return (
              <button
                type="button"
                key={id}
                className={`style-card ${style === id ? "is-selected" : ""}`}
                onClick={() => setStyle(id)}
                disabled={generating}
                data-testid={`style-${id}`}
                aria-pressed={style === id}
              >
                <span className="style-card__swatches" aria-hidden="true">
                  {definition.swatches.map((swatch) => (
                    <span key={swatch} style={{ background: swatch }} />
                  ))}
                </span>
                <span className="style-card__title">{definition.label}</span>
                <span className="style-card__copy">{definition.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Construction quality</span>
        <div className="segmented">
          {QUALITY_LEVELS.map((candidate: QualityLevel) => (
            <button
              key={candidate}
              type="button"
              className={`segmented__item ${quality === candidate ? "is-selected" : ""}`}
              onClick={() => setQuality(candidate)}
              disabled={generating}
              data-testid={`quality-${candidate}`}
              aria-pressed={quality === candidate}
              title={QUALITY_COPY[candidate]}
            >
              {QUALITY_LABELS[candidate]}
            </button>
          ))}
        </div>
        <p className="field__hint">{QUALITY_COPY[quality]}</p>
      </div>

      <div className="field">
        <span className="field__label">Density</span>
        <div className="segmented">
          {COMPLEXITIES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={`segmented__item ${complexity === candidate ? "is-selected" : ""}`}
              onClick={() => setComplexity(candidate)}
              disabled={generating}
              data-testid={`complexity-${candidate}`}
              aria-pressed={complexity === candidate}
              title={COMPLEXITY_COPY[candidate]}
            >
              {candidate}
            </button>
          ))}
        </div>
        <p className="field__hint">{COMPLEXITY_COPY[complexity]}</p>
      </div>

      {dirty && hasWorld && (
        <p className="inline-note" data-testid="dirty-note">
          Settings changed. The canvas still shows the previous kingdom and its verification. Generate
          to rebuild the world with these settings.
        </p>
      )}

      <button
        type="button"
        className="button button--primary button--wide"
        disabled={!canGenerate}
        onClick={submit}
        data-testid="generate-button"
      >
        {generating ? "Generating kingdom…" : "Generate kingdom"}
      </button>
      {error && <p className="inline-note inline-note--danger">{error}</p>}
      <p className="panel-footnote">
        Same payload, seed, size, world site, architecture, quality and density always produce the
        same world. The QR matrix is encoded locally; no AI service is called.
      </p>
    </div>
  );
}
