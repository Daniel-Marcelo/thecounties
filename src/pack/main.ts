import { brazilPack } from "./brazil";
import { asiaPack } from "./asia";
import { startPack } from "./engine";
import { europePack } from "./europe";
import { irelandPack } from "./ireland";
import { southAmericaPack } from "./south-america";
import type { Pack } from "./types";

const PACKS: Record<string, Pack> = {
  ireland: irelandPack,
  brazil: brazilPack,
  europe: europePack,
  "south-america": southAmericaPack,
  asia: asiaPack,
};

function packFromPath(): Pack {
  const slug = location.pathname.replace(/\/+$/, "").split("/").pop()?.replace(/\.html$/, "") ?? "";
  return PACKS[slug] ?? irelandPack;
}

startPack(packFromPath());
