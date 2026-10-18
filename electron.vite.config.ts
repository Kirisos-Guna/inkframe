import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

const define = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
  main: {
    define,
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    define,
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    define,
    resolve: {
      alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') }
    },
    plugins: [react()]
  }
})
