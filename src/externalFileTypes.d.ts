// Images
declare module '*.jpg';
declare module '*.png';
declare module '*.env';

// 3D types
declare module '*.glb';
declare module '*.stl';

// Physics
declare module "ammo.js";

// Build-time constants injected by webpack's DefinePlugin
declare const process: { env: { MAPBOX_TOKEN?: string } };
