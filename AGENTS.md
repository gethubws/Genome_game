# Project Guidance

## Image Reference Safety

This project has a known failure mode where opening or uploading a reference image can make a Codex thread unstable. Treat image references cautiously.

Current environment note: the user is running Codex through Codex++ with a custom relay provider. Real vision works, but image transport paths behave differently:

- Best high-fidelity path: the user uploads a compressed JPG/WebP preview directly into the Codex conversation as an attachment. This gives the active model real in-turn visual context.
- Bad/default local-path path: do not call `view_image` on local reference images by default. In this environment it can inject image data into the thread and may be unreliable.
- Fallback diagnostic path: use `tools/vision-describe.ps1` to send a safe JPEG data URL to Codex++ and return only text. This is useful for debugging and style summaries, but it is not a replacement for in-turn visual context when pixel/layout fidelity matters.

Image workflow:

- Do not call image-viewing tools on original uploaded/reference images by default.
- Do not ask the user to re-upload large images when a local file path is available; first create compressed previews.
- Prefer JPG/WebP previews under 100 KB for direct upload to the conversation.
- Before any visual inspection, create safe previews in `reference_safe/` with long edges around 192 px, 320 px, and 512 px.
- If the user wants high-fidelity redesign from a reference, ask them to upload the 320 px or 512 px preview directly as a chat attachment and first confirm a short visual description before editing.
- Use `tools/vision-describe.ps1` only when direct image attachment is unavailable or when a text-only diagnostic is enough.
- Use the original image only after the user explicitly confirms that risk.
- Avoid embedding local images in final responses unless the user explicitly asks to see them.

## Frontend Redesign Scope

The visual layer is mostly in `styles.css`, `index.html`, `src/systems/render.js`, and `src/ui/hud.js`. Keep gameplay rules in `src/systems/` and `src/skills/` stable unless the user asks for mechanic changes.

## Running

Open `index.html` in a browser. A local static server is optional.
