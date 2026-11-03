"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { decodeRgbaImage, type RgbaImage } from "@/lib/qr/image";
import type { SiteLayout } from "@/lib/world/site";
import type { GeneratedWorldTransfer } from "@/lib/worker/protocol";
import { revealState, revealUniform } from "@/lib/render/reveal";
import { useQrCraft } from "@/state/useQrCraft";

const CAPTURE_SIZE = 1536;

interface Variant {
  label: string;
  image: RgbaImage;
}

function flipRows(pixels: Uint8Array, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const stride = width * 4;
  for (let row = 0; row < height; row++) {
    const source = (height - 1 - row) * stride;
    data.set(pixels.subarray(source, source + stride), row * stride);
  }
  return { width, height, data };
}

function scaleImage(image: RgbaImage, scale: number): RgbaImage {
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) throw new Error("Canvas 2D is unavailable for certification.");
  const sourceData = new ImageData(
    new Uint8ClampedArray(image.data),
    image.width,
    image.height,
  );
  sourceContext.putImageData(sourceData, 0, 0);
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable for certification.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height);
  return { width, height, data: data.data };
}

function blurImage(image: RgbaImage, radius = 1): RgbaImage {
  const { width, height } = image;
  const source = image.data;
  const output = new Uint8ClampedArray(source.length);
  const diameter = radius * 2 + 1;
  const area = diameter * diameter;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = Math.max(0, Math.min(height - 1, y + dy));
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.max(0, Math.min(width - 1, x + dx));
          const index = (yy * width + xx) * 4;
          r += source[index];
          g += source[index + 1];
          b += source[index + 2];
        }
      }
      const index = (y * width + x) * 4;
      output[index] = r / area;
      output[index + 1] = g / area;
      output[index + 2] = b / area;
      output[index + 3] = 255;
    }
  }
  return { width, height, data: output };
}

function variantsFor(base: RgbaImage): Variant[] {
  const scan = scaleImage(base, 1 / 3);
  return [
    { label: "512 px scan scale", image: scan },
    { label: "448 px scan scale", image: scaleImage(base, 0.2917) },
    { label: "384 px scan scale", image: scaleImage(base, 0.25) },
    { label: "512 px scan scale with 1px blur", image: blurImage(scan, 1) },
  ];
}

function previewDataUrl(image: RgbaImage): string | null {
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    const source = document.createElement("canvas");
    source.width = image.width;
    source.height = image.height;
    const sourceContext = source.getContext("2d");
    if (!sourceContext) return null;
    sourceContext.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}

/**
 * Renders the live scene from an orthographic top camera into an offscreen
 * render target, reads the pixels back, and decodes them with ZXing. This is the
 * only code path allowed to promote a world to "QR VERIFIED".
 */
