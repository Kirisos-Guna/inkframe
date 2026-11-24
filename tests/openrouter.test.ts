import { describe, expect, it } from 'vitest'
import { freeModels } from '../src/shared/openrouter'
import { resetFromText } from '../src/main/services/limits'

describe('OpenRouter free models', () => {
  it('keeps free models that can use tools, picture readers first', () => {
    const list = freeModels([
      { id: 'a/text:free', context_length: 9, supported_parameters: ['tools'], architecture: { input_modalities: ['text'] } },
      { id: 'b/vision:free', context_length: 5, supported_parameters: ['tools'], architecture: { input_modalities: ['text', 'image'] } },
      { id: 'c/notools:free', supported_parameters: [], architecture: { input_modalities: ['text'] } },
      { id: 'd/paid', pricing: { prompt: '0.001', completion: '0.002' }, supported_parameters: ['tools'] },
      { id: 'openrouter/free', supported_parameters: ['tools'] },
      { id: 'e/music:free', supported_parameters: ['tools'], architecture: { output_modalities: ['audio'] } }
    ])
    expect(list.map((m) => m.id)).toEqual(['b/vision:free', 'a/text:free'])
    expect(list[0].images).toBe(true)
  })
  it('waits a minute for the per-minute limit and until midnight UTC for the daily one', () => {
    const now = Date.UTC(2026, 10, 24, 15, 0, 0)
    expect(resetFromText('Rate limit exceeded: free-models-per-min', now)).toBe(now + 65_000)
    expect(resetFromText('Rate limit exceeded: free-models-per-day', now)).toBe(Date.UTC(2026, 10, 25) + 60_000)
  })
})
