# fourtune-island

The Fourtune island for GTA V / FiveM: the map, the ground, every road and bridge, and the
buildings, all generated from one set of scripts. It's the island half of
[tanner-and-haydens-fourtune](https://github.com/Tgood91/tanner-and-haydens-fourtune), which keeps
the gameplay (jobs, economy, inventory and the rest). This repo started from that repo's `main` at
commit `b96301e`.

## The island

- **312** (Chicago) in the north: the port city, Foundry Flats, Bayfront.
- **770** (GeePee) in the middle: farm country round the mountain (~800 m), the west woods,
  Pine Hollow, Hollow Creek Lumber Yard.
- **1017** (Atlanta) in the south and east: the towers, the airport, Eastgate, Saltwater Strand,
  and the east expansion, Peachtree East and Birdsong (77 streets).
- 241 named roads, every junction level bar a handful the generator lists, a bridge over the
  harbour channel, and The Island Bridge to Los Santos (landing point still to be set).

Open `island-map.html` in a browser to explore it.

## Rebuilding

Everything is generated. Change a script or the data, then run, in this order:

```
python3 tools/gen-island-map.py > island-map.html   # the map: coast, roads, buildings, names
python3 tools/gen-world-map-nui.py                    # the in-game map page (world-map/)
python3 tools/gen-island-terrain.py                   # the ground, AND the road + bridge ymaps
node tools/gen-island-buildings.js                    # the buildings, on that ground
node tools/render-streets.js                          # street-renders/ and world/streets_geo.lua
python3 tools/gen-island-streets.py                   # island-streets/data.lua
```

Needs Python 3 with numpy, and Node with Playwright + Chromium. The street renders aren't
deterministic, so rerunning them changes images that didn't really change; only commit the ones
for roads you touched.

## What's here

| folder | what |
|---|---|
| `island-terrain/` | the ground (FiveM resource) |
| `island-roads/` | the road surface (FiveM resource) |
| `island-bridges/` | The Island Bridge to Los Santos (FiveM resource) |
| `island-buildings/` | the buildings |
| `island-streets/` | street names on the HUD, signs at junctions, pause-map blips (FiveM resource) |
| `world-map/` | the in-game map page (FiveM resource) |
| `street-renders/` | one image per street, plus `streets.json` |
| `island-poster/` | poster renders |
| `js-snippets/places.js`, `cities.js` | the game's street data, copied from the gameplay repo: the island's 770/312/1017 streets are fitted from it. Keep it in step with that repo. |
| `world/streets_geo.lua` | output for the gameplay repo's `world` resource |

Each FiveM resource's README says how to turn its XML/OBJ into game files (CodeWalker, Blender +
Sollumz). Nothing has run inside FXServer yet.
