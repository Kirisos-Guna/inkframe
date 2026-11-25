// OpenCode: the free models of the OpenCode desktop app, run through its console tool (see agent.ts).

/**
 * The default free models, picked by making the same video with each: Big Pickle draws and writes (fuller scenes, its
 * parts passed their checks), and Nemotron VL, which reads pictures, does the quick jobs (the checks look at frames).
 * Settings lists every model OpenCode offers that is free.
 */
export const OPENCODE_DEFAULT = 'opencode/big-pickle'
export const OPENCODE_QUICK_DEFAULT = 'opencode/nemotron-3.5-super-vl-free'

/** OpenCode's free models from the names `opencode models` prints: "-free" ones, and Big Pickle (free while in beta). */
export const freeOpenCodeModels = (names: string[]) =>
  names.map((n) => n.trim()).filter((n) => /^opencode\/[\w.-]+$/.test(n) && (/-free$/.test(n) || n === 'opencode/big-pickle'))
