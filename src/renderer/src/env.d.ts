/// <reference types="vite/client" />
declare module '*.svg' {
  const url: string
  export default url
}
import type { Api } from '../../preload'

declare global {
  interface Window {
    api: Api
  }
}
