# Own Two Feet

An open-world, cinematic 2D sandbox. You are a ragdoll that falls out of the sky as a seed of light, learns to stand, and then makes an endless world its own: you dig and build, meet the people who keep its shrines, raise a home, and walk through gate after gate held by stronger and stronger wardens. Every warden you beat leaves a mark on your body, so no two players end up looking alike.

Pure HTML5 and vanilla JavaScript (ES modules). No build step, no runtime dependencies. All art is drawn in code, every sound is synthesized, fonts and PeerJS are vendored. CrazyGames SDK v3 is wrapped and fully guarded.

To play locally, serve the folder (for example `python3 -m http.server`) and open `index.html`.

## The first minute (the hook)

There is no menu. The first launch plays the birth:

1. Black screen, two heartbeats.
2. A seed of light falls and cracks open on the meadow. A limp body spills out.
3. "Press any key to wake." Each press puts strength into the muscles: a twitch, a push onto one knee, then the body stands on its own two feet, physically.
4. The title card fades in, the HUD slides up, and you are playing. A blade glows in the ground a few steps away, and a horned giant watches from the horizon where the first gate is.

Every launch after that drops you straight back where you were.

## Controls

| Input | Action |
| --- | --- |
| A / D, arrows | Walk |
| Space, W | Jump. Again in the air once you earn *Second Wind* |
| Shift, K | Dash |
| J, left click | Strike. Hold up or down to aim (down in the air bounces off enemies) |
| Hold left click on a block | Break it (only blocks you can see) |
| Right click | Place the chosen block (Shift + right click places a back wall) |
| 1-9, mouse wheel | Choose a block |
| B | Build mode for keyboard and gamepad (Strike mines, E places) |
| E | Talk, rest, take |
| Hold H | Spend breath to mend a vessel |
| Q | Craft |
| T | Emote (others see it in multiplayer) |
| M | Mute |
| Esc | Menu |

Gamepad and touch are supported. Phones get a floating stick, action buttons and a build toggle (tap a block to break it, tap empty space to place).

## The ragdoll: new physics

The character keeps the look of the Rag Toss and Rag Showdown mannequin (cream body, rounded block head, thick capsule limbs, darker far-side limbs), but the physics is written from scratch (`js/physics/body.js`):

- **XPBD particles.** 15 particles with mass and collision radius, rigid bones solved twice per substep, 4 substeps per 1/120 s tick.
- **Angular joints.** 13 joints with one-way limits (knees, elbows, ankles, hips, spine, neck, shoulders). The shoulder range is offset so a full overhead swing never wraps across plus or minus pi.
- **Muscles act on joint angles.** Each joint is driven toward a target angle with momentum-conserving angular constraints. Only two forces come from outside the body: a root drive that carries the pelvis with the controller, and a balance torque that keeps the torso upright. Both scale with a single `strength` value, so the same body blends continuously between fully animated and fully limp.
- **Hybrid control.** A tight platformer controller (coyote time, jump buffer, variable jump, dash, wall slide, step-up) owns gameplay. The ragdoll follows it through muscles. When knocked down the roles swap and the controller rides the pelvis until the body physically gets back up.
- **Procedural animation** (`js/physics/pose.js`). The gait is distance-driven so feet never skate, feet are placed on the real terrain with two-bone IK, landings squash through a spring, double jumps turn into a front flip driven by the balance torque, and attacks are keyframed arm arcs that the physical arm then has to actually travel. Hits are tested against the real blade position, so a lagging arm swings late.
- **Insane but honest.** Big hits, warden slams and very long falls make the body crumple and tumble; killed enemies are launched as limp bodies; flying wardens drag slack legs; capes are cloth chains.

## The world

- **Endless and seeded** (`js/world/world.js`). Generated per 32x32 chunk, in both directions and downward without end. Caves, floating islands, crystal pillars, ice spikes, ember vents, ore veins, sand pockets, trees per biome. Only your edits are saved; everything else regenerates identically.
- **Five biomes** that cycle with distance and darken with each loop: the Pale Meadow, the Glass Wood, the Hollow Below, the Ember Reach and the Frost Spires. Each has its own palette, parallax silhouettes, ambient particles, colour grade and generative score.
- **Boss gates.** Every boundary between biomes is an arena held by a warden. Three archetypes with stronger variants: the Hollow Warden and the Pyre Knight (giant ragdolls: slam waves, wall-stunning charges, leaps), the Glass Widow and the Still Queen (flying ragdolls: volleys, dives, summons, rings, icefall), and the Unmade Heart (a core wrapped in torn-up blocks: throws, pound, spin). Tier scales health and adds patterns; a second phase starts at half health.
- **Shrines** every ~85 tiles. Rest to heal, save and set your respawn. Each is kept by someone: a wanderer (trades blocks), a smith (hones your blade, forges hearths), a sage (more vessels, faster mending) or a tailor (cosmetics). Invite them to live at your hearth.
- **Home.** Place a Hearth and that spot becomes home: your respawn point, and where the people you invite go to live.

## Look and feel

