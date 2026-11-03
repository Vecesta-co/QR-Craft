# QR Certification

QR Craft's central claim is narrow and testable:

> The actual top projection of the generated voxel world decodes back to the exact requested payload.

Nothing in the UI may promote a world to `QR VERIFIED` on the strength of the QR matrix alone. This document explains the encoding contract, the projection rule, both optical checks, the status ladder, and the limits of the claim.

---

## 1. Canonical matrix

`src/lib/qr/matrix.ts` uses the `qrcode` package with:

- error correction level **M**;
- a **4-module quiet zone**;
- automatic version selection;
- no manual mask override.

The canonical matrix records:

| Field | Meaning |
| --- | --- |
| `payload` | The exact string the user requested. |
| `version` | QR version chosen by the encoder. |
| `moduleCount` | Bare symbol size, excluding the quiet zone. |
| `quietZone` | 4 modules. |
| `size` | `moduleCount + quietZone * 2`. |
| `data` | `Uint8Array`, row-major, `1 = dark`, `0 = light`. |

Row 0 is the top row. Column 0 is the left column. The quiet zone is already present in `data`; it is not implicit padding added later.

The default URL produces version 3, a 29 × 29 bare symbol and a 37 × 37 matrix including the quiet zone.

Uploaded images are decoded locally with ZXing (`src/lib/qr/image.ts`) and the resulting text is placed in the payload field. The app does not preserve an uploaded bitmap as a texture; it re-encodes the decoded text into the canonical matrix, so the world and the verification use the same deterministic symbol.

---

## 2. Projection contract

`src/lib/qr/projector.ts` walks every column in `layout.cityRect`:

1. Map `(x, z)` to `(row, col)` using `worldToModule()`.
2. Read the expected value from the canonical matrix.
3. Read the **topmost non-air block** in that column.
4. Classify that block as `dark`, `light` or `neutral`.
5. Require the class to equal the module value.

For the default 192² site, this is **21,904 columns**: 148 × 148. Every module is exactly 4 × 4 columns. A report is accepted only when:

- `conflicts === 0`;
- the number of inspected columns equals `citySize²`;
- the software top-view decode also matches the payload.

### Why top surfaces only

QR readers see the top of the city. Vertical walls are visible from an angle, but they do not change the orthographic top-down scan. QR Craft therefore uses two palettes:

- **Top surfaces** (roofs, ground, parapets, battlements, plaza) use the dark/light material set of the module.
- **Vertical surfaces and foundations** use a stable structural palette so the result reads as architecture rather than a checkerboard.

Neutral materials are allowed in terrain outside the city, but a neutral or missing top block inside the city counts as a conflict.

### Finder landmarks

The three finder patterns are not painted flats. They are the footprints of the High Keep, East Bastion and Grand Cathedral. Their towers and roofs still obey the finder module classes on every top surface, which is why the finder pattern remains readable from above.

The quiet zone is reserved and rendered as light paving/perimeter. It is part of the matrix and part of the projected area.

---

## 3. Check A — software top projection (Node/Vitest)

`src/lib/qr/software-render.ts` is an independent reference renderer:

- It samples the actual top block of every column in and around the city.
- It rasterizes each block's representative colour at 2–12 pixels per block.
- It converts the result to luminance and passes it to ZXing.
- It requires the decoded text to equal `payload` exactly.

This check runs inside the generation worker, so a projection-conflicting world is rejected before the builder starts. It also runs in `src/tests/generation.test.ts` without a browser.

This is not a screenshot of the Three.js scene. It is a second, simpler renderer that proves the voxel projection itself is decodable. The live WebGL capture is a separate check.

---

## 4. Check B — live WebGL top view (browser)

`src/components/viewer/TopViewCertifier.tsx` runs inside the R3F scene:

1. Require `engine.state.status === "complete"`. A partial world fails immediately.
2. Hide scene objects marked `qrCaptureHide` (sky and any other capture-excluded decoration).
3. Remove fog, set a neutral background, disable tone mapping and force sRGB output.
4. Set the reveal uniform to the full plan so no planned block is hidden by the construction animation.
5. Render from an orthographic camera at Y = 330 into a **1536 × 1536** `WebGLRenderTarget`.
6. Read the pixels back and flip them from OpenGL bottom-up order to top-row-first.
7. Make a JPEG preview for the Verify panel (human inspection only; not used for decoding).
8. Derive four scan-scale images:
   - 512 × 512 (scale 1/3)
   - 448 × 448 (scale 0.2917)
   - 384 × 384 (scale 0.25)
   - 512 × 512 with a 1-pixel box blur
