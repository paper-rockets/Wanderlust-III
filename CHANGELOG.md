# Changelog

## 2026-08-14 — Ocean Rendering Rework

### Added
- **8-component Gerstner wave spectrum** — expanded from 5 to 8 wave components covering ground swell through fine capillary ripple, producing richer and less repetitive ocean surfaces
- **Domain warping** — low-frequency noise distorts wave sample coordinates, breaking the visible tiling and regularity that appeared at reduced ocean scale
- **Spatial amplitude variation** — large-scale noise modulates wave height across the ocean so different areas have distinct character rather than uniform wave patterns everywhere
- **Sea state presets** — Calm, Normal, Moderate, and Storm presets that adjust wave parameters, steepness, foam, speed, and choppiness to physically plausible values for each condition
- **Sea state preset buttons** in both lil-gui (WaterEditorGUI) and modal (WaterModalUI) panels
- Slider sync system in modal UI that updates all sliders when a sea state preset is applied

### Changed
- **Shore edge rendering** — replaced sharp intersection line + glow halo with smooth depth-based shore foam: multi-layered wash gradient, animated wash lines, Voronoi foam cell texture, and a subtle edge highlight; uses normal blending instead of additive for more natural shore-to-water transitions
- **CPU wave physics** — `getWaterHeightAt()` and `getWaterNormalAt()` now mirror the GPU's domain warping and spatial amplitude variation for accurate buoyancy calculations
- Wave randomization updated to distribute across 8 components with better frequency falloff
- Wind direction spread updated for 8-component spectrum

### Fixed
- Ocean appearing too uniform at all scale settings due to lack of spatial variation
- Shore edges showing harsh white line artifacts instead of natural foam transition
