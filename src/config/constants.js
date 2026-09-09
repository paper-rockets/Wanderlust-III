export const _savedGfx = localStorage.getItem('gfxQuality');
export const LOW_GFX = _savedGfx === 'low'
    || (_savedGfx == null && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4);

export const TERRAIN_RES = LOW_GFX ? 64 : 256;
