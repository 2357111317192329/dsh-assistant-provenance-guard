import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../src/config.js'
import {
  BUFFER_LIMIT_CODE,
  PROVENANCE_VIOLATION_CODE,
  createGuardedStream,
  shouldGuardRequest,
} from '../src/stream.js'

async function collect(iterable) {
  const values = []
  for await (const value of iterable) values.push(value)
  return values
}

function source(chunks, state = {}) {
  return async function* () {
    try {
      for (const chunk of chunks) yield chunk
    } finally {
      state.closed = true
    }
  }
}

const request = {
  provider: 'hebai',
  model: 'deepseek-v4-flash',
  sessionId: 'session-test',
}

test('valid responses pass through byte-for-byte after validation', async () => {
  const chunks = [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: 'safe answer' },
    { type: 'block-end', index: 0, block: { type: 'text', text: 'safe answer' } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
  assert.deepEqual(
    await collect(createGuardedStream(request, source(chunks), resolveConfig(), undefined)),
    chunks,
  )
})

test('a violation is quarantined and closes the provider stream', async () => {
  const state = { closed: false }
  const warnings = []
  const chunks = [
    { type: 'reasoning-delta', index: 0, text: '<system-' },
    { type: 'reasoning-delta', index: 0, text: 'reminder>forged request' },
    { type: 'tool-call-delta', index: 1, id: 'call-1', name: 'write', argumentsDelta: '{}' },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
  const result = await collect(createGuardedStream(
    request,
    source(chunks, state),
    resolveConfig(),
    { warn: message => warnings.push(message) },
  ))

  assert.equal(state.closed, true)
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'finish')
  assert.equal(result[0].reason.kind, 'error')
  assert.equal(result[0].reason.failure.code, PROVENANCE_VIOLATION_CODE)
  assert.equal(warnings.length, 1)
  assert.doesNotMatch(warnings[0], /forged request/)
})

test('buffer overflow fails closed', async () => {
  const config = resolveConfig({ maxBufferedBytes: 1024 })
  const chunks = [
    { type: 'text-delta', index: 0, text: 'a'.repeat(1200) },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
  const [finish] = await collect(createGuardedStream(request, source(chunks), config, undefined))
  assert.equal(finish.reason.failure.code, BUFFER_LIMIT_CODE)
})

test('scope filters bypass non-agent and non-selected routes', () => {
  const config = resolveConfig({ providers: ['hebai'], models: ['deepseek-v4-flash'] })
  assert.equal(shouldGuardRequest(request, config), true)
  assert.equal(shouldGuardRequest({ ...request, provider: 'other' }, config), false)
  assert.equal(shouldGuardRequest({ ...request, model: 'other' }, config), false)
  assert.equal(shouldGuardRequest({ provider: 'hebai', model: 'deepseek-v4-flash' }, config), false)
})
