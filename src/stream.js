import { AssistantProvenanceInspector } from './detector.js'

/** Stable failure code emitted when an assistant impersonates a reserved role. */
export const PROVENANCE_VIOLATION_CODE = 'ASSISTANT_PROVENANCE_VIOLATION'
/** Stable failure code emitted when strict buffering exceeds its configured bound. */
export const BUFFER_LIMIT_CODE = 'ASSISTANT_PROVENANCE_BUFFER_LIMIT'

/** Whether one request is in the configured enforcement scope. */
export function shouldGuardRequest(options, config) {
  if (!config.enabled) return false
  if (!config.includeNonAgentRequests && options.sessionId === undefined) return false
  if (config.providers.length > 0 && !config.providers.includes(options.provider)) return false
  if (config.models.length > 0 && !config.models.includes(options.model)) return false
  return true
}

function chunkBytes(chunk) {
  try {
    return Buffer.byteLength(JSON.stringify(chunk) ?? '', 'utf8')
  } catch {
    // Stream chunks are required to be serializable. Charge the full budget if
    // a third-party extension violates that rule, keeping the guard fail-closed.
    return Number.MAX_SAFE_INTEGER
  }
}

function failureChunk(code, message) {
  return {
    type: 'finish',
    reason: {
      kind: 'error',
      failure: { code, message },
    },
  }
}

function safeWarn(logger, message) {
  try {
    logger?.warn?.(message)
  } catch {
    // Diagnostics must never turn a rejected model response into an unhandled error.
  }
}

function requestLabel(options) {
  const route = `${options.provider ?? '<unknown-provider>'}/${options.model ?? '<unknown-model>'}`
  return options.sessionId === undefined ? route : `${route} session=${String(options.sessionId)}`
}

/**
 * Buffer and validate a complete assistant stream before exposing any chunk to
 * the agent loop. Rejected streams expose only a synthetic error finish, so no
 * assistant message or tool call from them can commit.
 */
export function createGuardedStream(options, next, config, logger) {
  if (!shouldGuardRequest(options, config)) return next()

  return (async function* () {
    const buffered = []
    const inspector = new AssistantProvenanceInspector(config)
    let bytes = 0
    let rejection

    for await (const chunk of next()) {
      buffered.push(chunk)
      bytes += chunkBytes(chunk)

      const violation = inspector.push(chunk)
      if (violation !== undefined) {
        rejection = failureChunk(
          PROVENANCE_VIOLATION_CODE,
          `Assistant response rejected: reserved provenance signature "${violation.signature}" appeared in ${violation.channel} output`,
        )
        safeWarn(
          logger,
          `assistant-provenance-guard: rejected ${requestLabel(options)}; signature=${violation.signature}; channel=${violation.channel}`,
        )
        break
      }

      if (bytes > config.maxBufferedBytes) {
        rejection = failureChunk(
          BUFFER_LIMIT_CODE,
          `Assistant response rejected: buffered stream exceeded ${config.maxBufferedBytes} bytes`,
        )
        safeWarn(
          logger,
          `assistant-provenance-guard: rejected ${requestLabel(options)}; buffered response exceeded ${config.maxBufferedBytes} bytes`,
        )
        break
      }
    }

    if (rejection !== undefined) {
      yield rejection
      return
    }
    yield* buffered
  })()
}
