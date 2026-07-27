# 几何潜游：吞噬与进化

A lightweight browser prototype for the fish-gene game concept. It is built as static HTML/CSS/JS, so it can run without Unity, npm, or a build step.

## How to run

Open `index.html` in a browser. A local server is optional.

## Controls

- WASD or arrow keys: move
- 1, 2, 3: trigger the equipped skill in that slot
- Space or Shift: dash when Dash is equipped
- J or left mouse: fire when Shot is equipped
- K or right mouse: scan when Scan is equipped
- UI skill slots trigger the equipped skill directly

## Skill backpack

Linked words identify and unlock skill families in the current genome expression. The player can equip up to three unlocked skills. Each Boss node confirms the current expression and opens the backpack so the loadout can be changed before the next layer.

Current skill families:

- Dash: `dash`, `rush`, `sprint`, `speed`
- Shot: `shot`, `shoot`, `spit`, `bolt`, `bite`
- Nova: `nova`, `pulse`, `wave`, `blast`
- Guard: `guard`, `shield`, `shell`, `armor`
- Freeze: `freeze`, `cold`, `ice`, `slow`
- Scan: `scan`, `see`, `eye`, `look`, `view`
- Growth: `growth`, `grow`, `life`, `feed`
- Splice: `splice`, `gene`, `genome`, `join`
- Echo: `echo`, `repeat`, `word`, `voice`
- Corrode: `corrode`, `decay`, `rust`, `poison`, `weaken`, `drain`

The runtime dictionary currently contains about 3,000 common English words. More than 2,000 of them map into one of these ten skill families, while the listed core words provide especially direct or strong affinity for their matching family.

## First slice goals

The current prototype focuses on a playable vertical slice:

- Eat weaker enemies to gain letters only; ordinary enemies no longer grant permanent experience.
- New letters enter the tail of the genome queue; when full, the oldest letter is pushed out.
- Radar scan reveals nearby enemies' bias letters for a short time.
- Enemy depth increases combat pressure and raises the probability of dropping each enemy's own bias letter.
- Every continuous word occurrence in the current genome queue contributes immediately; overlapping and repeated occurrences are all counted.
- The current genome string drives word multipliers, while visual traits and skill unlocks are confirmed at a Boss node.
- Boss defeat confirms the expression, opens the skill backpack, grants its reward, and sets the next boss depth.

## Combat model

Combat power is based on the current genome instead of accumulated eating experience:

```text
letter score = sum(value of each current genome letter)
current word multiplier = product of every overlapping and repeated word occurrence in the genome string
temporary multiplier = dash and other short-term effects
combat power = ((letter score + base power) * current word multiplier + growth power) * temporary multiplier
```

During normal play, each new letter immediately updates the current letter score and all matching word occurrences. A word may overlap another word or appear multiple times; every occurrence contributes. At a Boss node, the current expression is confirmed and the skill backpack becomes available. If the player collides with an enemy they cannot beat, the combat gap removes a number of factors from the front of the genome queue, naturally lowering combat power.

Gold growth creatures do not drop letters. Each one grants a fixed amount of growth power, with deeper layers using larger fixed values. Because this power is additive, the same creature matters less to an already powerful build and stronger players naturally need to consume more of them. Enemy attacks remove stored growth power, so ordinary combat can temporarily weaken the player without introducing a health bar.

## Failure

Damage passes through two non-health layers. Stored growth power is lost first. Once growth power reaches zero, later hits remove one to three unlocked genome factors. If both growth power and the genome are empty, the next effective hit triggers `Genome Collapse` and ends the run. The failure result records its cause, depth, expressed word count, and defeated Boss count.

Enemy power is set by map layer and regional danger rather than scaling with the player. Growth creatures and letter carriers occupy the lower part of each layer's range, while hunters, spitters, and disruptors occupy progressively more dangerous fixed bands. Rare reward guardians use roughly twice the local area's normal power.

Enemy information is hidden until Scan reveals it. A scanned target temporarily shows its role, combat power, and either its letter or fixed growth-power reward.

Visual roles:

