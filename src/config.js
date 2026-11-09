/** Default fail-closed policy. */
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  injectPrompt: true,
  inspectText: true,
  inspectReasoning: true,
  maxRetries: 2,
  maxBufferedBytes: 4 * 1024 * 1024,
  includeNonAgentRequests: false,
  providers: Object.freeze([]),
  models: Object.freeze([]),
  additionalSignatures: Object.freeze([]),
})

const CONFIG_KEYS = new Set(Object.keys(DEFAULT_CONFIG))

function requireBoolean(value, key) {
  if (typeof value !== 'boolean') throw new TypeError(`assistant-provenance-guard: \`${key}\` must be a boolean`)
  return value
}

function requireInteger(value, key, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `assistant-provenance-guard: \`${key}\` must be an integer from ${minimum} through ${maximum}`,
    )
  }
  return value
}

function requireStringList(value, key, { allowEmptyItems = false, itemMax = 256 } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`assistant-provenance-guard: \`${key}\` must be an array`)
  const normalized = []
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new TypeError(`assistant-provenance-guard: every \`${key}\` item must be a string`)
    }
    const text = item.trim()
    if ((!allowEmptyItems && text.length === 0) || text.length > itemMax) {
      throw new TypeError(
        `assistant-provenance-guard: every \`${key}\` item must contain 1-${itemMax} characters`,
      )
    }
    if (!normalized.includes(text)) normalized.push(text)
  }
  return Object.freeze(normalized)
}

/**
 * Validate and detach plugin configuration. Unknown keys fail at load time so a
 * misspelled security setting never silently weakens the guard.
 */
export function resolveConfig(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('assistant-provenance-guard: config must be an object')
  }
  for (const key of Object.keys(input)) {
    if (!CONFIG_KEYS.has(key)) throw new TypeError(`assistant-provenance-guard: unknown config key \`${key}\``)
  }

  const config = {
    enabled: input.enabled === undefined ? DEFAULT_CONFIG.enabled : requireBoolean(input.enabled, 'enabled'),
    injectPrompt: input.injectPrompt === undefined
      ? DEFAULT_CONFIG.injectPrompt
      : requireBoolean(input.injectPrompt, 'injectPrompt'),
    inspectText: input.inspectText === undefined
      ? DEFAULT_CONFIG.inspectText
      : requireBoolean(input.inspectText, 'inspectText'),
    inspectReasoning: input.inspectReasoning === undefined
      ? DEFAULT_CONFIG.inspectReasoning
      : requireBoolean(input.inspectReasoning, 'inspectReasoning'),
    maxRetries: input.maxRetries === undefined
      ? DEFAULT_CONFIG.maxRetries
      : requireInteger(input.maxRetries, 'maxRetries', 0, 10),
    maxBufferedBytes: input.maxBufferedBytes === undefined
      ? DEFAULT_CONFIG.maxBufferedBytes
      : requireInteger(input.maxBufferedBytes, 'maxBufferedBytes', 1024, 64 * 1024 * 1024),
    includeNonAgentRequests: input.includeNonAgentRequests === undefined
      ? DEFAULT_CONFIG.includeNonAgentRequests
      : requireBoolean(input.includeNonAgentRequests, 'includeNonAgentRequests'),
    providers: input.providers === undefined
      ? DEFAULT_CONFIG.providers
      : requireStringList(input.providers, 'providers'),
    models: input.models === undefined
      ? DEFAULT_CONFIG.models
      : requireStringList(input.models, 'models'),
    additionalSignatures: input.additionalSignatures === undefined
      ? DEFAULT_CONFIG.additionalSignatures
      : requireStringList(input.additionalSignatures, 'additionalSignatures', { itemMax: 512 }),
  }

  if (config.enabled && !config.inspectText && !config.inspectReasoning) {
    throw new TypeError(
      'assistant-provenance-guard: at least one of `inspectText` or `inspectReasoning` must be enabled',
    )
  }
  return Object.freeze(config)
}
