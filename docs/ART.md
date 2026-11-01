# Art pipeline and status

## Source
All creature art comes from the creator's **Helado Region Fakedex** Scratch project
(`Helado_Region_Fakedex.sb3`, DEX sprite: 156 costumes).

`scripts/art/build_art.py` (run with `npm run art -- path/to/Helado_Region_Fakedex.sb3`):
1. Reads `project.json` and every DEX costume SVG straight from the `.sb3` (a zip).
2. Removes the Fakedex page furniture: name banner, ability/evolution notes, type icons
   (recording the detected types in `src/cards/fakedex-catalog.json`), legend title strips and
   grey pre-evolution sketch outlines.
3. Renders at 3× with `rsvg-convert`, cleans stray fragments by connected-component analysis,
   trims, and writes transparent WebP files (max 640 px) to `public/art/creatures/<key>.webp`.

The creatures themselves are **not redrawn**: anatomy, colours and defining features are
exactly the creator's.

### Excluded from the game
- **23 "regional forms"** (separate REGIONAL FORMS sprite: Roserade, Skitty, Buizel, Spinarak,
  Larvesta, Volcarona, Oddish line, Magby/Magmar, Sableye, Mawile, Roggenrola/Boldore, Tangela,
  Krookodile, Tinkaton, Applin, Frozeila, Apiom). These are variants of existing franchise
  creatures, so they are excluded to keep all IP original.
- **Dupedillo and Trikglypt**: their designs are built on a franchise ball trademark.

The 133 original creatures are processed. **74 appear on cards today**; the other 59 are ready
for future expansions:

mollslip, octooroot, vampost, rhearushie, hawchop, terraxgryff, hummhungi, snacockatoo, cramclam,
alpetal, precipax, moldiwoldi, oorcute, oorcanium, mr_squeeto, crystug, gemgoalie, guzzlegum,
vultaunt, messea, goriara, spilliq, primaltar, bataya, camapact, invisishy, luchacon, flappilil,
flappigant, catoddle, catitan, coatiboa, shrimple, lobstrvern, treflex, xelercroak, luchaphib,
dragobone, drakavera, swashchattr, amurandes, losbihyena, jalamagma, foodfetchd, velcatty, lurkzel,
magmercury, cypearls, malevor, gravilith, tangrey, nukoloco, pantheory, sunnymind, slothu, bakothai,
guaripsychi, wispiwind, wispiwick

## What the cards use

| Element | How it is made | Status |
|---|---|---|
| Creature illustrations | Creator's Fakedex art composited onto a scene | ✅ Final source art |
| Scenes (15: meadow, volcano, reef, storm, aurora, canyon, grotto, foundry, sky ruins, parlor, glacier, starfield, eclipse, nebula, sunburst) | Procedural SVG (`src/ui/art/Scene.tsx`) | ✅ Original; could be upgraded to painted backgrounds |
| Card frames, Prime frames, full-art layouts, foils (holo/rainbow/cosmic/gold), rarity glows | CSS/SVG (`src/ui/Card.tsx`, `src/index.css`) | ✅ |
| Item / Tool / Terrain illustrations (24) | Hand-built vector art (`src/ui/art/Illustration.tsx`) | ✅ Original vector art |
| **Supporter portraits (9)**: Doña Nieve, Coach Rocky, Scout Menta, Ranger Tamarindo, Chef Horchata, Poacher Paleta, Astronomer Nuez, Archivist Vainilla, Captain Pistacho | Stylised emblem busts (vector) | ⚠️ **Pending bespoke character illustrations.** The emblems are functional placeholders. |
| Pack art (3) | Composited featured creatures + scene + foil | ✅ |
| Card back, logo, favicon | Vector | ✅ |

No image-generation capability was available while building this, so no AI-generated
illustrations are included and none of the art is presented as something it is not. To upgrade
any illustration, add an image and point the card's `art` field at it. For Supporters, extend
`Illustration.tsx` to render an image when one exists for that key.
