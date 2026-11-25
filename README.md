# On Two Feet

An open-world, cinematic 2D sandbox. You are a cloth doll that falls out of the sky as a seed of light, learns to stand, and then makes an endless world its own: you dig and build, meet the people who keep its shrines, raise a home, and walk through gate after gate held by stronger and stronger wardens. Every warden you beat leaves a mark on your body, so no two players end up looking alike.

Pure HTML5 and vanilla JavaScript (ES modules). No build step, no runtime dependencies. All art is drawn in code, every sound is synthesized, fonts and PeerJS are vendored. CrazyGames SDK v3 is wrapped and fully guarded.

To play locally, serve the folder (for example `python3 -m http.server`) and open `index.html`.

## The story

Before the world, there was a needle and a thread. The Seamstress stitched the land, and dolls to walk it. Then she vanished; her needles became the Wardens and shut every gate, and the dolls forgot how to stand. You are the last doll, born from the last falling thread of her light. Thread, her final living stitch, climbs out of your chest to guide you. Walk through every gate, take her light back from the Wardens, and finish the world yourself.

## The first minute (the hook)

No loading screen, no menu. The game opens on a short, skippable prologue (any key after a moment, or Esc):

1. **Black.** A heartbeat, embers rising, and the first line: before the world had edges, there was a needle and a thread.
2. **The Loom-Cathedral at dusk.** A painted vista in four parallax layers: a ruin of needle spires with light through their eyes, broken threads strung between them, a cracked rose window, tattered banners, fog in the nave, crows wheeling, and the seed of light falling toward it.
3. **The five Wardens,** one painted portrait each with a slow push-in and a name card: the Hollow Warden, the Glass Widow, the Unmade Heart, the Pyre Knight, the Still Queen.
4. **The fall.** A burst of light, and you are plummeting through a dusk sky, steering to catch motes of light (glimmer) while the last lines are told over the wind.
5. **The impact and getting up.** Slow motion, white-out, a shockwave across the meadow; Thread climbs out of your chest (*"Up. You have to get up."*), the doll pushes onto a knee and stands, a Warden roars far away and the title card lands.
6. **A short tutorial** (a compact banner with a progress ring, the keys or touch button to use, the matching touch button pulsing; skippable): walk, jump, take the blade from the stone, strike a glowing training doll, dash, break a block, place it, then turn timber into planks in the satchel. Then the first Hollow claws out of the ground.
7. **A clear chain of goals** (always shown top left, and Thread flies ahead to point the way): reach the shrine, rest, gather Threads of Light, then face the Hollow Warden, make a home, walk on.

The tutorial never really ends: it lets go gradually (see The guide). The first boss is about 220 tiles away and its gate stays sealed until you carry enough Threads of Light, so the opening is exploration, not a boss rush. A warden's cinematic intro plays only the first time you meet it; later attempts get a short name card and the fight starts at once.

Returning players drop straight back where they were. Esc skips the opening.

## Controls

| Input | Action |
| --- | --- |
| A / D, arrows | Walk |
| Space, W | Jump. Tap again in the air for a double jump |
| Shift, K | Dash |
| Hold Ctrl or C | Crawl through one-block gaps |
| J, left click | Strike: it always fights (blocks are only mined and placed in build mode). The blade swings like a Souls straight sword: a falling diagonal, a rising backhand, a thrust and a heavy finisher, each with a wind-up and a recovery a queued swing can flow out of; running gives a lunging slash, jumping a downward cut. Hold to charge (a two-handed overhead); strike as a blow lands to parry; hold up to launch, down in the air to bounce. The daggers sometimes lunge and stab |
| B, then hold left click (or J) on a block | Build mode: break the block. Reach is a square of five whole blocks each way; out of reach, nothing is outlined. Strike a trunk a few times and the tree topples for timber |
| Build mode: right click (or E) | Place the chosen block: a ghost shows where it goes, red when it can't (with the reason on click). Click a block's face to build onto it, hold and drag to lay a line. Shift places a back wall. Outside build mode, right click throws or drinks the item in hand |
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

