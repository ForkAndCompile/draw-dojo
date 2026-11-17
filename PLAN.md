# Draw Dojo — Plan

A small drawing app for people who want to learn to draw. You draw a line, and the
app helps you clean it up as much or as little as you choose.

## The main idea: an "Assist" slider

When you lift the pen, the app does three things with your line:

1. **Recognize**: it works out whether you drew a line, a circle or oval, a curve, or a shape with
   straight sides (triangle, rectangle, square, star or any polygon up to 12 sides, an L or a zig-zag).
2. **Measure**: it checks how far your line is from the perfect shape.
3. **Correct**: it moves your line toward the perfect shape, by as much as the Assist slider says.

| Assist | What happens to your wobbly circle |
|-------:|------------------------------------|
| 0%     | Nothing changes, it's your raw line |
| 30%    | Less wobble, still looks hand-drawn |
| 70%    | Almost clean |
| 100%   | A perfect oval |

The middle settings matter most: the drawing still looks like yours, just cleaner.
The app also shows a faint "ghost" of the perfect shape and a score (like "87% round"),
so you learn instead of just getting fixed.

## Interface

Classic drawing-app layout, everything visible, no hidden menus:

- **Top bar**: the big buttons (Pen, Eraser, Undo, Redo, Clear, Save), the **Assist slider**, and **Learn**.
- **Left panel: Brushes**: Ink pen, Fine liner, Brush pen, Pencil HB, Soft pencil, Marker, Airbrush, Eraser
  (each button shows a live preview stroke; each brush remembers its own size), plus Size, Opacity and Stabilizer sliders.
- **Small extra-tools bar** (next to the canvas): Blur, Smudge, Fill bucket, Eyedropper, Mirror, Show/Hide guides.
- **Right panel: Color**: gradient picker (brightness/strength square + hue bar), hex box, recently used colors.
- **Hold still to pick a line**: hold the pen still for a moment (a ring fills up).
  Eraser on a line = delete that whole line. Pen on a line = recolor it. Pen on an empty area = fill it.
  Crossing lines stay whole. Everything is undoable.
- **Fill bucket** sees all visible layers (guides too), closes gaps in lines (it tries bigger gaps
  if the fill would run out to the page edge), and fills *behind* the lines so they stay crisp.
- **View**: mouse wheel zooms at the cursor, Space+drag or middle button moves the page, ⟲ ⟳ turn it,
  Flip mirrors the view (only the view). Two fingers on a touch screen pinch, turn and move.
  Once a pen is used, touches never draw (palm rejection).
- **Move tool (V)**: press on a line and drag it, or draw a loop around several lines. Corners resize,
  the round handle turns (clicks into place at 0°, 45°, 90°). Enter finishes, Esc cancels, Delete removes.
- **File**: autosave in the browser (your drawing comes back when you reopen the app), New drawing
  (pick a format: fit my screen, 16:9, 9:16, square, 4:5, A4 portrait / landscape, comic page 2:3, or your own size),
  Open (a project or a picture; pictures become a movable layer; you can also drop files on the page),
  Save project (.drawdojo, keeps layers and lines). **Save** still exports a PNG.
- **Reference photo**: show it in a side window to copy from, or Trace (faint, under the drawing,
  never exported). "Move photo" lets you drag it and resize it from its corner.
- **Practice**: drills for circles, straight lines (connect the dots), ovals, curves and boxes.
  Assist is off while practicing, every try gets a score, results are remembered with a small chart,
  and good scores suggest using less Assist.
- **Right panel: Layers**: add, delete, move up/down, hide/show, opacity, plus the light-blue **Guide layer**.
- **Bottom bar**: shape score, hints, and the lesson panel when a lesson is running.

## Learn: method presets for beginners

Press **Learn** and the app asks:

1. **What do you want to draw?** Faces, Bodies, Landscapes, Buildings, Objects, Hands, Animals.
2. **Which method do you want to learn?** Each subject has a few well-known construction methods:
   - Faces: **Circle method** (the classic "ball and jaw" construction), **Head turned (3/4)**, **Box / planes method**, **The eye**
   - Hands: **Mitten method**, **Bones and joints**
   - Animals: **Cat face** (circles), **Four-legged animal** (chest and hip circles)
   - Bodies: **Mannequin** (head, rib cage, pelvis, joints), **Gesture + stick figure**
   - Landscapes: **Horizon and thirds**, **Foreground / middle / background depth**
   - Buildings: **1-point perspective**, **2-point perspective**
   - Objects: **Basic forms** (sphere, box, cylinder)
