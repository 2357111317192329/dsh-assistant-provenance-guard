/** Reserved role/protocol forms that assistant output must never impersonate. */
export const BUILTIN_SIGNATURES = Object.freeze([
  Object.freeze({
    id: 'dsh-system-reminder',
    pattern: /<\s*\/?\s*system[\s_-]*reminder\b/i,
  }),
  Object.freeze({
    id: 'dsh-goal-round',
    pattern: /<\s*\/?\s*goal[\s_-]*round\b/i,
  }),
  Object.freeze({
    id: 'system-role-envelope',
    pattern: /(?:<\s*\/?\s*system(?:\s+message)?\s*>|<\|\s*system\s*\|>|(?:^|\r?\n)\s*\[\s*system(?:\s+message)?\s*]\s*:?)/i,
  }),
  Object.freeze({
    id: 'developer-role-envelope',
    pattern: /(?:<\s*\/?\s*developer(?:\s+message)?\s*>|<\|\s*developer\s*\|>|(?:^|\r?\n)\s*\[\s*developer(?:\s+message)?\s*]\s*:?)/i,
  }),
  Object.freeze({
    id: 'user-role-envelope',
    pattern: /(?:<\s*\/?\s*user(?:\s+message)?\s*>|<\|\s*user\s*\|>|(?:^|\r?\n)\s*\[\s*user(?:\s+message)?\s*]\s*:?)/i,
  }),
  Object.freeze({
    id: 'new-user-message-claim',
    pattern: /\bthe\s+user\s+has\s+sent\s+a\s+new\s+message\b/i,
  }),
  Object.freeze({
    id: 'claimed-user-payload-header',
    pattern: /\bthe\s+user(?:'|’)?s\s+message\s+is\s*:/i,
  }),
  Object.freeze({
    id: 'new-turn-directive',
    pattern: /\bplease\s+start\s+a\s+new\s+turn\b/i,
  }),
  Object.freeze({
    id: 'zh-new-user-message-claim',
    pattern: /(?:使用者|用户)(?:已)?(?:傳送|发送|發送|发来|送出)了?(?:一則|一条|一個|一个)?新(?:訊息|消息)/i,
  }),
])

function normalizeForDetection(text) {
  return text.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
}

/** Find the first built-in or user-configured signature in one assistant string. */
export function detectSignature(text, additionalSignatures = []) {
  const normalized = normalizeForDetection(text)
  for (const signature of BUILTIN_SIGNATURES) {
    if (signature.pattern.test(normalized)) return signature.id
  }
  const folded = normalized.toLocaleLowerCase('en-US')
  for (let index = 0; index < additionalSignatures.length; index++) {
    const candidate = additionalSignatures[index]
    if (folded.includes(normalizeForDetection(candidate).toLocaleLowerCase('en-US'))) {
      return `additional-signature-${index + 1}`
    }
  }
  return undefined
}

/** Stateful scanner that joins deltas by output block before matching. */
export class AssistantProvenanceInspector {
  #blocks = new Map()

  constructor(config) {
    this.config = config
  }

  #inspect(channel, index, text, append) {
    if ((channel === 'text' && !this.config.inspectText)
      || (channel === 'reasoning' && !this.config.inspectReasoning)) return undefined

    const key = `${channel}:${index}`
    const complete = append ? `${this.#blocks.get(key) ?? ''}${text}` : text
    this.#blocks.set(key, complete)
    const signature = detectSignature(complete, this.config.additionalSignatures)
    return signature === undefined ? undefined : { signature, channel, index }
  }

  /** Inspect one provider-neutral DSH stream chunk. Tool-call arguments are deliberately excluded. */
  push(chunk) {
    if (chunk.type === 'text-delta') return this.#inspect('text', chunk.index, chunk.text, true)
    if (chunk.type === 'reasoning-delta') return this.#inspect('reasoning', chunk.index, chunk.text, true)
    if (chunk.type !== 'block-end') return undefined
    if (chunk.block?.type === 'text') return this.#inspect('text', chunk.index, chunk.block.text, false)
    if (chunk.block?.type === 'reasoning') return this.#inspect('reasoning', chunk.index, chunk.block.text, false)
    return undefined
  }
}
