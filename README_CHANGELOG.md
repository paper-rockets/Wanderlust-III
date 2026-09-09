# Wanderlust Development and Settings Log

## Part 1: Simple Summary (For User)

### What Was Done
1. Consolidated Environment Editor:
   - All environment, lighting, weather, sky, cloud, terrain color, sand shimmer, character glow, and preset settings have been gathered into one master Environment menu in the settings panel.
   - Nothing was removed or lost. Everything is now grouped into clear, logical submenus so you do not have to search across different tabs.

2. Gradient Sky and Procedural Clouds:
   - Added a vertical gradient sky dome system with 3 smooth color zones (Top/Zenith, Mid-Sky, and Horizon).
   - Added toggles so you can choose between:
     - Gradient + Clouds (Animated procedural clouds over atmospheric gradient)
     - Gradient Regular (Clean atmospheric gradient dome without clouds)
     - Flat Solid (Original flat sky background)
   - Added quick preset buttons for "Sunset Look" and "Day Sky Look".

3. Dusk Look Synchronization:
   - Applied exact colors and lighting parameters to the Dusk time of day:
     - Sky Zenith Color: Deep twilight blue (#2a5090)
     - Mid-Sky Transition: Rose twilight (#c85078)
     - Horizon and Fog: Warm peach glow (#ffa07a)
     - Sunlight: Golden orange (#ffaa00)
     - Sun Altitude: 160 units (resting on the horizon)
     - Ambient Fill Light: Soft peach (#ffdab9)
     - Water Glint: Golden orange (#ffaa00)

4. Fixes Applied:
   - Fixed the runtime error related to skyMode in the cloud menu.
   - Fixed the runtime error when loading biome data before the character is fully placed.
   - Cleaned up duplicate menus from the top bar so the settings interface is organized and responsive.

---

## Part 2: Technical Reference & Data Log (Complete Engine Data)

### 1. Unified Environment Menu Hierarchy
- Master Folder: Environment
  - Subfolder 1: Atmosphere & Lighting
    - Global Brightness (Exposure): params.exposure (range 0.5 to 4.0, step 0.1)
    - Summer Filter: params.summerFilter (boolean toggle)
    - Shade Mode: params.shadeMode (original, cel, flat)
    - Sky Color: atmoParams.skyColor (hex color)
    - Fog Color: atmoParams.fogColor (hex color)
    - Ambient Light Color: atmoParams.ambColor (hex color)
    - Ambient Intensity: atmoParams.ambI (range 0 to 3)
    - Sun Light Color: atmoParams.dirColor (hex color)
    - Sun Intensity: atmoParams.dirI (range 0 to 5)
    - Water Glint Color: atmoParams.glintCol (hex color)

  - Subfolder 2: Sky & Gradients
    - Sky Mode: params.skyRenderMode (Gradient + Clouds, Gradient Regular, Flat Solid)
    - Procedural Sky Dome: params.showProceduralSky (boolean toggle)
    - Enable Procedural Clouds: params.enableProceduralClouds (boolean toggle)
    - Enable Gradient Curve: gradParams.enabled (skyUniforms.uGradientSkyEnabled)
    - Zenith Color: gradParams.zenith (skyUniforms.uSkyColorZenith)
    - Mid-Sky Color: gradParams.mid (skyUniforms.uSkyColorMid)
    - Horizon Color: gradParams.horizon (skyUniforms.uSkyColorHorizon)
    - Gradient Curve (Power): gradParams.power (range 0.2 to 3.0, step 0.05)
    - Mid-Height Offset: gradParams.midOffset (range 0.05 to 0.8, step 0.01)
    - Sun Flare Glow: gradParams.sunCorona (range 0.0 to 2.0, step 0.05)
    - Horizon Band Glow: gradParams.horizonGlow (range 0.0 to 1.5, step 0.05)
    - Preset: Sunset Look (applies zenith #2a5090, mid #c85078, horizon #ffa07a, power 1.2, midOffset 0.22)
    - Preset: Day Sky Look (applies zenith #4a90d9, mid #7ab4e6, horizon #c8dce8, power 1.0, midOffset 0.25)
    - Subfolder: Procedural Sky (Per Biome)
      - Cloud Coverage (0.0 to 1.0)
      - Cloud Edge (0.02 to 0.25)
      - Cloud Speed (0.0 to 0.2)
      - Sky Zenith, Sky Horizon, Cloud Color, Cloud Shadow
      - Storm Turbulence, Storm Darken, Cloud Opacity, Weather selector

  - Subfolder 3: Sun & God Rays Controls
    - Sun Height (Altitude): params.sunAltitude (range -8000 to 15000)
    - Sun Azimuth (Angle): params.sunAzimuth (range -180 to 180)
    - Lock Sun to Player: params.lockSunToPlayer (boolean)
    - Sun Disc Size: params.sunDiscScale (range 0.5 to 5.0)
    - God Rays Enable: params.godRays (boolean)
    - Ray Intensity: params.godRayIntensity (range 0 to 2.5)
    - Ray Density: params.godRayDensity (range 0.1 to 1.5)
    - Ray Decay: params.godRayDecay (range 0.80 to 0.995)
    - Lum Gate Min & Max: params.lumMin (0.0 - 1.0), params.lumMax (0.0 - 1.0)
    - Highlight Rolloff: params.highlightKnee (0.2 to 1.0)
    - Horizon Glow: params.horizonGlow (0.0 to 1.5)
    - Inner Ray Color: rayColors.inner (godRaysPass.uniforms.uRayColorInner)
    - Outer Ray Color: rayColors.outer (godRaysPass.uniforms.uRayColorOuter)
    - Preset: Apply Sunset Photo Look

  - Subfolder 4: Moonlight & Night
    - Global Brightness: params.exposure
    - Moonlight Color: moonParams.moonlightColor (envConfigs[2].dir)
    - Moonlight Power: moonParams.moonlightIntensity (envConfigs[2].dirI)
    - Night Fill Color: moonParams.nightAmbColor (envConfigs[2].amb)
    - Night Fill Power: moonParams.nightAmbIntensity (envConfigs[2].ambI)
    - Night Sky Color: moonParams.nightSkyColor (envConfigs[2].bg)
    - Night Fog Color: moonParams.nightFogColor (envConfigs[2].fog)
    - Moon Altitude: moonParams.moonAltitude (envConfigs[2].moonY)

  - Subfolder 5: Weather & Fog
    - Global Fog: params.sceneFog
    - Fog Intensity: params.fogIntensity (0.1 to 5.0)
    - Wind: params.wind
    - Wind Trails: params.trails
    - Subfolder: Rain Settings (Enable Rain, Drop Size, Intensity, Wind X, Wind Z)
    - Subfolder: Ground Fog (Per Biome) (Enable Fog, Biome Fog Offset, Ground Fog Editor launcher)

  - Subfolder 6: Terrain Colors & Sand Shimmer
    - Snow Color: northPoleColors.snowDune
    - Snow Shadow: northPoleColors.snowShadow
    - Peak Color: northPoleColors.icePeak
    - Sand Color: desertColors.duneSlope
    - Sand Shadow: desertColors.valleyShadow
    - Shimmer Sparkle: terrainUniforms.uShimmerMult (0.0 to 3.0)

  - Subfolder 7: 3D Clouds & Pastel Editor
    - Show All Clouds: params.showClouds
    - Overall Density: cloudParams.density (0.1 to 2.5)
    - Overall Size: cloudParams.cloudScale (0.5 to 3.0)
    - Subfolder: Visibility Toggles (Volumetric Sky Clouds, Regular, Cumulonimbus, Wispy, Mega, Horizon)
    - Subfolder: Pastel Colors (Color 1 through 5 palette pickers)
    - Subfolders: Regular, Cumulonimbus, Wispy, Mega, Horizon (individual count, scale, opacity controllers)

  - Subfolder 8: Character Glow & Trees
    - Subfolder: Kiki Warm Side Glow (Glow Power, Range, Spread, Color)
    - Subfolder: Global Tree Settings (Tree Scale)

  - Subfolder 9: Ocean & Water
    - Ocean Editor Button (opens animeWaterGUI)

  - Subfolder 10: Environment Presets
    - Clear Desert Day Preset Button

  - Subfolder 11: Save & Load Presets
    - New Preset Name, Save Setting, Select Preset, Load Selected, Delete Selected, Reset to Default

---

### 2. Shader & Rendering Architecture

#### Vertical Gradient Shader (src/shaders/atmosphere/proceduralSky.js)
```javascript
// Multi-Curve 3-Stop Gradient Calculation:
const tLower = clamp(div(viewDirY, uGradientMidOffset), 0.0, 1.0);
const tLowerPow = pow(tLower, uGradientPower);
const lowerBlend = mix(uSkyColorHorizon, uSkyColorMid, tLowerPow);

const tUpper = clamp(div(sub(viewDirY, uGradientMidOffset), sub(1.0, uGradientMidOffset)), 0.0, 1.0);
const tUpperPow = pow(tUpper, uGradientPower);
const fullGradient = mix(lowerBlend, uSkyColorZenith, tUpperPow);
```

#### Synchronized Time of Day Lighting Table (src/main.js & dist/environment_settings.json)
| Setting | Day (0) | Dusk (1) | Twilight / Night (2) |
|---|---|---|---|
| Zenith Sky (bg) | #4a90d9 | #2a5090 | #040816 |
| Mid-Sky (mid) | #7ab4e6 | #c85078 | #0f1d3a |
| Fog Horizon (fog) | #c8dce8 | #ffa07a | #16284d |
| Ambient Light (amb) | #dcf2ff | #ffdab9 | #556688 |
| Ambient Intensity (ambI) | 1.2 | 1.1 | 0.8 |
| Sun / Directional Light (dir) | #fffaeb | #ffaa00 | #88bbff |
| Sun Intensity (dirI) | 2.4 | 3.2 | 1.8 |
| Water Glint (glintCol) | #ffffff | #ffaa00 | #88bbff |
| Sun Y Altitude (sunY) | 10000 | 160 | -8000 |
