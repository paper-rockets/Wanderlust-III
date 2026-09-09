# 🧭 Wanderlust — Infinite Procedural 3D Flying Engine

Welcome to **Wanderlust**, an infinite procedural 3D flying engine and exploration game built with Three.js, custom WebGL/WebGPU shaders, toon shading, zero external image textures, and high-performance instanced mesh recycling.

## Play Now

| Version | Link | Notes |
|---|---|---|
| WebGPU (Full Graphics) | [paper-rockets.github.io/Wanderlust-II](https://paper-rockets.github.io/Wanderlust-II/) | Best performance, Chrome/Edge 113+ |
| WebGPU Low Power (Tab S6 Lite) | [paper-rockets.github.io/Wanderlust-II/low-power/](https://paper-rockets.github.io/Wanderlust-II/low-power/) | 20-30 FPS on mobile / Tab S6 Lite |
| WebGL (Compatible) | [paper-rockets.github.io/Wanderlust-II/webgl](https://paper-rockets.github.io/Wanderlust-II/webgl/) | Works on all modern browsers |

---

## 🚀 Quick Start (Run Locally)

### **Option 1: Modern Dev Server (Recommended)**
```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
Open your browser to `http://localhost:3000` (or the port specified in terminal).

### **Option 2: Direct Batch / Local Server**
1. Double-click `LAUNCH_GAME_SERVER.bat` or run a local static HTTP server.
2. Navigate to `http://localhost:8000` or `http://localhost:3000`.

---

## 🎮 Controls

* **Pitch & Yaw (Steering)**: `W` / `A` / `S` / `D` or `Arrow Keys`
* **Boost Flight**: Hold `Shift` *(Spawns dynamic aerodynamic wind trails & FOV warping)*
* **Camera Orbit & Look**: Mouse movement / drag
* **Time of Day & Atmosphere**: In-game UI controls (Seamless transitions between **Day ☀️**, **Twilight 🌅**, and **Night 🌙**)
* **Weather & Biome Selectors**: Toggle weather effects (rain, snow, dynamic mist) and warp directly between procedural biomes.

---

## 🌟 Key Architecture & Engine Features

* **Zero Texture Rule**: 100% of terrain, trees, grass, buildings, clouds, and water are generated procedurally using WebGL primitives, mathematical noise, and custom GLSL/WGSL shaders.
* **Infinite Multi-Biome World Generation**: World terrain streams dynamically in a real-time chunk grid around the player across **9 distinct procedural biomes**:
  1. 🌾 **Plains**: Gentle rolling hills and dense wildflower fields.
  2. 🌿 **Ghibli Valley**: Emerald grass, stylized Ghibli oaks, floating dandelion seeds, and ruins.
  3. 🌴 **Lush Jungle**: Towering tropical canopies, crooked trunks, and localized volumetric fog.
  4. 🏝️ **Archipelago**: Oceanic islands, customizable sandy shores, glassy lagoons, and seagull companion AI.
  5. 🏔️ **Mountains**: Rugged alpine peaks, sheer cliff faces, and dense spruce forests.
  6. 💎 **Crystal Land**: Bioluminescent crystal spires and glowing flora.
  7. 🏜️ **Desert**: Expansive dunes, sandstone mesas, and desert flora.
  8. 🏜️ **Canyon**: Carved red-rock slot canyons and stratified rock formations.
  9. ❄️ **North Pole**: Glacial ice sheets, snowy tundras, and arctic atmospheres.
* **35,000+ Instanced Props at 60 FPS**: Micro-props (grass, flowers, rocks, trees, crystals) utilize matrix recycling pool loops (`THREE.InstancedMesh`) to eliminate runtime garbage collection pauses.
* **Custom Water & Ocean Shaders**: Fragment shader injection (`waterMat.onBeforeCompile`) generates procedural surface ripples, depth darkening, and inland water ripple-suppression over island heightmaps.
* **Procedural Volumetric Clouds & Sky**: Raymarched & toon puffy cloud formations pinned dynamically to player position with dynamic Rayleigh/Mie atmospheric scattering.
* **Dynamic Weather & VFX**: Procedural rain systems, speed-linked wind ribbons, portal warp passes, and biome-specific particle emitters.
* **Procedural Web Audio API**: Ambient synth chord progressions and speed-linked low-pass wind noise generated natively in-browser without external audio files.

---

## 📁 Repository Structure

```
WANDERLUST/
├── index.html                  # Main Application Entry Point
├── DEVELOPMENT_LOG.md          # Comprehensive Architecture & Project Timeline Log
├── vite.config.ts              # Vite Bundler & Build Configuration
├── package.json                # Project Dependencies & NPM Scripts
│
├── src/                        # Modular Engine Source Code
│   ├── main.js                 # Engine Bootstrapper & Lifecycle
│   ├── core/                   # Game Loop, Camera, Input Controls
│   ├── entities/               # Player Character, Broom Physics, Companion AI
│   ├── environment/            # Atmosphere, Sky Configs, Dynamic Lighting, Clouds
│   ├── physics/                # Flight Aerodynamics & Terrain Collision
│   ├── shaders/                # WebGL & WebGPU Custom Shader Library
│   ├── ui/                     # Real-Time GUI, Biome Selector & Debug Tools
│   ├── vfx/                    # Weather Particles, Wind Trails, Toon Shaders
│   └── world/                  # Chunk Manager, Noise Generators & Biome Modules
│       └── biomes/             # Procedural Generators for all 9 Biomes
│
├── assets/                     # 3D Meshes & Asset Storage
├── public/                     # Static Game Assets (GLB Models, Billboards)
└── shaders/                    # Raw GLSL / WGSL Shader Sources
```

---

## 🛠️ Utility Tools Included

* **Mobile Simulator & Dev Testbench**: Located at `mobile_test.html` for testing mobile responsive viewports, touch joysticks, landscape/portrait switching, and hardware presets right on PC.
* **Terrain & Heightmap Editor**: Real-time in-game parameter tuning for noise octaves, terrain heights, and biome weights.
* **Model Viewer**: Located at `model_viewer.html` for previewing and inspecting 3D `.glb` assets and animations.
* **Tree & Billboard Studio**: Tools for generating and previewing optimized procedural foliage billboards.


---

## 📄 Documentation

For full architectural details, complete multi-biome specifications, and the project's historical development log, refer to [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md).

---

## 🙏 Acknowledgements & Credits

* **WebGPU Ocean Shader (`src/WaterAnime/OpenSeaOcean.js`)**: 
  * The core Three.js TSL / WebGPU Gerstner wave and FBM micro-surface shader foundation was adapted from the [Kimi AI "Open Sea — Realtime Ocean" Prototype](https://qdtipu6rd2myk.ok.kimi.link/?id=2077778000455245824&share_id=19f6b13b-b432-8eb2-8000-0000c67df4cd).
  * Expanded and enhanced in Wanderlust with dynamic object wake physics, CPU buoyancy calculations, real-time GUI editors, and shoreline depth intersections.
* **Procedural Math & Graphics Foundations**:
  * **Inigo Quilez ([iquilezles.org](https://iquilezles.org))**: Smooth Voronoi distance fields and caustics.
  * **Stefan Gustavson & Ashima Arts**: WebGL Simplex noise (`webgl-noise`).
  * **nimitz / David Hoskins**: Volumetric cloud raymarching (`SpiralNoiseC`).
  * **thatgamecompany & Alan Zucconi**: Specular sand glitter and dune lighting concepts (*Journey*).
  * **Jerry Tessendorf & Mark Finch (GPU Gems)**: Gerstner wave models and simulation.
  * **Kenny Mitchell (GPU Gems 3)**: Volumetric light scattering post-processing.


