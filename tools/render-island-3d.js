#!/usr/bin/env node
// ============================================================
// tools/render-island-3d.js — the whole island in 3D, from its own data
//
//   node tools/render-island-3d.js                    (every view)
//   node tools/render-island-3d.js overview mountain  (just these)
//
// Builds a three.js scene in the pre-installed Chromium:
//   - the ground: island-terrain/ground.f32, true scale, with island-map.html
//     draped over it (roads, fields, docks, names)
//   - the tall buildings: island-buildings/buildings.json, real footprints and heights
//   - houses and low buildings, and the trees: read off island-map.html and stood up
//   - bridges: every road piece (island-roads + island-bridges ymaps) well above the
//     ground or over the sea, as a deck, with piers down to the water
// Writes island-poster/renders/island-3d-<view>.png (2400 x 1350).
// three.js is tools/vendor (MIT). Needs Playwright + Chromium, like the other renders.
// ============================================================
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { chromium } = require("playwright");

const REPO = path.resolve(__dirname, "..");
const OUT = path.join(REPO, "island-poster", "renders");
// camera per view, relative to `centre` (world X/Y); three.js axes: x east, y up, z south
const VIEWS = {
  overview: { centre: [-3680, -6500], cam: [0, 6900, 6100], look: [0, 0, -420] },
  mountain: { centre: [-5500, -6500], cam: [900, 1500, 2900], look: [-150, 160, -250] },
  east:     { centre: [-430, -7280], cam: [-1450, 1300, 2000], look: [150, 0, -150] },
};
const want = process.argv.slice(2).filter((v) => VIEWS[v]);
const views = want.length ? want : Object.keys(VIEWS);

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "island-3d-"));
  const grid = JSON.parse(fs.readFileSync(path.join(REPO, "island-terrain/road-guide.json"), "utf8"));
  fs.copyFileSync(path.join(REPO, "island-terrain/ground.f32"), path.join(work, "ground.f32"));
  fs.copyFileSync(path.join(REPO, "island-terrain/road-guide.json"), path.join(work, "grid.json"));
  fs.copyFileSync(path.join(REPO, "island-buildings/buildings.json"), path.join(work, "buildings.json"));
  fs.copyFileSync(path.join(__dirname, "vendor/three-0.149.0.min.js"), path.join(work, "three.min.js"));
  fs.copyFileSync(path.join(__dirname, "render-island-3d.page.html"), path.join(work, "scene.html"));

  // ---- road pieces: position + the piece's forward (+Y) from each ymap entity (rotations are stored inverted)
  const pieces = [];
  for (const dir of ["island-roads/xml", "island-bridges/xml"]) {
    for (const f of fs.readdirSync(path.join(REPO, dir)).filter((f) => f.endsWith(".ymap.xml"))) {
      const xml = fs.readFileSync(path.join(REPO, dir, f), "utf8");
      for (const m of xml.matchAll(/<position x="([-\d.]+)" y="([-\d.]+)" z="([-\d.]+)" \/>\s*<rotation x="([-\d.]+)" y="([-\d.]+)" z="([-\d.]+)" w="([-\d.]+)" \/>/g)) {
        const [x, y, z] = [+m[1], +m[2], +m[3]], qx = -m[4], qy = -m[5], qz = -m[6], qw = +m[7];
        pieces.push([x, y, z, 2 * (qx * qy - qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qw * qx)]);
      }
    }
  }
  fs.writeFileSync(path.join(work, "pieces.json"), JSON.stringify(pieces));

  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  // ---- the map, top down, over exactly the terrain grid; plus the houses and trees to stand up
  const toMap = (wx, wy) => [750 + (wx + 5500) / 2, 500 - (wy + 6500) / 2];
  const [mx0, my1] = toMap(grid.x0, grid.y0), [mx1, my0] = toMap(grid.x0 + grid.cols * grid.spacing, grid.y0 + grid.rows * grid.spacing);
  const scale = Math.min(1.6, 8000 / (mx1 - mx0));                     // keep the texture under 8192 px
  const TW = Math.round((mx1 - mx0) * scale), TH = Math.round((my1 - my0) * scale);
  const mp = await browser.newPage({ viewport: { width: TW, height: TH } });
  await mp.goto("file://" + path.join(REPO, "island-map.html"));
  const feats = await mp.evaluate(([vb, W, H]) => {
    const s = document.querySelector("svg#island");
    s.setAttribute("viewBox", vb); s.setAttribute("preserveAspectRatio", "none");
    Object.assign(s.style, { position: "fixed", left: 0, top: 0, width: W + "px", height: H + "px", zIndex: 99999, background: "#1d5a86" });
    s.classList.add("z-main");
    const out = { houses: [], trees: [] };
    const rot = (el) => { const m = (el.getAttribute("transform") || "").match(/rotate\(([-\d.]+)/); return m ? +m[1] : 0; };
    for (const gid of ["buildings", "houses-1017", "city-312"]) {
      const g = document.getElementById(gid); if (!g) continue;
      for (const r of g.querySelectorAll("rect")) {
        const x = +r.getAttribute("x"), y = +r.getAttribute("y"), w = +r.getAttribute("width"), h = +r.getAttribute("height");
        if (!(w > 0 && h > 0) || w * h > 4000) continue;
        out.houses.push({ x: x + w / 2, y: y + h / 2, w, h, a: rot(r), c: r.getAttribute("fill"), g: gid });
      }
    }
    for (const c of document.querySelectorAll("g.woods circle"))
      out.trees.push({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy"), r: +c.getAttribute("r"), c: c.getAttribute("fill") });
    return out;
  }, [`${mx0} ${my0} ${mx1 - mx0} ${my1 - my0}`, TW, TH]);
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: path.join(work, "map.jpg"), type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: TW, height: TH } });
  await mp.close();
  fs.writeFileSync(path.join(work, "features.json"), JSON.stringify(feats));
  console.log(`map ${TW}x${TH}; ${feats.houses.length} houses, ${feats.trees.length} trees, ${pieces.length} road pieces`);

  // ---- serve the work folder (the page fetches its data), render each view
  const server = http.createServer((req, res) => {
    const f = path.join(work, path.basename(decodeURIComponent(req.url.split("?")[0])));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200); fs.createReadStream(f).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/scene.html`;
  fs.mkdirSync(OUT, { recursive: true });
  for (const v of views) {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1350 } });
    page.on("pageerror", (e) => console.error(`  ${v}: ${e.message}`));
    await page.goto(url);
    await page.evaluate((o) => window.render(o), { w: 2400, h: 1350, exaggerate: 1.0, fov: 38, ...VIEWS[v] });
    const file = path.join(OUT, `island-3d-${v}.png`);
    await page.screenshot({ path: file });
    await page.close();
    console.log(`  ${path.relative(REPO, file)}`);
  }
  server.close(); await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
