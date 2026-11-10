/**
 * The share card: a raster snapshot of the finished map plus a caption line,
 * returned as a PNG blob for Web Share, the clipboard, or a plain download.
 *
 * The map is serialised in place — geometry as `d` attributes with fills
 * already set inline, plus the computed presentation styles copied across so
 * the clone keeps its dressed state (label visibility, group stroke colours)
 * without pulling the stylesheet into the <img> context.
 */

const CARD_W = 1200;
const CARD_H = 675;

const PAPER = "#f4efe4";
const PAPER_LIFT = "#fffaf2";
const INK = "#241c14";
const MUTED = "#6b6156";
const LINE = "#d3c7b4";
const OCEAN_GLOW = "#eef4ee";
const OCEAN = "#d9e4dc";

/** Presentation properties worth copying; lifecycle bits (transitions, filters,
 *  transforms) are left behind so the card captures the settled state. */
const COPY_PROPS = [
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linejoin",
  "stroke-linecap",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
] as const;

const CARD_INK = { r: 36, g: 28, b: 20 };

export type ShareCardOptions = {
  svg: SVGSVGElement;
  title: string;
  subtitle: string;
  footer: string;
};

export async function renderShareCard(options: ShareCardOptions): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // Canvas text falls back to system fonts if we cannot await them.
  }

  const viewBox = (options.svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  const mapW = viewBox[2];
  const mapH = viewBox[3];
  if (!mapW || !mapH) throw new Error("Map is not ready.");

  const source = inlineClone(options.svg, mapW, mapH);
  const image = await decodeAnSvg(serialize(source));

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  paintPaper(ctx);
  paintCaption(ctx, options.title, options.subtitle);
  paintMap(ctx, options.footer, supersample(image, mapW, mapH), mapW, mapH);

  return await toBlobPng(canvas);
}

/** Rasterise the map at double resolution so hairline strokes survive the
 *  downscale into the card without reading as grit. */
function supersample(
  image: HTMLImageElement,
  mapW: number,
  mapH: number,
): HTMLCanvasElement {
  const oversampled = document.createElement("canvas");
  oversampled.width = Math.round(mapW * 2);
  oversampled.height = Math.round(mapH * 2);
  const overCtx = oversampled.getContext("2d");
  if (!overCtx) throw new Error("Canvas is unavailable.");
  overCtx.drawImage(image, 0, 0, oversampled.width, oversampled.height);
  return oversampled;
}

export function copyPng(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return Promise.resolve(false);
  }
  const item = new ClipboardItem({ "image/png": blob });
  return navigator.clipboard
    .write([item])
    .then(() => true)
    .catch(() => false);
}

export function downloadShareCard(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function shareableFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: "image/png" });
}

/* ---------------------------------------------------------------- builders */

function inlineClone(svg: SVGSVGElement, width: number, height: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  copyComputedStyles(svg, clone);
  return clone;
}

function copyComputedStyles(source: Element, target: Element): void {
  const sourceStyle = window.getComputedStyle(source);
  let inline = "";
  for (const prop of COPY_PROPS) {
    const value = sourceStyle.getPropertyValue(prop);
    if (value) inline += `${prop}:${value};`;
  }
  if (source instanceof SVGPathElement && source.classList.contains("county")) {
    // A country's ink should follow its own fill in the still image: the UI's
    // near-black interactive hairline reads as grit on thin shapes at card scale.
    const blended = mixColor(sourceStyle.getPropertyValue("fill"), CARD_INK, 0.3);
    if (blended) inline = inline.replace(/stroke:rgb\([^;]*\);/, `stroke:${blended};`);
  }
  if (inline) target.setAttribute("style", inline);

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < Math.min(sourceChildren.length, targetChildren.length); i += 1) {
    copyComputedStyles(sourceChildren[i]!, targetChildren[i]!);
  }
}

function mixColor(
  value: string,
  into: { r: number; g: number; b: number },
  amount: number,
): string | null {
  const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if (!match) return null;
  const blend = (channel: string, target: number) =>
    Math.round(Number(channel) + (target - Number(channel)) * amount);
  return `rgb(${blend(match[1]!, into.r)}, ${blend(match[2]!, into.g)}, ${blend(match[3]!, into.b)})`;
}

async function decodeAnSvg(blob: Blob): Promise<HTMLImageElement> {
  return await decodeImage(URL.createObjectURL(blob));
}

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the map."));
    image.src = url;
  });
}

function serialize(svg: SVGSVGElement): Blob {
  const text = new XMLSerializer().serializeToString(svg);
  return new Blob([text], { type: "image/svg+xml;charset=utf-8" });
}

/* ---------------------------------------------------------------- painting */

function paintPaper(ctx: CanvasRenderingContext2D): void {
  const background = ctx.createLinearGradient(0, 0, 0, CARD_H);
  background.addColorStop(0, PAPER_LIFT);
  background.addColorStop(1, PAPER);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

function paintCaption(ctx: CanvasRenderingContext2D, title: string, subtitle: string): void {
  ctx.fillStyle = INK;
  ctx.font = '700 58px Fraunces, Georgia, serif';
  ctx.textAlign = "left";
  ctx.fillText(title, 48, 96);

  ctx.fillStyle = MUTED;
  ctx.font = '800 27px Nunito, Verdana, sans-serif';
  ctx.fillText(subtitle, 50, 150);
}

function paintMap(
  ctx: CanvasRenderingContext2D,
  footer: string,
  image: HTMLCanvasElement,
  mapW: number,
  mapH: number,
): void {
  const round = 20;
  const x = 44;
  const y = 182;
  const w = CARD_W - 88;
  const h = CARD_H - y - 56;

  ctx.save();
  roundedRect(ctx, x, y, w, h, round);
  ctx.clip();

  const ocean = ctx.createRadialGradient(
    x + w / 2,
    y + h * 0.42,
    80,
    x + w / 2,
    y + h * 0.42,
    Math.max(w, h) * 0.75,
  );
  ocean.addColorStop(0, OCEAN_GLOW);
  ocean.addColorStop(1, OCEAN);
  ctx.fillStyle = ocean;
  ctx.fillRect(x, y, w, h);

  const scale = Math.min(w / mapW, h / mapH);
  const dw = mapW * scale;
  const dh = mapH * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, round);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '700 21px Nunito, Verdana, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(footer, CARD_W - 48, CARD_H - 24);
  ctx.textAlign = "left";
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toBlobPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the card."));
    }, "image/png");
  });
}