- Growth: green circular core with a gold orbital ring; passive and always grants growth power.
- Letter: cyan diamond core; carries a genome letter but hides it until scanned.
- Hunter: red arrowhead silhouette; locks a route, then performs a fast charge.
- Spitter: orange square body with a visible barrel; keeps range and leads the player's movement before firing.
- Disruptor: purple hexagon with concentric rings; approaches to pulse range and charges an area attack.
- Reward guardian: bright gold or magenta layered rings; territory-bound, rare, and substantially stronger than local enemies.

Growth creatures make up at least half of the normal spawn pool. Some are generated as schools of four to six fish with one or two Hunter/Disruptor guards. The guards patrol the school center and only leave formation when the player enters the school's local danger radius; they return when the player backs away.

## Abilities

- Dash temporarily boosts movement, combat power, and body size.
- Shot fires a gene bolt that lowers one target's combat power.
- Nova weakens every enemy in a nearby area.
- Guard blocks the next effective hit to growth power or the genome.
- Freeze slows enemies and disrupts their active behavior in a wide field.
- Scan reveals enemy combat power, letters, and rewards for a limited time.
- Growth empowers the next several growth-fish rewards.
- Splice moves leading unlocked genome factors to the tail, allowing the current string to be rebuilt without deleting locked words.
- Echo temporarily repeats the strongest currently expressed word multiplier.
- Corrode removes a percentage of a strong enemy's or Boss's combat power.

Every matching word occurrence contributes affinity to its skill family. Overlapping words, repeated words, and matches contained inside longer words all count; the skill system does not impose a one-word-per-expression limit.

### Skill effect catalog

The ten active-skill families now contain ten word-driven effects each, for a total catalog of 100 effects. The playable dictionary contains 3,104 words, with 2,278 assigned to a skill family. Ordinary mapped words retain the family's base current and also receive one stable specialization, so the same word always unlocks the same effect branch. Each of the 80 non-base branches also has a unique semantic trigger word, while direct core words such as `dash`, `bolt`, `freeze`, `join`, `repeat`, and `rust` keep explicit variants and stronger affinity.

Only effects supported by words in the live genome are active. The Boss reward backpack lists each active effect, its contributing words and repeated occurrence counts, and its current potency. Effect hooks are registered through `src/systems/skill-effects.js`; the four catalog waves live in `src/skills/effects-wave1.js` through `effects-wave4.js`.

Visual words:

- `red`, `blue`, `gold`, `dark`: recolor the avatar.
- `fish`, `fin`, `tail`, `scale`: add body traits.

## Future image generation note

Runtime image generation is intentionally postponed. The plan is to call an image-generation API only at failure or successful clear, after the final expression is confirmed. The final generated avatar image, its combat power, and its expressed skills should be saved into a player record. This record design is still temporary and needs a proper name and data model later.

The current avatar visuals are marked for a later polish pass. The first prototype keeps procedural sticker visuals so combat and gene rules can be tested first.

## Current visual direction

The frontend is being restyled toward a clean geometric sci-fi arcade reference: a bright cyan radar arena, neon polygon targets, a pale segmented top HUD, a dark Expression panel, a bottom Genome Queue tile rack, and circular Scan/Dash/Shoot skill controls. Large reference images should be converted to smaller JPG/WebP previews before being used in Codex threads.

## Settings and tuning

The settings panel supports Simplified Chinese and English, music and sound-effect volume, display options, control help, and run-related convenience settings. The current soundtrack is a temporary procedural loop that can be replaced later without changing game rules.

Open `tuning.html` to adjust combat balance locally. Saved values are stored in the browser and can be removed with **恢复内置数值**. The built-in Boss targets use `2x`, `4x`, `8x`, and `16x` the configured 20-slot reference power.

## Module map

- `src/core/`: config, utilities, and state creation.
- `src/systems/`: input, enemies, genome, words, combat, rendering.
- `src/skills/`: one file per skill.
- `src/ui/`: HUD, toasts, and boss reward modal.

This structure is meant to keep each future ability or boss rule small and replaceable.
