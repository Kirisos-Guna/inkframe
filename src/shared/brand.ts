// Change the app name in this one place.
export const APP_NAME = 'Inkframe'
// The part of the name drawn in the accent colour in the sidebar logo ("Ink" + "frame").
export const APP_NAME_SPLIT = 3
// Comes from package.json at build time (see electron.vite.config.ts).
declare const __APP_VERSION__: string
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
