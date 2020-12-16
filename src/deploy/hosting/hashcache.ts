import * as fs from "fs-extra";
import * as path from "path";
import * as logger from "../../logger";

function cachePath(cwd: string, name: string): string {
  return path.resolve(cwd, ".firebase/hosting." + name + ".cache");
}

export type HashCacheEntry = { mtime: number; hash: string };
export type HashCache = Map<string, HashCacheEntry>;

export function load(cwd: string, name: string): HashCache {
  try {
    const out: HashCache = new Map();
    const lines = fs.readFileSync(cachePath(cwd, name), {
      encoding: "utf8",
    });
    lines.split("\n").forEach((line) => {
      const d = line.split(",");
      if (d.length === 3) {
        out.set(d[0], { mtime: parseInt(d[1]), hash: d[2] });
      }
    });
    return out;
  } catch (e) {
    if (e.code === "ENOENT") {
      logger.debug(`[hosting] hash cache [${name}] not populated`);
    } else {
      logger.debug(`[hosting] hash cache [${name}] load error:`, e.message);
    }
    return new Map();
  }
}

export function dump(cwd: string, name: string, data: Map<string, HashCacheEntry>): void {
  let st = "";
  let count = 0;
  for (const [path, d] of Object.entries(data)) {
    count++;
    st += `${path},${d.mtime},${d.hash}\n`;
  }
  try {
    fs.outputFileSync(cachePath(cwd, name), st, { encoding: "utf8" });
    logger.debug(`[hosting] hash cache [${name}] stored for ${count} files`);
  } catch (e) {
    logger.debug(`[hosting] unable to store hash cache [${name}]`, e.stack);
  }
}
