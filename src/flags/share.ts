/**
 * The flags share card: a 1200×675 paper-and-ink still of a finished run.
 * It reuses the canvas approach and palette of `src/share-card.ts` (that file
 * exports no colour tokens, so the values are redeclared here locally) but
 * needs no map — the score is the picture.
 */

import type { FlagResult } from "./engine";

const CARD_W = 1200;
const CARD_H = 675;

const PAPER = "#f4efe4";
const PAPER_LIFT = "#fffaf2";
const INK = "#241c14";
const MUTED = "#6b6156";
const LINE = "#d3c7b4";
const ACCENT = "#2f6b4f";

const MODE_LABEL: Record<FlagResult["mode"], string> = {
  full: "Full run",
  quick: "Quick round",
};

export async function renderFlagsShareCard(result: FlagResult): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // Canvas text falls back to system fonts if we cannot await them.
  }

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  paintPaper(ctx);
  paintFrame(ctx);
  paintCaption(ctx, result);
  paintScore(ctx, result);
  paintRing(ctx, result.score / Math.max(1, result.total) / 1000);
  paintFooter(ctx);

  return await toBlobPng(canvas);
}

function paintPaper(ctx: CanvasRenderingContext2D): void {
  const background = ctx.createLinearGradient(0, 0, 0, CARD_H);
  background.addColorStop(0, PAPER_LIFT);
  background.addColorStop(1, PAPER);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow = ctx.createRadialGradient(220, 80, 30, 220, 80, 760);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

function paintFrame(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  roundedRect(ctx, 40.5, 40.5, CARD_W - 81, CARD_H - 81, 28);
  ctx.stroke();
}

function paintCaption(ctx: CanvasRenderingContext2D, result: FlagResult): void {
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '800 22px Nunito, Verdana, sans-serif';
  paintSpaced(ctx, "BRAZIL · THE STATE FLAGS", 88, 128, 4.5);

  ctx.fillStyle = INK;
  ctx.font = '700 30px Nunito, Verdana, sans-serif';
  ctx.fillText(`${MODE_LABEL[result.mode]} · ${result.total} flags`, 88, 182);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(88, 216.5);
  ctx.lineTo(CARD_W - 88, 216.5);
  ctx.stroke();
}

function paintScore(ctx: CanvasRenderingContext2D, result: FlagResult): void {
  ctx.textAlign = "left";

  ctx.fillStyle = MUTED;
  ctx.font = '800 18px Nunito, Verdana, sans-serif';
  paintSpaced(ctx, "TOTAL SCORE", 88, 286, 3.5);

  const total = result.score.toLocaleString("en-US");
  ctx.fillStyle = INK;
  ctx.font = '700 164px Fraunces, Georgia, serif';
  ctx.fillText(total, 84, 446);
  const scoreWidth = ctx.measureText(total).width;

  ctx.fillStyle = MUTED;
  ctx.font = '800 44px Nunito, Verdana, sans-serif';
  ctx.fillText("pts", 88 + scoreWidth + 18, 446);

  ctx.fillStyle = result.correct === result.total ? ACCENT : INK;
  ctx.font = '700 34px Nunito, Verdana, sans-serif';
  ctx.fillText(`${result.correct} of ${result.total} named`, 88, 520);
}

function paintRing(ctx: CanvasRenderingContext2D, rawFraction: number): void {
  const centerX = 940;
  const centerY = 326;
  const radius = 136;
  const fraction = Math.min(1, Math.max(0, rawFraction));

  ctx.save();
  ctx.lineWidth = 12;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (fraction > 0) {
    ctx.strokeStyle = ACCENT;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * fraction,
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = '700 66px Fraunces, Georgia, serif';
  ctx.fillText(`${Math.round(fraction * 100)}%`, centerX, centerY + 18);

  ctx.fillStyle = MUTED;
  ctx.font = '700 20px Nunito, Verdana, sans-serif';
  ctx.fillText("of possible", centerX, centerY + 56);
}

function paintFooter(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '700 20px Nunito, Verdana, sans-serif';
  ctx.fillText("thecounties.vercel.app/brazil-flags", 88, 600);
}

/** Canvas letter-spacing is not portable, so draw the characters ourselves. */
function paintSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  gap: number,
): void {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + gap;
  }
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
