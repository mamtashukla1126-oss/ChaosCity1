# CHAOS CITY

**Your City. Your Friends. Your Rules.**

Single-player 2D top-down pixel-art city exploration prototype built with **Phaser 3**, **TypeScript**, and **Vite**.

## Features Implemented

- **5 Interconnected Districts (`80 × 60` tiles / `2560 × 1920` px)**:
  - **Downtown**: Urban towers, glass corporate office, bus stop shelter, streetlights, traffic lights, civic plaza, and crosswalks.
  - **Central Park**: Lush lawns, cobblestone paths, flowerbeds, lily pond, park benches, oak & pine trees, and animated fountains.
  - **Shopping District**: Bean & Byte Cafe (with outdoor bistro patio), Threadz Boutique (with live style cycler), FreshMart Grocery, and Vinyl & Books.
  - **Residential District**: Cozy fenced cottages, Maple Crest Apartments, flower gardens, and neighborhood postboxes.
  - **Entertainment District**: Pixel Palace Arcade, Starlight Cinema, full Eastside Basketball Court, and open plaza.
- **Player Movement & Physics**:
  - 4-directional walk, run, idle, and sitting animations using crisp procedural pixel-art spritesheets with Y-sorted depth.
  - Normalized diagonal movement, delta-time-aware Arcade Physics, and solid world/building/prop collision.
- **Fullscreen, Minimap & Responsive Controls**:
  - Synchronized HUD Fullscreen button (expand/minimize icon + graceful feedback if browser/iframe restricts fullscreen) with automatic Phaser canvas & camera recalculation.
  - Live top-right HUD City Minimap (clickable to expand full Map `[M]`) showing district boundaries, buildings, roads, NPCs, and real-time player position.
- **Controls (PC & Android Touch)**:
  - **Desktop**: `WASD` or `Arrow Keys` to move, `Shift` to run, `E` / `Space` to interact, `M` to open the live Map, `Esc` / `P` to pause.
  - **Mobile / Touch**: Multi-touch virtual joystick (bottom-left), `RUN` and `USE` buttons (bottom-right), plus responsive landscape orientation prompt on portrait mobile screens.
- **UI, Audio & Persistence**:
  - Live panning city Main Menu with Character Preset selector, Settings modal, and About screen.
  - Live Map Overlay rendered from the actual tilemap with real-time player coordinates and NPC markers.
  - Procedural Web Audio API music, footsteps, and interaction sound effects with volume controls and mute.
  - Versioned `localStorage` save system (`chaos_city_save_v1`) with validation and fallback handling.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Build & Type-Check

```bash
npm run lint
npm run build
```
