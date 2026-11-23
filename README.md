# On Two Feet

An open-world, cinematic 2D sandbox. You are a ragdoll that falls out of the sky as a seed of light, learns to stand, and then makes an endless world its own: you dig and build, meet the people who keep its shrines, raise a home, and walk through gate after gate held by stronger and stronger wardens. Every warden you beat leaves a mark on your body, so no two players end up looking alike.

Pure HTML5 and vanilla JavaScript (ES modules). No build step, no runtime dependencies. All art is drawn in code, every sound is synthesized, fonts and PeerJS are vendored. CrazyGames SDK v3 is wrapped and fully guarded.

To play locally, serve the folder (for example `python3 -m http.server`) and open `index.html`.

## The story

Before the world, there was a needle and a thread. The Seamstress stitched the land, and dolls to walk it. Then she vanished; her needles became the Wardens and shut every gate, and the dolls forgot how to stand. You are the last doll, born from the last falling thread of her light. Thread, her final living stitch, climbs out of your chest to guide you. Walk through every gate, take her light back from the Wardens, and finish the world yourself.

## The first minute (the hook)

No loading screen, no menu. The game opens mid-fall:

1. **Seconds 0–10: the fall.** You are already plummeting through a dusk sky, steering left and right to catch motes of light (each one is glimmer) while four lines of lore are told over the wind, clouds and speed lines.
2. **The impact.** Slow motion, white-out, a shockwave across the meadow, and your body tumbles physically across the grass.
3. **Getting up.** Thread climbs out of your chest: *"Up. You have to get up."* Two presses and the ragdoll pushes onto a knee, then stands. A Warden roars somewhere far away, a horned giant watches from the horizon, and the title card lands.
4. **A short tutorial** (a slim banner at the top, skippable, with the right keys or touch buttons shown): walk, jump, take the blade, strike a straw training doll, dash, break a block, place it. Then the first Hollow claws out of the ground.
5. **A clear chain of goals** (always shown top left, and Thread flies ahead to point the way): reach the shrine, rest, gather Threads of Light, then face the Hollow Warden, make a home, walk on.

The first boss is about 220 tiles away and its gate stays sealed until you carry enough Threads of Light, so the opening is exploration, not a boss rush. A warden's cinematic intro plays only the first time you meet it; later attempts get a short name card and the fight starts at once.

Returning players drop straight back where they were. Esc skips the opening.

## Controls

| Input | Action |
| --- | --- |
| A / D, arrows | Walk |
| Space, W | Jump. Again in the air once you earn *Second Wind* |
| Shift, K | Dash |
| J, left click | Strike. Hold up or down to aim (down in the air bounces off enemies) |
| Hold left click on a block | Break it (only blocks you can see; with an enemy close, a click strikes instead). Cutting a trunk fells the whole tree for timber |
| Right click | Place the chosen block: a ghost shows where it goes, red when it can't (with the reason on click). Click a block's face to build onto it, hold and drag to lay a line. Shift places a back wall |
| 1-9, mouse wheel | Choose what's in hand (blocks, parts, flares, draughts) |
| R | Use what's in hand (throw a flare or charge toward the pointer, drink a draught); right click works too |
| B | Build mode for keyboard and gamepad (Strike mines, E places) |
| E | Talk, rest, take, open doors and chests, use a station |
| Hold H | Spend breath to mend a vessel |
| I, Tab | Open the satchel (inventory) |
| Q | Open the satchel on the crafting book |
| W / S on a ladder | Climb; hold S on a platform to drop through |
| T | Emote (others see it in multiplayer) |
| M | Mute |
| Esc | Menu |

Gamepad and touch are supported. Phones get a floating stick that appears wherever the left thumb lands, large thumb-sized buttons arranged in an arc (Strike biggest, then Jump, Dash, Mend, Build), sized from the screen so they stay comfortable on any phone, haptic ticks, and a contextual action button (Talk, Rest, Open, Wake, Read) that appears only when there is something to use. Build mode: hold a block to dig it, touch open space to place, drag to dig or lay a whole line.

