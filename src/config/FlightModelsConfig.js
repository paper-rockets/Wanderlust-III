// Flight Models Registry & Calibration Config
// Defines models in public/flight_models/ with verified Euler orientation, scale, and animation clips.

export const FLIGHT_MODELS = [
    {
        id: 'psx_saviola_s21',
        name: 'Savoia',
        file: 'flight_models/psx_saviola_s21.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Saviola flight',
        isPlane: true
    },
    {
        id: 'kiki',
        name: 'Kiki',
        file: 'flight_models/kiki-draco.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.3,
        offsetY: 0,
        anim: null
    },
    {
        id: 'mitsubishi_b2m2',
        name: 'B2M2',
        file: 'flight_models/mitsubishi_b2m2_-_game_art_1_stylized_plane.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Flying',
        isPlane: true
    },
    {
        id: 'sopwith_pup',
        name: 'Sopwith',
        file: 'flight_models/sopwith_pup_stylized_-_cupido.glb',
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Take 001',
        isPlane: true
    },
    {
        id: 'sikorski_s16',
        name: 'Sikorsky',
        file: 'flight_models/sikorski_s-16__flying_circus_dae_assignment.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Scene',
        isPlane: true
    },
    {
        id: 'princess',
        name: 'Whale',
        file: 'flight_models/Princess.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 2.8,
        offsetY: 0,
        anim: null
    },
    {
        id: 'american_robin',
        name: 'Robin',
        file: 'flight_models/american_robin_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.5,
        offsetY: 0,
        anim: 'Wings Flapping'
    },
    {
        id: 'wood_pewee',
        name: 'Pewee',
        file: 'flight_models/eastern_wood-pewee_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.5,
        offsetY: 0,
        anim: 'Wings Flapping'
    },
    {
        id: 'american_bittern',
        name: 'Bittern',
        file: 'flight_models/american_bittern_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Wing Flapping'
    },
    {
        id: 'scarlet_macaw',
        name: 'Macaw',
        file: 'flight_models/animated_parrot.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: '02-flying'
    },
    {
        id: 'birds_flock',
        name: 'Flock',
        file: 'flight_models/birds.glb',
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Scene'
    },
    {
        id: 'blue_butterfly',
        name: 'Morpho',
        file: 'flight_models/borboleta_azul_-_butterfly.glb',
        rotX: 0,
        rotY: 270,
        rotZ: 0,
        scale: 2.2,
        offsetY: 0,
        anim: 'ArmatureAction.001'
    },
    {
        id: 'monarch_butterfly',
        name: 'Monarch',
        file: 'flight_models/idl_flight_on_spot.glb',
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 2.8,
        offsetY: 2.5,
        anim: 'Take 001',
        transparent: false,
        alphaTest: 0.01
    },
    {
        id: 'charizard',
        name: 'Charizard',
        file: 'flight_models/charizard_flying_animation.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.8,
        offsetY: 0,
        anim: 'Flying'
    }
];
