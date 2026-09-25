import { brazilPack } from "./brazil";
import { startPack } from "./engine";
import { europePack } from "./europe";
import { irelandPack } from "./ireland";
import type { Pack } from "./types";

const PACKS: Record<string, Pack> = {
  ireland: irelandPack,
  brazil: brazilPack,
  europe: europePack,
};

function packFromPath(): Pack {
  const slug = location.pathname.replace(/\/+$/, "").split("/").pop()?.replace(/\.html$/, "") ?? "";
  return PACKS[slug] ?? irelandPack;
}

startPack(packFromPath());
