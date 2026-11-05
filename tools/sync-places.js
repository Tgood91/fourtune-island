#!/usr/bin/env node
// ============================================================
// sync-places.js — copy the game's street data in from the gameplay repo
//
//   node tools/sync-places.js                 (copy js-snippets/places.js and cities.js in)
//   node tools/sync-places.js --dry-run       (say what would change, copy nothing)
//   node tools/sync-places.js --regen         (copy, then rebuild the whole island from them)
//   node tools/sync-places.js --game "<path>" (where tanner-and-haydens-fourtune is)
//
// The island map fits its 312 / 770 / 1017 streets from those two files, so whenever streets
// change in the gameplay repo, copy them here and regenerate. The gameplay repo is found from
// --game, FOURTUNE_GAME, or ../tanner-and-haydens-fourtune (next to this repo).
//
// Afterwards, in the gameplay repo, `node tools/sync-from-island.js` takes the regenerated
// street list and in-game map page back.
// ============================================================
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const regen = args.includes("--regen");
const i = args.indexOf("--game");
const given = (i >= 0 && args[i + 1]) || process.env.FOURTUNE_GAME;
const GAME = path.resolve((given || path.join(REPO, "..", "tanner-and-haydens-fourtune")).replace(/^~(?=$|[\\/])/, os.homedir()));

if (!fs.existsSync(path.join(GAME, "js-snippets", "places.js"))) {
    console.error(`\n✗ No tanner-and-haydens-fourtune checkout at ${GAME}\n  Clone it next to this repo, or pass --game "<path>".`);
    process.exit(1);
}

let changed = 0;
for (const f of ["js-snippets/places.js", "js-snippets/cities.js"]) {
    const from = path.join(GAME, f), to = path.join(REPO, f);
    const same = fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to));
    console.log(`  ${same ? "same    " : "update  "} ${f}`);
    if (!same) { changed++; if (!dryRun) fs.copyFileSync(from, to); }
}
// places.js only needs ./cities; anything else it starts requiring has to come too
const needs = [...fs.readFileSync(path.join(GAME, "js-snippets", "places.js"), "utf8").matchAll(/require\(["']\.\/([^"']+)["']\)/g)].map((m) => m[1].replace(/\.js$/, ""));
const missing = needs.filter((n) => n !== "cities");
if (missing.length) console.warn(`  ! places.js now also requires ${missing.join(", ")}: copy those too, or the map won't build`);

if (dryRun) { console.log("\nDry run — nothing copied."); process.exit(0); }
if (!changed) { console.log("\n✓ Already in step."); if (!regen) process.exit(0); }
else console.log(`\n✓ ${changed} file(s) copied.`);

const STEPS = [
    ["python3", ["tools/gen-island-map.py"], "island-map.html"],
    ["python3", ["tools/gen-world-map-nui.py"]],
    ["python3", ["tools/gen-island-terrain.py"]],
    ["node", ["tools/gen-island-buildings.js"]],
    ["node", ["tools/render-streets.js"]],
    ["python3", ["tools/gen-island-streets.py"]],
];
if (!regen) {
    console.log("\nNow rebuild the island (or rerun with --regen):");
    for (const [cmd, a, out] of STEPS) console.log(`  ${cmd} ${a.join(" ")}${out ? ` > ${out}` : ""}`);
    process.exit(0);
}
console.log("\nRebuilding the island...");
for (const [cmd, a, out] of STEPS) {
    console.log(`  ${cmd} ${a.join(" ")}${out ? ` > ${out}` : ""}`);
    const res = execFileSync(cmd === "python3" && process.platform === "win32" ? "python" : cmd, a, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 28 });
    if (out) fs.writeFileSync(path.join(REPO, out), res);
}
console.log("\n✓ Rebuilt. The street renders change on every run: commit only the ones for roads that changed.");
