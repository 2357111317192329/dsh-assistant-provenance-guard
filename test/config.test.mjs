import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, resolveConfig } from '../src/config.js'

test('resolveConfig returns strict defaults', () => {
  const config = resolveConfig()
  assert.equal(config.maxRetries, 2)
  assert.equal(config.inspectReasoning, true)
  assert.equal(config.inspectText, true)
  assert.equal(config.includeNonAgentRequests, false)
  assert.deepEqual(config.providers, [])
  assert.equal(Object.isFrozen(config), true)
  assert.equal(DEFAULT_CONFIG.maxBufferedBytes, 4 * 1024 * 1024)
})

test('resolveConfig normalizes and deduplicates string lists', () => {
  const config = resolveConfig({
    providers: [' hebai ', 'hebai'],
    models: ['deepseek-v4-flash'],
    additionalSignatures: [' forged instruction '],
  })
  assert.deepEqual(config.providers, ['hebai'])
  assert.deepEqual(config.models, ['deepseek-v4-flash'])
  assert.deepEqual(config.additionalSignatures, ['forged instruction'])
})

test('resolveConfig fails loud on weakening mistakes', () => {
  assert.throws(() => resolveConfig({ inspectText: false, inspectReasoning: false }), /at least one/)
  assert.throws(() => resolveConfig({ maxRetires: 2 }), /unknown config key/)
  assert.throws(() => resolveConfig({ maxRetries: -1 }), /integer/)
  assert.throws(() => resolveConfig({ providers: [''] }), /1-256/)
})