9. Decode each variant with ZXing's `MultiFormatReader`, `TRY_HARDER`, QR-only hints.
10. Require exact payload equality.
11. Restore scene background, fog, tone mapping, colour space, render target and hidden objects.

The camera framing includes the city, the 6-block esplanade and a little moat, not the whole world. This is the actual top view a reader sees.

### Why resampling is used

The app stores and displays the raw 1536² capture, but it does **not** rely on decoding that raw image. QR decoding is performed on the scan-scale variants above. High-quality downsampling approximates the optical size of a QR in a normal camera image and reduces the cost of ZXing's binarization. The conversion is applied to the actual rendered scene pixels; it is not a substitute QR texture, and the matrix is never injected into the image.

This distinction is important: the result is an optical decode of a rendered image, but the tested image is a resampled derivative of that render. The Verify panel says exactly that.

### Robustness count

The primary 512 variant is included in the four variants. `4 / 4 variants` therefore means all four scan scales (including the blurred one) decoded to the exact payload. It is not four independent camera angles.

---

## 5. Status ladder

`src/lib/qr/status.ts` defines the public statuses:

| Status | Set when | UI treatment |
| --- | --- | --- |
| **Not tested** | Initial state, or no complete world. | Neutral dot, no check. |
| **Matrix matched** | Projection has zero conflicts and the software top view decoded exactly. | Check for this step, but **not** `QR VERIFIED`. |
| **Rendered image decoded** | The live WebGL scan-scale capture decoded exactly, but at least one of the four variants failed. | `QR VERIFIED`, with the failure count and variant names. |
| **Robustness tests passed** | The live WebGL capture and all four scan-scale variants decoded exactly. | `QR VERIFIED`, with `4 / 4`. |
| **Certification failed** | Missing world, projection conflict, software decode failure, capture failure, decode failure, or payload mismatch. | Failure label, reason, no verified badge. |

`QR VERIFIED` is shown only for `rendered-decoded` or `robustness-passed`. The matrix-only state and the starting state never render the badge.

When a failure occurs after a previous success, the old capture and badge are cleared before the new attempt. The Verify panel only shows the latest state.

### Invalidation

Changing payload, seed, site, site size, style, quality or density:

- clears the certification object, including `QR VERIFIED` and the capture preview;
- marks the displayed world as stale;
- shows a note that the canvas is still the previous world;
- keeps the topbar payload tied to the world on screen, not the new draft.

The next generation starts from `Not tested` and proceeds through the ladder again.

---

## 6. Reproducing the checks

### Unit/integration

```bat
npm test
```

`src/tests/generation.test.ts` generates a 192² kingdom and asserts:

- zero projection conflicts;
- full coverage;
- software top-view decode succeeded;
- the decoded text equals the payload.

`src/tests/v2-regression.test.ts` repeats those gates across all **24 sites**, all **53 styles** and all **three quality tiers**, and checks that each style/site/tier produces a legal palette and a real construction plan.

`src/tests/blocks.test.ts` protects the material contract by rejecting unregistered block ids and materials whose luminance is too close across the dark/light divide.

### Browser acceptance

```bat
npm run test:smoke
```

The Playwright test:

- waits for construction to finish;
- waits for the verification request to complete;
- asserts `QR VERIFIED`;
- asserts payload match is `Exact`;
- asserts `4 / 4 variants`;
- asserts an `All … columns match` fact (21,904 on the default world);
- checks that the actual capture image is visible.

### Manual

1. Generate a world and let construction finish.
2. Open **Verify**.
3. Inspect the capture preview and the facts.
4. Click **Verify the live top view** to run it again.
5. Compare the topbar payload with the requested payload.

---

## 7. Limits and non-claims

QR Craft does **not** claim:

- that a physical print will scan in every lighting condition or from every angle;
- that a phone camera has been tested;
- that perspective, glare, motion blur, damage, or printing artifacts have been covered;
- that the QR is error-corrected beyond the encoder's level M settings;
- that a screenshot of the page or a cropped social-media image will decode;
- that arbitrary payloads are guaranteed; the encoder's size limits still apply.

What is claimed and tested:

- the world's top projection obeys the canonical matrix column by column;
- a real software raster of that projection decodes exactly;
- the live WebGL render, when resampled to standard scan sizes, decodes exactly;
- all four scan-scale variants used by the UI decode exactly on the acceptance payload;
- the UI never shows `QR VERIFIED` without a rendered-image decode.

ZXing is a decoder, not a legal certification authority. The status ladder describes what this application actually verified at the time shown.