export function TopViewCertifier({
  result,
  layout,
}: {
  result: GeneratedWorldTransfer;
  layout: SiteLayout;
}) {
  const { gl, scene } = useThree();
  const requestId = useQrCraft((state) => state.certificationRequestId);
  const lastRequest = useRef(-1);
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(CAPTURE_SIZE, CAPTURE_SIZE, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.SRGBColorSpace,
      }),
    [],
  );

  useEffect(() => () => target.dispose(), [target]);

  useEffect(() => {
    if (requestId <= 0 || requestId === lastRequest.current) return;
    lastRequest.current = requestId;
    let cancelled = false;

    const run = async () => {
      const store = useQrCraft.getState();
      const engine = store.engine;
      if (!engine || engine.state.status !== "complete") {
        store.setCertification({
          ...store.certification,
          status: "failed",
          message: "Certification failed: construction has not finished, so the top view is incomplete.",
          payloadMatched: false,
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      store.setCertifying(true);
      store.setCertification({
        ...store.certification,
        message: "Rendering the live WebGL top view and decoding it with ZXing...",
      });

      // One paint first, so the UI can show the certification state.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (cancelled) return;

      const hidden: THREE.Object3D[] = [];
      const oldBackground = scene.background;
      const oldFog = scene.fog;
      const oldToneMapping = gl.toneMapping;
      const oldColorSpace = gl.outputColorSpace;
      const renderTarget = gl.getRenderTarget();
      try {
        scene.traverse((object) => {
          if (object.userData?.qrCaptureHide && object.visible) {
            object.visible = false;
            hidden.push(object);
          }
        });
        scene.background = new THREE.Color("#e6e2d7");
        scene.fog = null;
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        revealState.applied = result.plan.totalBlocks;
        revealUniform.value = result.plan.totalBlocks;

        const half = Math.min(
          layout.worldSize / 2,
          (layout.citySize + layout.esplanadeWidth * 2 + 10) / 2,
        );
        const cx = Math.min(
          layout.worldSize - half,
          Math.max(half, layout.centerX + 0.5),
        );
        const cz = Math.min(
          layout.worldSize - half,
          Math.max(half, layout.centerZ + 0.5),
        );
        const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 700);
        camera.position.set(cx, 330, cz);
        camera.up.set(0, 0, -1);
        camera.lookAt(cx, 0, cz);
        camera.updateMatrixWorld(true);

        gl.setRenderTarget(target);
        gl.clear();
        gl.render(scene, camera);
        const pixels = new Uint8Array(CAPTURE_SIZE * CAPTURE_SIZE * 4);
        gl.readRenderTargetPixels(target, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE, pixels);
        gl.setRenderTarget(renderTarget);
        const image = flipRows(pixels, CAPTURE_SIZE, CAPTURE_SIZE);
        const captureDataUrl = previewDataUrl(image);

        const variants = variantsFor(image);
        const decoded = variants.map((variant) => ({
          label: variant.label,
          result: decodeRgbaImage(variant.image),
        }));
        const native = decoded[0].result;
        const robustnessPassed = decoded.filter(
          (entry) => entry.result.decoded && entry.result.text === result.qr.payload,
        ).length;

        if (!native.decoded) {
          if (!cancelled) {
            store.setCertification({
              status: "failed",
              message: `Certification failed: the WebGL top view could not be decoded (${native.error ?? "no QR found"}).`,
              payloadMatched: false,
              renderedWidth: CAPTURE_SIZE,
              renderedHeight: CAPTURE_SIZE,
              robustnessPassed,
              robustnessTotal: decoded.length,
              checkedAt: new Date().toISOString(),
              captureDataUrl,
            });
          }
          return;
        }

        if (native.text !== result.qr.payload) {
          if (!cancelled) {
            store.setCertification({
              status: "failed",
              message:
                "Certification failed: the rendered image decoded, but its payload differs from the requested QR payload.",
              payloadMatched: false,
              renderedWidth: CAPTURE_SIZE,
              renderedHeight: CAPTURE_SIZE,
              robustnessPassed,
              robustnessTotal: decoded.length,
              checkedAt: new Date().toISOString(),
              captureDataUrl,
            });
          }
          return;
        }

        if (!cancelled) {
          const failedVariants = decoded.filter(
            (entry) => !entry.result.decoded || entry.result.text !== result.qr.payload,
          );
          const allPassed = failedVariants.length === 0;
          store.setCertification({
            status: allPassed ? "robustness-passed" : "rendered-decoded",
            message: allPassed
              ? `The live WebGL top view decoded exactly, and all ${decoded.length} robustness variants decoded to the same payload.`
              : `The live WebGL top view decoded exactly. ${robustnessPassed} of ${decoded.length} robustness variants passed; failed: ${failedVariants
                  .map((entry) => entry.label)
                  .join(", ")}.`,
            payloadMatched: true,
            renderedWidth: CAPTURE_SIZE,
            renderedHeight: CAPTURE_SIZE,
            robustnessPassed,
            robustnessTotal: decoded.length,
            checkedAt: new Date().toISOString(),
            captureDataUrl,
          });
        }
      } catch (error) {
        if (!cancelled) {
          store.setCertification({
            status: "failed",
            message: `Certification failed while capturing the WebGL top view: ${
              error instanceof Error ? error.message : String(error)
            }`,
            payloadMatched: false,
            renderedWidth: null,
            renderedHeight: null,
            robustnessPassed: 0,
            robustnessTotal: 0,
            checkedAt: new Date().toISOString(),
          });
        }
      } finally {
        gl.setRenderTarget(renderTarget);
        gl.toneMapping = oldToneMapping;
        gl.outputColorSpace = oldColorSpace;
        scene.background = oldBackground;
        scene.fog = oldFog;
        for (const object of hidden) object.visible = true;
        if (!cancelled) store.setCertifying(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [gl, layout, requestId, result, scene, target]);

  return null;
}
