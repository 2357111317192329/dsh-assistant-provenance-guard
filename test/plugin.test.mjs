import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROMPT_SECTION_NAME,
  PROVENANCE_VIOLATION_CODE,
  apply,
  inject,
  name,
} from '../src/index.js'

function mockContext() {
  const listeners = new Map()
  const sections = []
  const logs = { warn: [], error: [] }
  return {
    listeners,
    sections,
    logs,
    systemPrompt: { section: value => void sections.push(value) },
    logger: {
      warn: value => logs.warn.push(value),
      error: value => logs.error.push(value),
    },
    on(event, listener, options) {
      listeners.set(event, { listener, options })
      return () => listeners.delete(event)
    },
  }
}

test('plugin exports a normal DSH function-plugin contract', () => {
  assert.equal(name, 'dsh-assistant-provenance-guard')
  assert.deepEqual(inject, ['llm', 'agents', 'systemPrompt'])
})

test('apply registers prompt and prepend guards', () => {
  const ctx = mockContext()
  apply(ctx)
  assert.equal(ctx.sections.length, 1)
  assert.equal(ctx.sections[0].name, PROMPT_SECTION_NAME)
  assert.equal(ctx.listeners.get('llm/stream').options.prepend, true)
  assert.equal(ctx.listeners.get('agent/request-error').options.prepend, true)
})

test('request recovery retries twice and then stops fail-closed', async () => {
  const ctx = mockContext()
  apply(ctx, { maxRetries: 2 })
  const recover = ctx.listeners.get('agent/request-error').listener
  const agent = {}
  const payload = {
    agent,
    turn: 7,
    step: 3,
    failure: { code: PROVENANCE_VIOLATION_CODE, message: 'rejected' },
    signal: new AbortController().signal,
  }
  let delegated = 0
  const next = async () => { delegated++; return undefined }

  assert.deepEqual(await recover(payload, next), { kind: 'retry' })
  assert.deepEqual(await recover(payload, next), { kind: 'retry' })
  assert.equal(await recover(payload, next), undefined)
  assert.equal(delegated, 3)
  assert.equal(ctx.logs.warn.length, 2)
  assert.equal(ctx.logs.error.length, 1)
})

test('unrelated request errors delegate unchanged', async () => {
  const ctx = mockContext()
  apply(ctx)
  const recover = ctx.listeners.get('agent/request-error').listener
  const expected = { kind: 'retry' }
  const result = await recover({
    agent: {}, turn: 1, step: 1,
    failure: { code: 'RATE_LIMIT', message: 'later' },
    signal: new AbortController().signal,
  }, async () => expected)
  assert.equal(result, expected)
})