3. **How experienced are you?** Beginner / Some practice / Confident. This sets the
   starting Assist and stabilizer (more help for beginners, less for confident people).

Each method is a step-by-step lesson on the Guide layer. Every step shows a text hint
and a faint drawing of where the line goes. Steps can **snap** your line to the right
place (the face center line snaps to the middle of your circle; perspective lines snap
toward the vanishing point). Later steps are measured from what you actually drew
(the face proportions follow *your* circle, not a fixed template).

## Features, in order

### Phase 1: a canvas that feels good
- Pen that uses tablet pressure (press harder, thicker line)
- Eraser, undo/redo (Ctrl+Z / Ctrl+Y), clear, save as PNG
- Stabilizer that smooths shaky hands while drawing
- Brushes, color picker with palette, layers panel
- Extra tools: blur, smudge, fill, eyedropper

### Phase 2: shape helper (the main idea)
- Circles, ovals, straight lines and curves get corrected automatically
- The Assist slider, from Off up to Perfect
- Ghost shape and score after each stroke
- Choice of when to correct: after every stroke, or only when you hold the pen still at the end of a line

### Phase 3: guides and lessons
- Light-blue Guide layer for sketch lines that you hide at the end
- Learn menu: subject → method → skill level
- Step-by-step face lesson using the circle method, with snapping and hints
- Box method, mannequin, landscape, 1- and 2-point perspective, basic forms
- Mirror mode: draw one eye and get both

### Phase 4: practice and getting better
- Drills like "draw 10 circles", with a score for each one
- Training wheels that fade: when scores improve, the app suggests less Assist
- Tracing mode: load a photo, make it faint and draw over it
- More lessons: eyes, a head turned to the side, hands, animals, simple bodies in motion

### What we won't build
Brush engines, 100 settings, unlimited layers or filters. Keeping it small is part of the design.

## How it's built

A web app (HTML, JavaScript and canvas) that runs in Chrome or Edge:

- Nothing to install: double-click `index.html` (the landing page), then Start drawing (`app.html`).
- Browsers can read pen pressure.
- Quick to change, so we can try ideas fast.
- Can become an installable Windows app later without starting over.

> **Tablet tip:** for pressure to work in the browser, open your tablet driver
> settings (Wacom, Huion or XP-Pen) and turn **Windows Ink** on.

### Files
- `index.html` — the landing page (also the GitHub Pages site)
- `app.html` — the app's page layout
- `css/style.css` — the look
- `js/core.js` — document, layers, undo history
- `js/brush.js` — stabilizer, brushes, eraser, blur, smudge, fill, eyedropper
- `js/shapes.js` — shape recognition, scoring and correction
- `js/input.js` — pen input, stroke pipeline, ghost and mirror
- `js/ui.js` — panels, colors, layers list, shortcuts, saving
- `js/methods.js` — lesson content (subjects, methods, steps, hint drawings)
- `js/lesson.js` — Learn dialog and the lesson runner

## How we start

1. **Version 0.1** (now): canvas, pressure, undo, stabilizer, brushes, colors, layers,
   extra tools, line/oval/curve correction, Assist slider, Learn menu with the first lessons.
2. **You test it with your tablet**: draw about 20 circles at different Assist levels and
   tell me what feels wrong ("corrects too much", "laggy", "line too thin"...).
3. **We tune it** until drawing feels nice. In a drawing app, how it feels matters most.
4. **Then the face lesson polish** (Phase 3), since that's the problem you actually have.

## Keyboard shortcuts
| Key | Action |
|-----|--------|
| B / P / M / A | Pen / Pencil / Marker / Airbrush |
| E | Eraser |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+S | Save PNG |
| [ / ] | Smaller / bigger brush |
| G | Show / hide guides |
| R | Mirror mode |
| I | Eyedropper |
| V | Move tool (Enter finish, Esc cancel, Delete remove, arrows nudge) |
| + / - / 0 | Zoom in / out / fit the page |
| , / . | Turn the page left / right |
| H | Flip the view |
| Space + drag | Move the page |
