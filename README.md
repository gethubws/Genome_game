# Gene Current Prototype

A lightweight browser prototype for the fish-gene game concept. It is built as static HTML/CSS/JS, so it can run without Unity, npm, or a build step.

## How to run

Open `index.html` in a browser. A local server is optional.

## Controls

- WASD or arrow keys: move
- Space or Shift: dash
- J or left mouse: fire a weakening shot
- K or right mouse: gene radar scan
- UI buttons can also trigger Scan, Dash, and Shot

## First slice goals

The current prototype focuses on a playable vertical slice:

- Eat weaker enemies to gain letters only; ordinary enemies no longer grant permanent experience.
- New letters enter the tail of the genome queue; when full, the oldest letter is pushed out.
- Radar scan reveals nearby enemies' bias letters for a short time.
- Enemy depth increases combat pressure and raises the probability of dropping each enemy's own bias letter.
- Words are previewed automatically from the current genome queue.
- Word multipliers, visual traits, and skill enhancements are expressed only at birth and after Boss rewards.
- Boss defeat grants a random word, expands genome capacity, refreshes expression, and sets the next boss depth.

## Combat model

Combat power is based on the current genome instead of accumulated eating experience:

```text
letter score = sum(value of each current genome letter)
expressed multiplier = word multiplier settled at birth or after a Boss
temporary multiplier = dash and other short-term effects
combat power = letter score * expressed multiplier * temporary multiplier
```

During normal play, new letters only change the current letter score and the potential words that could be expressed at the next settlement. If the player collides with an enemy they cannot beat, the combat gap removes a number of factors from the front of the genome queue, naturally lowering combat power.

## Ability plan

Base actions:

- Scan: a non-slot radar pulse. It reveals enemy bias letters briefly.
- Dash: active slot. It temporarily boosts combat power and body size during the dash window.
- Shot: active slot. It weakens enemies without changing their body size.

Word-family upgrades:

- `see`, `eye`, `look`, `view`: improve scan radius, reveal time, and cooldown.
- `dash`, `rush`, `swim`, `sprint`: improve dash duration, speed, and boost.
- `shot`, `shoot`, `spit`, `bolt`: improve shot speed, cooldown, and weakening strength.

Visual words:

- `red`, `blue`, `gold`, `dark`: recolor the avatar.
- `fish`, `fin`, `tail`, `scale`: add body traits.

## Future image generation note

Runtime image generation is intentionally postponed. The plan is to call an image-generation API only at failure or successful clear, after one final word scan/settlement. The final generated avatar image, its combat power, and its expressed skills should be saved into a player record. This record design is still temporary and needs a proper name and data model later.

The current avatar visuals are marked for a later polish pass. The first prototype keeps procedural sticker visuals so combat and gene rules can be tested first.

## Current visual direction

The frontend is being restyled toward a clean geometric sci-fi arcade reference: a bright cyan radar arena, neon polygon targets, a pale segmented top HUD, a dark Expression panel, a bottom Genome Queue tile rack, and circular Scan/Dash/Shoot skill controls. Large reference images should be converted to smaller JPG/WebP previews before being used in Codex threads.

## Module map

- `src/core/`: config, utilities, and state creation.
- `src/systems/`: input, enemies, genome, words, combat, rendering.
- `src/skills/`: one file per skill.
- `src/ui/`: HUD, toasts, and boss reward modal.

This structure is meant to keep each future ability or boss rule small and replaceable.