## The satchel: inventory and crafting

Press I (or the Bag button on touch) and the game becomes a small cutscene: time slows, the camera leans in, the world dims and the doll sits down and opens its bag. Everything you carry is on the left, sorted into Blocks, Parts, Use and Gear, with three worn slots (lamp, pick, charm) and the hotbar underneath (drag items onto it, or tap an item then a slot). The crafting book is on the right.

- **Where you craft.** Simple things by hand anywhere (planks, ladders, platforms, torches, steps, bricks, a Workbench). The rest needs a station within a few blocks: a **Workbench** (doors, storage chests, lanterns, flares, hearths, and the other stations), a **Forge** (glass, nightglass, blast charges, picks, the miner's lamp) or a **Loom** (draughts, charms). A shrine's fire counts as a workbench.
- **Crafting** is a little ceremony: the ingredients fly into a ring, it turns and flashes, and the result drops into the satchel. Hold the button to make several.
- **Building parts:** ladders (climb, step off at the top), one-way platforms (jump up through, hold down to drop), torches, two-high doors (open and close with E), half steps, storage chests (their contents stay where you built them).
- **Consumables:** mending draughts, flares (thrown, a strong light for twenty seconds) and blast charges (thrown, break the blocks around them and knock Hollows flying; the pieces come back to you).
- **Gear,** shown on the doll: a miner's lamp (wider light), gilt and crystal picks (much faster mining), the thread charm (breath fills twice as fast) and the ember charm (your dash cuts Hollows).

Nothing attacks while the satchel, a dialog or a cutscene is open.

## The ragdoll: new physics

The character keeps the look of the Rag Toss and Rag Showdown mannequin (cream body, rounded block head, thick capsule limbs, darker far-side limbs), but the physics is written from scratch (`js/physics/body.js`):

- **XPBD particles.** 15 particles with mass and collision radius, rigid bones solved twice per substep, 4 substeps per 1/120 s tick.
- **Angular joints.** 13 joints with one-way limits (knees, elbows, ankles, hips, spine, neck, shoulders). The shoulder range is offset so a full overhead swing never wraps across plus or minus pi.
- **Muscles act on joint angles.** Each joint is driven toward a target angle with momentum-conserving angular constraints. Only two forces come from outside the body: a root drive that carries the pelvis with the controller, and a balance torque that keeps the torso upright. Both scale with a single `strength` value, so the same body blends continuously between fully animated and fully limp.
- **Hybrid control.** A tight platformer controller (coyote time, jump buffer, variable jump, dash, wall slide, step-up) owns gameplay. The ragdoll follows it through muscles. When knocked down the roles swap and the controller rides the pelvis until the body physically gets back up.
- **Procedural animation** (`js/physics/pose.js`). The gait is distance-driven so feet never skate, feet are placed on the real terrain with two-bone IK, landings squash through a spring, double jumps turn into a front flip driven by the balance torque, and attacks are keyframed arm arcs that the physical arm then has to actually travel. Hits are tested against the real blade position, so a lagging arm swings late.
- **Insane but honest.** Big hits, warden slams and very long falls make the body crumple and tumble; killed enemies are launched as limp bodies; flying wardens drag slack legs; capes are cloth chains.

## The world

- **Ground you can read.** Thick, uneven topsoil (the soil line rolls with the land, pockets reach into the rock, thin strata below), grass roots hanging into the soil, and sloped **cave mouths** and ravines every so often so the caves can be walked into.
- **Endless and seeded** (`js/world/world.js`). Generated per 32x32 chunk, in both directions and downward without end. Caves, floating islands, crystal pillars, ice spikes, ember vents, ore veins, sand pockets, and each biome's painted tree from the materials sheet (round crowns, glass trees, giant mushrooms, dead trees, pines) leaning in the wind and away from anyone brushing past. Only your edits are saved; everything else regenerates identically.
- **Five biomes** that cycle with distance and darken with each loop: the Pale Meadow, the Glass Wood, the Hollow Below, the Ember Reach and the Frost Spires. Each has its own palette, parallax silhouettes, ambient particles, colour grade and generative score.
- **Boss gates.** Every boundary between biomes is an arena held by a warden. Three archetypes with stronger variants: the Hollow Warden and the Pyre Knight (giant ragdolls: slam waves, wall-stunning charges, leaps), the Glass Widow and the Still Queen (flying ragdolls: volleys, dives, summons, rings, icefall), and the Unmade Heart (a core wrapped in torn-up blocks: throws, pound, spin). Tier scales health and adds patterns; a second phase starts at half health.
- **Shrines** every ~85 tiles. Rest to heal, save and set your respawn. Each is kept by someone: a wanderer (trades blocks), a smith (hones your blade, forges hearths), a sage (more vessels, faster mending) or a tailor (cosmetics). Invite them to live at your hearth.
- **Things to do between gates** (`js/game/content.js`), all placed by the world seed:
  - *Threads of Light*: the currency that opens warden gates (10 for the first gate, then 15, 20, ... carried in total). The first stretch holds about 15, so you explore both ways before the first warden; Thread only ever leads to ones you can reach. You earn them from everything below.
  - *Lost dolls* lying limp in the grass. Wake them and they thank you with a Thread.
  - *Chests* with glimmer, blocks and sometimes a cosmetic.
  - *Lost stitches*: glowing scraps that each hold one line of the world's lore, kept in the Journal.
  - *Hollow nests* that keep birthing husks until you break them.
  - *Keeper favours*: every keeper asks for something (blocks, nests broken, dolls woken) and pays in Threads, glimmer or looks.
  - The **Journal** tab tracks Threads, rescues, chests, lore and open favours.
- **Home.** Place a Hearth and that spot becomes home: your respawn point, and where the people you invite go to live.

## Art pipeline and asset sheets

The painted art comes from hand-made reference sheets, cut up by `tools/extract_assets.py` into `assets/`:

- `assets/tex/`: seamless 128 px textures per biome (surface, soil, stone, deepstone, moss, ore, bark, foliage) and built blocks (planks, brick, stone, plaster, nightglass, ember rock, sand, snow, ice). Edges are made seamless by rolling and blending each tile.
- `assets/props/`: shrine, campfire, blade in stone, hearth, lantern, gate banner, seed of light, with the sheet background removed.
- `assets/icons/`: block icons, vessels, glimmer, relic medallions.
- `assets/fx/`: slash, hit spark, shockwave, soul glimmer, dust, thread trail.
- `assets/trees/`: the five flora sprites, cut by a flood fill from the border (shadow and halo removed, clean edges).

In the world, sheet sprites are colour graded per biome (`gradedImg` in `js/art/images.js`) so they sit in its light. Crafted parts, stations and item icons are painted in code for now (`js/art/itemart.js`); `art/sheets/requests.png` lists every one of them with its target size, ready to be replaced by hand-painted art.

`js/art/images.js` loads them (pattern fills for tiles, sprites for props and icons). Characters are drawn in code to match the character reference (`js/art/doll.js`), matte with blank faces: round heads, scarves, belts and boots, cloaks and hoods, painted with soft shading and no outlines. Anything not on the sheets is still generated in code from the art bible (`js/art/paint.js`): key light from the upper left, rim light from behind.

- `js/art/tex.js`, `js/art/props.js`: code-drawn fallbacks used if an image fails to load.
- `js/art/bg.js`: painted parallax flats with rim light and haze, cloud banks, and one sky set piece per biome (floating isles, glowing crystal spires, a stone sky, a smoking volcano, an aurora).

The asset sheets in `art/sheets/` are rendered from that same code (so they always match the game): `characters.png`, `maps.png` (materials and in-game captures of every biome), `assets.png` (props, items, interface, effects) and `requests.png` (art still wanted). Rebuild them with `node tools/sheets.mjs`.

## Look and feel

- **Sleek, no outlines.** Tiles are soft voxels with rounded exposed corners, a rim light on top faces and a shade underneath; tree canopies merge into one mass. Shape and depth come from coloured flood-fill lighting (sky light, lanterns, crystals, embers, your own soul glow) multiplied over the scene and upsampled smoothly.
- **Cinematic.** Letterbox bars, serif title cards, biome cards, boss name cards, a warden looming on the horizon as you approach, slow motion and white-out on finishing blows, hit-stop and screen shake scaled by importance, a WebGL post pass with two-level bloom, grade, vignette, grain and a chromatic pulse on impacts.
- **UI.** Glass panels, a minimal HUD (vessels, breath, glimmer, hotbar, a compass to the next gate), typewriter dialogue as subtitles, a character editor with a live ragdoll preview and a generated sigil.
- Accessibility: toggles for screen shake, bright flashes, bloom and touch controls, three quality levels, and an automatic quality step-down if frames stay slow.

## Making the character yours

Body colour, material (linen, porcelain, bronze, lumen, umbra), head (sprout, hood, pale mask, horns, antlers, top hat, halo, crown), cape or scarf, the colour of the glowing thread in your chest (also your dash trail), and blade. Some are found by reaching biomes, some fall with wardens, some are bought from tailors. Every warden also leaves a kintsugi-like mark on your torso. Your sigil is generated from your name and every choice you make.

## Multiplayer

CrazyGames provides invites and rooms, not servers, so play is peer to peer over WebRTC (PeerJS, vendored; the public PeerJS broker handles signalling).

- **Invite a friend.** Menu, Together, Invite. Your world opens, the CrazyGames invite button appears (`showInviteButton`), the room is published with `updateRoom`, and an `inviteLink` is copied. Friends who follow it, or who join through CrazyGames (`addJoinRoomListener`, `getInviteParam`), land in your world.
- **The open world.** Serverless matchmaking: each player tries to claim a well-known shard id; whoever gets it hosts that shard's shared world, everyone else joins it (up to 6 per shard, then the next shard). If the host leaves, a guest takes the shard over and the world carries on. `isInstantMultiplayer` sends players straight in.
- **What is shared.** The host owns the world, enemies and wardens; guests see them as puppets and their hits are applied by the host. Block edits replicate both ways. Remote players are full ragdolls driven by their controller state, so they walk, fall and get knocked about physically on every screen. Friendly blades shove each other but never hurt. Wardens grow stronger for every soul in the session, and everyone in the session earns a relic when one falls. Emotes, name tags (CrazyGames username when signed in), a live soul counter.
- Visiting never touches your own save's world; your glimmer, relics and cosmetics travel with you.

## CrazyGames integration (`js/platform.js`)

SDK v3 loaded async from `sdk.crazygames.com`, initialised with a timeout, and every call is guarded so the game runs the same anywhere. Uses `loadingStart/Stop`, `gameplayStart/Stop` (stopped while the menu is open or the tab is hidden), `happytime` on warden kills, the data module for saves (localStorage fallback), the settings listener for platform mute, the user module for the player's name, and the invite / room APIs above. Loading and gameplay events asked for before the SDK finishes initialising are replayed once it is ready.

Ads (`ad.requestAd`):
- **Rewarded, player's choice.** When you fall, Thread offers *Rise here* (a short ad, then you stand back up where you fell, boss fight and all) or *Wake at the shrine*. The reward is only given when the ad finished.
- **Midgame, at a natural break.** Only while waking at a shrine after a fall (the screen is already dark), never in the first 3 minutes, at most once every 3 minutes, never while other players share your world.
- While any ad plays the game is paused and silent, `gameplayStop` is sent, and everything is restored afterwards. A lost callback can't hang the game (90 s guard).

**Terms & Privacy** are shown in game (Menu, Settings, Terms & Privacy) as plain text with no outside links: use terms, what is stored and where, what peer-to-peer multiplayer shares, and that ads come from CrazyGames. It's a template to review before release, not legal advice.

`tools/cg-mock.js` stands in for the SDK in tests (`node tools/shot.mjs sdk --cg` checks the whole flow).

## Project layout

```
index.html, css/style.css
js/main.js              boot and wiring
js/platform.js          CrazyGames SDK wrapper
js/core/                input, audio synth + generative music, WebGL post FX, math/noise
js/physics/             body.js (XPBD ragdoll), pose.js (procedural animation), skin.js (rendering, cape)
js/world/               tiles.js (tiles, biomes), world.js (generation, chunks, edits), render.js, light.js
js/game/                game.js (loop, camera, render pipeline), actor.js, player.js, enemies.js,
                        bosses.js, npcs.js (shrines, keepers, favours, home), content.js (dolls, chests,
                        lore, nests, Threads of Light), story.js (cinematics, tutorial, goals), thread.js,
                        items.js (items, recipes, stations), parts.js (doors, chests, stations), throwables.js,
                        progress.js (save, cosmetics, relics, recipes), fx.js
js/art/                 images.js (sheet art loader), doll.js (characters), bg.js, paint.js, tex.js, props.js
js/ui/                  ui.js (HUD, tutorial, journal, cards, dialog, menus, editor, terms), bag.js (satchel), touch.js
assets/tex, props, icons, fx   art cut from the reference sheets
js/net/net.js           multiplayer
vendor/peerjs.min.js    PeerJS 1.5.4 (MIT)
assets/fonts/           Cormorant Garamond, Manrope (OFL)
tools/                  headless test harness, extract_assets.py (sheet cutter)
```

## Testing

`tools/play.mjs` plays the game like a person from the opening fall (keyboard and mouse only, following the tutorial, the objective and Thread) and reports a timeline and anything that goes wrong: soft-locks, stuck spots, errors, falling out of the world.

```bash
node tools/play.mjs 480        # 8 minutes of play
node tools/shot.mjs film       # frame-by-frame filmstrip of walk, run, jump, strike, dash
node tools/shot.mjs bag        # satchel: craft by hand and at a workbench, drink, wear gear, climb a ladder
node tools/shot.mjs climb      # a Hollow follows you up ledges of 2, 3, 4 and 5 blocks
node tools/shot.mjs doll       # a lost doll sleeps, then wakes, stands, stretches and waves
node tools/shot.mjs mouth      # visit a cave mouth
node tools/shot.mjs sdk --cg   # CrazyGames SDK flow against the mock
```

The `tools/` folder drives the real game in headless Chromium (Playwright):

```bash
node tools/shot.mjs birth      # the first-launch sequence, screenshots to /tmp/otf-shots
node tools/shot.mjs tut        # the tutorial runs start to finish (training doll, dash, mine, place)
node tools/shot.mjs content    # wake a doll, open a chest, read a stitch, break a nest
node tools/shot.mjs gates      # a gate stays sealed without Threads of Light
node tools/shot.mjs fight      # husk, brute and wisp combat
node tools/shot.mjs boss       # first gate: intro once, fight, death, relic; no intro on a retry
node tools/shot.mjs build      # mine with the mouse, place a hearth, home is set
node tools/shot.mjs persist    # save, reload, edits and progress survive; death and respawn
node tools/shot.mjs shrine     # meet a keeper, dialogue, menus, editor, craft
node tools/shot.mjs mobile --mobile --size 844x390
```

`tools/mp.mjs` runs a local PeerJS server (needs the `peer` npm package, path in `PEER_MODULES`) and checks the multiplayer flow end to end: hosting, joining, movement sync, block edits both ways, shared enemies, guest damage applied by the host, leaving, open-world shards and host migration.

## Credits

Character design lineage: the mannequin from Rag Toss and Rag Showdown (and Element Rag before them). Fonts: Cormorant Garamond and Manrope (SIL Open Font License). Networking: PeerJS (MIT).