- **Sleek, no outlines.** Tiles are soft voxels with rounded exposed corners, a rim light on top faces and a shade underneath; tree canopies merge into one mass. Shape and depth come from coloured flood-fill lighting (sky light, lanterns, crystals, embers, your own soul glow) multiplied over the scene and upsampled smoothly.
- **Cinematic.** Letterbox bars, serif title cards, biome cards, boss name cards, a warden looming on the horizon as you approach, slow motion and white-out on finishing blows, hit-stop and screen shake scaled by importance, a WebGL post pass with two-level bloom, grade, vignette, grain and a chromatic pulse on impacts.
- **UI.** Glass panels, a minimal HUD (vessels, breath, glimmer, hotbar, a compass to the next gate), typewriter dialogue as subtitles, a character editor with a live ragdoll preview and a generated sigil.
- Accessibility: toggles for screen shake, bright flashes, bloom and touch controls, three quality levels, and an automatic quality step-down if frames stay slow.

## Making the character yours

Body colour, material (linen, porcelain, bronze, lumen, umbra), head (sprout, hood, pale mask, horns, antlers, top hat, halo, crown), cape or scarf, eyes, and blade. Some are found by reaching biomes, some fall with wardens, some are bought from tailors. Every warden also leaves a kintsugi-like mark on your torso. Your sigil is generated from your name and every choice you make.

## Multiplayer

CrazyGames provides invites and rooms, not servers, so play is peer to peer over WebRTC (PeerJS, vendored; the public PeerJS broker handles signalling).

- **Invite a friend.** Menu, Together, Invite. Your world opens, the CrazyGames invite button appears (`showInviteButton`), the room is published with `updateRoom`, and an `inviteLink` is copied. Friends who follow it, or who join through CrazyGames (`addJoinRoomListener`, `getInviteParam`), land in your world.
- **The open world.** Serverless matchmaking: each player tries to claim a well-known shard id; whoever gets it hosts that shard's shared world, everyone else joins it (up to 6 per shard, then the next shard). If the host leaves, a guest takes the shard over and the world carries on. `isInstantMultiplayer` sends players straight in.
- **What is shared.** The host owns the world, enemies and wardens; guests see them as puppets and their hits are applied by the host. Block edits replicate both ways. Remote players are full ragdolls driven by their controller state, so they walk, fall and get knocked about physically on every screen. Friendly blades shove each other but never hurt. Wardens grow stronger for every soul in the session, and everyone in the session earns a relic when one falls. Emotes, name tags (CrazyGames username when signed in), a live soul counter.
- Visiting never touches your own save's world; your glimmer, relics and cosmetics travel with you.

## CrazyGames integration (`js/platform.js`)

SDK v3 loaded async from `sdk.crazygames.com`, initialised with a timeout, and every call is guarded so the game runs the same anywhere. Uses `loadingStart/Stop`, `gameplayStart/Stop` (stopped while the menu is open or the tab is hidden), `happytime` on warden kills, the data module for saves (localStorage fallback), the settings listener for platform mute, the user module for the player's name, and the invite / room APIs above. No ads are requested.

## Project layout

```
index.html, css/style.css
js/main.js              boot and wiring
js/platform.js          CrazyGames SDK wrapper
js/core/                input, audio synth + generative music, WebGL post FX, math/noise
js/physics/             body.js (XPBD ragdoll), pose.js (procedural animation), skin.js (rendering, cape)
js/world/               tiles.js (tiles, biomes), world.js (generation, chunks, edits), render.js, light.js
js/game/                game.js (loop, camera, render pipeline), actor.js, player.js, enemies.js,
                        bosses.js, npcs.js (shrines, keepers, home), story.js (cinematics, hints),
                        progress.js (save, cosmetics, relics, recipes), fx.js
js/ui/                  ui.js (HUD, cards, dialog, menus, editor), touch.js
js/net/net.js           multiplayer
vendor/peerjs.min.js    PeerJS 1.5.4 (MIT)
assets/fonts/           Cormorant Garamond, Manrope (OFL)
tools/                  headless test harness
```

## Testing

The `tools/` folder drives the real game in headless Chromium (Playwright):

```bash
node tools/shot.mjs birth      # the first-launch sequence, screenshots to /tmp/otf-shots
node tools/shot.mjs fight      # husk, brute and wisp combat
node tools/shot.mjs boss       # first gate: intro, fight, death, relic
node tools/shot.mjs build      # mine with the mouse, place a hearth, home is set
node tools/shot.mjs persist    # save, reload, edits and progress survive; death and respawn
node tools/shot.mjs shrine     # meet a keeper, dialogue, menus, editor, craft
node tools/shot.mjs mobile --mobile --size 844x390
```

`tools/mp.mjs` runs a local PeerJS server (needs the `peer` npm package, path in `PEER_MODULES`) and checks the multiplayer flow end to end: hosting, joining, movement sync, block edits both ways, shared enemies, guest damage applied by the host, leaving, open-world shards and host migration.

## Credits

Character design lineage: the mannequin from Rag Toss and Rag Showdown (and Element Rag before them). Fonts: Cormorant Garamond and Manrope (SIL Open Font License). Networking: PeerJS (MIT).