Moving into a wall two or three blocks high while in the air grabs the ledge and pulls you up.

Gamepad and touch are supported. Phones get a floating stick that appears wherever the left thumb lands, large thumb-sized buttons arranged in an arc (Strike biggest, then Jump, Dash, Mend, Build, Bag, and Crawl under Jump), sized from the screen so they stay comfortable on any phone, haptic ticks, and a contextual action button (Talk, Rest, Open, Wake, Read) at the top right, under the menu, that appears only when there is something to use. Build mode: hold a block to dig it, touch open space to place, drag to dig or lay a whole line.

## The satchel: inventory and crafting

Press I (or the Bag button on touch) and the game becomes a small cutscene: time slows, the camera leans in, the world dims and the doll sits down and opens its bag. Two lacquered panels slide in: the **satchel** on the left, the **crafting book** on the right, with the In hand row (hotbar) underneath.

- **Satchel.** Items sit in bevelled sockets tinted by rarity (Common, Fine, Rare, Storied), filterable by Blocks, Parts, Use and Gear with counts. Tap one for its card: a large icon, rarity, description and, for weapons, bars for damage, reach, speed and stagger (mining speed for picks), plus Wield, Wear, Drink or Take in hand. With a mouse, hovering shows the same as a tooltip. The Worn row holds the weapon, lamp, pick and charm. Drag to the In hand row, or tap an item and then a slot.
- **Crafting book.** Stations in reach light up (By hand, Workbench, Forge, Loom). Recipes are grouped into All, Build, Arms, Tools and Use, each with a count of what you can make now; ready recipes have a green mark and show how many you could make. Pick a count with the stepper (or Max).
- **Where you craft.** Simple things by hand anywhere (planks, ladders, platforms, torches, steps, bricks, a Workbench). The rest needs a station within a few blocks: a **Workbench** (doors, storage chests, lanterns, flares, hearths, and the other stations), a **Forge** (glass, nightglass, blast charges, picks, the miner's lamp) or a **Loom** (draughts, charms). A shrine's fire counts as a workbench.
- **Crafting** is a little ceremony: the ingredients fly into a turning ring of marks, it spins and flashes, sparks fly in the item's rarity colour, a *Crafted* card rises, and the result drops into the satchel. Hold the button to keep making more.
- **Building parts:** ladders (climb, step off at the top), one-way platforms (jump up through, hold down to drop), torches, two-high doors (open and close with E), half steps, storage chests (their contents stay where you built them).
- **Consumables:** mending draughts, flares (thrown, a strong light for twenty seconds) and blast charges (thrown, break the blocks around them and knock Hollows flying; the pieces come back to you).
- **Weapons** (Workbench) and **infusions** (Forge): see Combat below.
- **Gear,** shown on the doll: a miner's lamp (wider light), gilt and crystal picks (much faster mining), the thread charm (breath fills twice as fast) and the ember charm (your dash cuts Hollows).

Nothing attacks while the satchel, a dialog or a cutscene is open.

## The character: animated, not a ragdoll

Every doll (you, Hollows, keepers, remote players, wardens' bodies) is an animated character (`js/physics/body.js`, `js/physics/pose.js`). There are no springs or muscles, so nothing wobbles:

- **Forward kinematics.** A 15-point skeleton is placed every 1/120 s tick from smoothed joint angles (spine, neck, shoulders, elbows, hips, knees, ankles), mirrored by facing and clamped to each joint's range.
- **Procedural animation.** The gait is distance-driven so feet never skate, feet land on the real terrain with two-bone IK, landings squash, double jumps flip. Walking down stairs keeps the feet on the ground (no falling pose).
- **Attacks** are keyframed arcs per weapon (wind-up, strike, follow-through) with the body leaning and stepping into the blow; the blade's real position is what hits.
- **Hits and falls** are animated states: a flinch, knockback that tumbles you through the air, lying down, getting up.
- **Ledge mantle:** jump at a wall 2-3 blocks high and both hands catch the lip and hang, the feet scrabble on the wall, the arms haul the chest up past the edge, a knee swings over and the doll stands.
- **Ladders:** hand over hand on the rungs with the knees coming up under the body; still when you stop.
- **Crawl:** hold Ctrl or C to drop onto hands and knees and slip through one-block gaps; a one-block step inside a tunnel is climbed on all fours; you can't stand up under a ceiling.
- Capes are still cloth chains.

## Action: surges, combos, Rift Trials

The game is built to keep you fighting:

- **Hollows come often and in packs,** see further, remember you, and attack more often. Two kinds join the husks and brutes: the **lancer** (a telegraphed dash-thrust; a red line shows its path) and the **slinger** (keeps its distance and lobs stones that land where you stand).
- **Hollow surges.** Every minute or so in the open, a rift tears open nearby. Waves pour out and the last wave brings a brute. Clear them (fast, for a bonus) and the rift leaves a chest; walk away and it closes. A banner shows the wave and how many are left. Surges never happen in towns, at gates, in menus or in the tutorial.
- **Combos and streaks.** Every hit adds to a combo that multiplies glimmer and experience. Kills close together call out Double, Triple, Rampage, Unstoppable, Undone. Taking a hit halves the combo.
- **Rift Trials** (menu, Journey, or the training yard in any town): a sealed arena in a world of its own. Endless waves come from tears at both ends, a champion every fifth wave, a boon to choose every third (Fury, Mend, Quickstep, Cinder, Seamguard, Vigil). When you fall you see wave, kills, best combo and score, then go Again or Leave. The world you left is saved first and untouched.

## Levels and perks

- Experience from everything: kills (scaled by the enemy's level and your combo), surges, quests, commissions, puzzles, camps, chests, woken dolls, nests, new towns, wardens. The inn's Well Rested bonus adds half again.
- **Level up:** a slow-motion ring and a card. Damage grows every level, a vessel every fourth level (up to ten), and every third level you choose one of three **perks**: Keen Edge, Heavy Hand, Swift Strike, Long Reach, Riposte, Iron Seam, Second Thread, Bloodthread, Overdrive, Fleet, Stormstep, Ember Soul, Lodestone, Scholar, Thread Ward.
- **Zone levels:** the further from the first fire, the stronger the Hollows. Thread warns you when a zone outclasses you. The Character tab in the menu shows your level, experience, damage, vessels, the zone level here, perks to pick and the ones you have. A thin arrow-ended experience line sits just above the hotbar, the level in a diamond Lv. N badge at its left.

## Towns

One town in every biome, on level ground behind gate arches: the first just left of the start, the next right after the first gate. Each has a cobbled street, seven buildings made of real tiles (walk inside in front of the back walls, run along the solid roofs), and stations to use (forge, workbench, loom).

- **General store:** buy blocks and parts; sell raw materials for glimmer.
- **Smithy:** temper the weapon you carry up to +5 (12% more damage per step) with glimmer, gilt and crystal.
- **Tailor:** your looks.
- **Alchemist:** draughts, flares, charges, infusions.
- **Inn:** rest, save, and Well Rested.
- **Notice board:** bounties (undo Hollows, clear a surge, fell brutes); claim them at any board.
- **Waystone:** travel between towns you have found.
- **Training yard:** the gate to the Rift Trials.

Townsfolk walk the street and talk, and shopkeepers turn to you. Hollows never come in. All of it is drawn in code as a placeholder until painted art arrives: every building and prop checks for `assets/town/<name>.png` first. `art/sheets/towns.png` is the rough sheet of what to paint, with sizes.

## The guide

Modelled on how big open-world games keep players oriented (first-time tutorial cards kept in an archive, a companion who explains, a tracked goal with an on-screen marker, clear gating messages):

- **The Guide** (`js/ui/teach.js`, menu tab): nothing pops up mid-play. The first time Threads of Light, sealed gates, the way-marker, build mode, parry, mending, surges, towns, perks or crafting matter, an entry is written into the Guide with a quiet note and a dot on the menu button. The Guide is a small two-page book: entries by section on the left, the open entry with its picture, two lines and the controls on the right.
- **Threads made obvious:** the goal reads "Threads of Light 3/10 · they open the gate" and names the nearest source and its distance; a sealed gate says exactly what it needs and what you carry.
- **Compass strip:** a thin strip across the top shows the gate, the nearest Thread of Light, the tracked quest, the nearest shrine and town, each with its distance.
- **Always a next step:** the diamond marker (and its screen-edge arrow) always has a target: the tracked quest, else the story goal, else the nearest Thread of Light.

The tutorial teaches the basics, then lets go gradually instead of stopping:

- **Lessons wait for the moment they are useful:**
  - a Hollow winding up: parry;
  - hurt with breath full: mend;
  - a brute or a staggered foe: charge;
  - a ledge: mantle;
  - a ladder: climb;
  - a low gap: crawl;
  - stuck in a pit: dig out;
  - the dark: flare;
  - a workbench with something to make;
  - an untracked quest;
  - a perk to pick;
  - a surge;
  - a growing combo.
- **How a lesson shows:** a small chip with the keys or touch action, and Thread says it the first times. Each success pushes the next showing further away and shrinks the chip; after a few successes it never comes back.
- **Live tips from Thread:**
  - low health with Hollows near;
  - a crowd;
  - zones that outclass you, or no longer challenge you;
  - standing around lost (Thread points the way);
  - ore enough to forge;
  - a town ahead.
- **The objective panel** drops its how-to line from level 8, unless you stand around lost.

## Combat and weapons

Five weapons, each with its own combo chain, charged heavy attack, numbers and drawing on the doll (`js/game/weapons.js`):

| Weapon | Feel |
| --- | --- |
| Blade | Balanced three-step chain, rising cleave when charged |
| Spear (Workbench) | Long reach, quick thrusts, a wide sweep, a lunging charge |
| Greathammer (Workbench) | Slow and crushing; breaks guards and blocks; the charged slam shakes the ground |
| Twin daggers (Workbench) | Very fast five-step chain, Hollows bleed, dash-cancel, a whirling charge |
| Sling (Workbench) | Ranged: hurls stone from the satchel (crystal pierces), knocks floating Hollows down |

- **Combos** with input buffering; **hold** to charge a heavy; **parry** by striking just as a blow lands (slow-mo flash, the attacker staggers, a counter window opens); **launcher** up-strike and air juggles.
- **Poise.** Enemies have a stagger bar; heavy weapons break it faster. **Finishers** trigger on staggered or nearly beaten foes (and sometimes on a combo ender): slow motion, a camera punch-in, extra sparks and hit-stop.
- **Infusions** from the Forge: Ember (hits burn) and Frost (hits slow).
- **Swings have elbows and wrists:** the weapon is cocked back over the shoulder with the elbow bent, the arm snaps straight through the strike, and the elbow folds again on the follow-through. The wrist lets the blade lead, lag and wrap past the body, the free arm counter-swings, and the body winds back then drives forward.
- Every hit is weighted: hit-stop and shake by weapon, directional sparks, an impact flash on the enemy, haptic ticks on phones. Floating wisps telegraph longer and shoot slower than before.

## Quests and side content

- **Keeper quest chains** (`js/game/quests.js`): each kind of keeper has a chain of steps with dialogue and rewards (recipes, weapons, looks, vessels). The first one, after your first rest, teaches the Workbench: build one, craft a ladder, craft a spear.
- **Daily commissions:** three small tasks a day (light torches, break blocks, wake a doll...), with a bonus from any keeper when all three are done.
- **World puzzles** (`js/game/sites.js`): brazier rings (light them all before the first goes out), pressure plates (stand on one, put a block on the other), Thread races (fly through the rings before they fade). Each opens a sealed chest.
- **Hollow camps:** guards around a named elite with a shield or a brute chief, with health and poise nameplates, guarding loot.
- **Tracking.** The Quests tab lists every quest; track one and a marker shows where to go (an edge-of-screen chevron with distance when it is off screen). Navigation can be turned off.
- Chests are the painted chest from the request sheet: the lid swings open on its hinge with light spilling out, then the chest fades away.

## The world

- **Ground you can read.** Thick, uneven topsoil (the soil line rolls with the land, pockets reach into the rock, thin strata below). Turf hangs down into the soil below it with a ragged edge (the turf-to-soil transition). The top layer is always turf: soil open to the sky becomes turf, soil beside turf turns too (sideways only), and soil you uncover greens a moment later. Wide, gentle **cave mouths** are plain open ground you walk straight into, and there are ravines now and then. Crystal and gilt ore are graded into their host rock.
- **Endless and seeded** (`js/world/world.js`). Generated per 32x32 chunk, in both directions and downward without end. Caves, floating islands, crystal pillars, ice spikes, ember vents, ore veins, sand pockets, and each biome's painted tree from the materials sheet (round crowns, glass trees, giant mushrooms, dead trees, pines), rooted in the turf, leaning in the wind and away from anyone brushing past. Strike a trunk and chips fly and the crown shakes; a few hits (fewer with the hammer) and it topples, lands with a thump and leaves its timber in your satchel. Only your edits are saved; everything else regenerates identically.
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

In the world, sheet sprites are colour graded per biome (`gradedImg` in `js/art/images.js`) so they sit in its light. - `assets/req/`: the hand-painted request sheet, cut the same way: cave mouth, Hollow nest, satchel, ladder, platform, door, step, storage chest, workbench, forge, loom, and the item icons (draught, flare, blast charge, lamp, picks, charms). Stations stand in the world as these sprites; the icons appear in the satchel and hotbar (`js/art/itemart.js`). The torch keeps its code-drawn version (its painted halo could not be separated cleanly), and the interface frames on the sheet are matched in CSS.

**Clean geometry.** Hollows, wardens and the prologue plates are built structure first, then shaded: closed paths with integer corners, proportions from a few shared variables, symmetric figures mirrored about their centre line, one stroke width per layer with round joins, soft gradient shading, one rim light, glow last. No grain, no jitter, no sketch marks. Enemy gear is in `js/art/grit.js` (tabard, face plate with one crack, breastplate, pauldron, even chain links); the vista and the five Warden portraits are in `js/art/prologue.js`, painted off screen a slice at a time. A painted plate in `assets/cine/<name>.png` (listed in `CINE` in `js/art/images.js`) replaces the built one.

**Town art.** `town_sprites` in `tools/extract_assets.py` cuts the painted town sheet into `assets/town/` (buildings, props, signs, townsfolk), `assets/ui/` (shop icons, slot frames, crafting ring, panel, touch ring) and seamless town tiles in `assets/tex/town_*`. Buildings stand on the street at their own proportions, townsfolk walk as their sprites, and the hotbar, touch buttons, crafting ring, menu panel and teaching cards wear the painted frames.

**Requests II (painted).** The user's painted answer (`art/source/requests2_painted.jpg`) is cut by `rq2_sprites`: the five Wardens lifted off their cards (background fitted and removed, ornaments opened away, the Glass Widow traced by hand, the cut-off bottom faded) and set into the prologue over their backdrops, sunk into ground mist; the four vista strips as parallax plates; the weapons, drawn in hand. The Hollows are redrawn in code after its character previews: big pale masks with a single dark eye (a flame crest, a cone, a hood, horns), short ponchos with deep jagged hems, the brute's slab, a cyan flame for the wisp; `tools/scenarios.mjs hollowrig` checks every kind through idle, walk, attack, hurt, stagger and death. The request sheet `art/sheets/requests2.png` listed: the four vista layers and five Warden portraits (1600 x 900), rig parts for each Hollow, weapons, infusion glows, the double-jump ring, the rift tear, the level bar and the card frame.

The blade in the stone has its painted light beam removed (`clean_bladestone`) and gets a soft additive shaft with drifting motes drawn in code instead; it stands on a level shelf.

`js/art/images.js` loads them (pattern fills for tiles, sprites for props and icons). Characters are drawn in code to match the character reference (`js/art/doll.js`), matte with blank faces: round heads, scarves, belts and boots, cloaks and hoods, painted with soft shading and no outlines. Anything not on the sheets is still generated in code from the art bible (`js/art/paint.js`): key light from the upper left, rim light from behind.

- `js/art/tex.js`, `js/art/props.js`: code-drawn fallbacks used if an image fails to load.
- `js/art/bg.js`: painted parallax flats with rim light and haze, cloud banks, and one sky set piece per biome (floating isles, glowing crystal spires, a stone sky, a smoking volcano, an aurora).

The asset sheets in `art/sheets/` are rendered from that same code (so they always match the game): `characters.png`, `maps.png` (materials and in-game captures of every biome), `assets.png` (props, items, interface, effects) and `requests.png` (art still wanted). Rebuild them with `node tools/sheets.mjs`.

## Look and feel

- **Sleek, no outlines.** Tiles are soft voxels with rounded exposed corners, a rim light on top faces and a shade underneath; tree canopies merge into one mass. Shape and depth come from coloured flood-fill lighting (sky light, lanterns, crystals, embers, your own soul glow) multiplied over the scene and upsampled smoothly.
- **Cinematic.** Letterbox bars, serif title cards, biome cards, boss name cards, a warden looming on the horizon as you approach, slow motion and white-out on finishing blows, hit-stop and screen shake scaled by importance, a WebGL post pass with two-level bloom, grade, vignette, grain and a chromatic pulse on impacts.
- **UI.** Glass panels, a minimal HUD (vessels, breath, level and XP, glimmer, hotbar, a compass to the next gate; the boss bar, without shadows, only during a fight; combo counter, surge banner, guide chip), typewriter dialogue as subtitles, a menu with a sliding tab line, staggered entrances and a Back button, and an Appearance tab with the doll turning on a lit pedestal. Painted clouds with lit tops and soft bases. Quality defaults to high with post-processing on.
- Accessibility: toggles for screen shake, bright flashes, bloom and touch controls, three quality levels, and an automatic quality step-down if frames stay slow.

## Making the character yours

Body colour, material (linen, porcelain, bronze, lumen, umbra), head (sprout, hood, pale mask, horns, antlers, top hat, halo, crown), cape or scarf, the colour of the glowing thread in your chest (also your dash trail), and blade. Some are found by reaching biomes, some fall with wardens, some are bought from tailors. Every warden also leaves a kintsugi-like mark on your torso. Your sigil is generated from your name and every choice you make.

## Multiplayer

CrazyGames provides invites and rooms, not servers, so play is peer to peer over WebRTC (PeerJS, vendored; the public PeerJS broker handles signalling).

- **Invite a friend.** Menu, Together, Invite. Your world opens, the CrazyGames invite button appears (`showInviteButton`), the room is published with `updateRoom`, and an `inviteLink` is copied. Friends who follow it, or who join through CrazyGames (`addJoinRoomListener`, `getInviteParam`), land in your world.
- **The open world.** Serverless matchmaking: each player tries to claim a well-known shard id; whoever gets it hosts that shard's shared world, everyone else joins it (up to 6 per shard, then the next shard). If the host leaves, a guest takes the shard over (retrying while the old id lingers on the broker) and the world carries on. `isInstantMultiplayer` sends players straight in.
- **What is shared.** The host owns the world, enemies and wardens; guests see them as puppets and their hits are applied by the host. Block edits replicate both ways. Remote players are animated from their controller state, so they walk, fall and get knocked about the same on every screen. Friendly blades shove each other but never hurt. Wardens grow stronger for every soul in the session, and everyone in the session earns a relic when one falls. Emotes, name tags, a live soul counter. Your name is your CrazyGames username plus a title ("Ash, the Unfinished"), or *Wren, the Unfinished* when signed out.
- Visiting never touches your own save's world; your glimmer, relics and cosmetics travel with you.

## CrazyGames integration (`js/platform.js`)

SDK v3 loaded async from `sdk.crazygames.com`, initialised with a timeout, and every call is guarded so the game runs the same anywhere. Uses `loadingStart/Stop`, `gameplayStart/Stop` (stopped while the menu is open or the tab is hidden), `happytime` on warden kills, the data module for saves (localStorage fallback), the settings listener for platform mute, the user module for the player's name, and the invite / room APIs above. Loading and gameplay events asked for before the SDK finishes initialising are replayed once it is ready.

Ads (`ad.requestAd`):
- Starting a new life (Menu, Settings) erases the save and every block you ever placed or broke.
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
js/physics/             body.js (skeleton, forward kinematics), pose.js (procedural animation), skin.js (rendering, cape)
js/world/               tiles.js (tiles, biomes), world.js (generation, chunks, edits), render.js, light.js
js/game/                game.js (loop, camera, render pipeline), actor.js, player.js, enemies.js,
                        bosses.js, npcs.js (shrines, keepers, favours, home), content.js (dolls, chests,
                        lore, nests, Threads of Light), story.js (cinematics, tutorial, goals), thread.js,
                        items.js (items, recipes, stations), parts.js (doors, chests, stations), throwables.js,
                        progress.js (save, cosmetics, relics, recipes), fx.js, weapons.js (weapons, infusions),
                        quests.js (quest chains, commissions, tracking), sites.js (puzzles, camps), trees.js (felling),
                        surges.js (rifts and waves), levels.js (XP, perks, zone levels), rift.js (Rift Trials),
                        guide.js (lessons and tips), towns.js (towns, shops, bounties, waystones)
js/world/townplan.js    the town layout, shared by the world stamp and the towns system
js/art/brush.js, prologue.js, grit.js   painting kit, the painted prologue, worn Hollows
js/art/                 images.js (sheet art loader), doll.js (characters), bg.js, paint.js, tex.js, props.js
js/ui/                  ui.js (HUD, tutorial, journal, cards, dialog, menus, editor, terms), bag.js (satchel), touch.js
assets/tex, props, icons, fx, trees, req   art cut from the reference sheets
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
node tools/shot.mjs moves      # stairs without a falling pose, ledge mantle, crawl through a gap
node tools/shot.mjs weapons    # craft every weapon, damage, parry, finisher, sling stun
node tools/shot.mjs wfilm      # filmstrip of spear, hammer and dagger combos
node tools/shot.mjs quests     # keeper chain, commission, brazier puzzle, camp
node tools/shot.mjs opening    # the prologue, shot by shot
node tools/shot.mjs uitour     # tutorial banner, menus, satchel and crafting (add --mobile --size 844x390)
node tools/shot.mjs fell       # fell a tree for timber
node tools/shot.mjs artcheck   # painted stations, item icons, Hollow nest
node tools/shot.mjs looks      # blade light, cave ore, Thread's trail
node tools/shot.mjs turf       # no soil open to the sky; uncovered soil greens
node tools/shot.mjs wipe       # a new life erases placed blocks too
node tools/shot.mjs wake       # tapping fast through the wake-up keeps Thread in sync
node tools/shot.mjs cfilm      # filmstrip: crawl (and up a step), ladder
node tools/shot.mjs mfilm      # the ledge mantle, slowed down
node tools/shot.mjs surge      # a rift opens, waves clear, a chest
node tools/shot.mjs levels     # level-ups and a perk pick
node tools/shot.mjs rift       # Rift Trials: waves, a boon, results, again, leave
node tools/shot.mjs guide      # a lesson shows and is learned; the parry hint
node tools/shot.mjs town       # a town: shop, inn, bounty, smith, waystone travel
node tools/shot.mjs foes       # close look at the Hollows
node tools/shot.mjs opening    # the painted prologue, shot by shot
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
