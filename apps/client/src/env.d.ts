/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where matches run (spec #4 M11): "same-origin", a ws:// or wss:// address, or unset for offline play. */
  readonly VITE_SERVER?: string;
}
