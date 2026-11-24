// OpenRouter: free models from many labs, run through the same Claude Code engine (see agent.ts).

/** OpenRouter's Anthropic-compatible API, which Claude Code speaks to directly. */
export const OPENROUTER_URL = 'https://openrouter.ai/api'

/**
 * The default free model: it can use tools (write the scene files) and read pictures (the checks look at frames).
 * The list in Settings is read live from OpenRouter, so newer free models show up there.
 */
export const OPENROUTER_DEFAULT = 'nvidia/nemotron-3.5-super-vl:free'

/** A free model as Settings shows it. */
export interface OpenRouterModel {
  id: string
  name: string
  context: number
  tools: boolean
  images: boolean
}

/** The free models that can do the app's work (use tools), pictures first, from OpenRouter's public model list. */
export function freeModels(list: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[]; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }[]): OpenRouterModel[] {
  return list
    .filter((m) => (m.id.endsWith(':free') || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)) && m.id !== 'openrouter/free')
    .filter((m) => (m.supported_parameters ?? []).includes('tools') && (m.architecture?.output_modalities ?? ['text']).includes('text'))
    .map((m) => ({ id: m.id, name: m.name ?? m.id, context: m.context_length ?? 0, tools: true, images: (m.architecture?.input_modalities ?? []).includes('image') }))
    .sort((a, b) => Number(b.images) - Number(a.images) || b.context - a.context)
}
