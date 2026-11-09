# dsh-assistant-provenance-guard

A fail-closed [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/DeepSeek-Harness) plugin that rejects assistant responses impersonating system, developer, user, or goal messages **before any tool call can execute**.

[繁體中文](README.zh-TW.md)

## Why

Some models occasionally emit text that looks like a harness message inside their own reasoning or visible answer. On a later step they may treat that assistant-authored text as a real instruction. Prompt guidance alone cannot reliably contain this failure mode.

This plugin keeps all filesystem, shell, and editing permissions unchanged. It validates model output provenance instead of reducing tool access.

## Enforcement

```text
provider stream -> buffer -> inspect reasoning + text -> commit -> execute tools
```

- The complete response is buffered before DSH receives any chunk.
- Reasoning and visible text are inspected across chunk boundaries.
- Tool-call arguments are not scanned, so an authorized task can still write literal protocol examples to source files.
- A violating response is replaced with a synthetic `ASSISTANT_PROVENANCE_VIOLATION` error finish. It becomes an `assistant/attempt`, not an `assistant/message`; its tool calls never reach the executor or future model history.
- The request is retried up to `maxRetries` times. Repeated violations stop the turn even if another plugin has an unbounded retry policy.
- A small system-prompt section provides defense in depth; runtime quarantine remains the enforcement mechanism.

The built-in signatures cover DSH system reminders and goal rounds, common system/developer/user role envelopes, and English/Chinese fake-new-message phrases. Detection applies Unicode compatibility normalization and removes zero-width formatting characters before matching.

## Install

### Desktop

Open **Plugins → Add plugin**, then enter either the GitHub repository URL or this checkout's absolute path. Restart DSH after installation.

### CLI profiles

```bash
dsh plugin --profile <profile> add <absolute-path-or-github-repository>
```

The repository contains built JavaScript and has no install-time build script or runtime dependency.

## Configuration

```yaml
- id: assistant-provenance-guard
  name: dsh-assistant-provenance-guard
  config:
    enabled: true
    injectPrompt: true
    inspectText: true
    inspectReasoning: true
    maxRetries: 2
    maxBufferedBytes: 4194304
    includeNonAgentRequests: false
    providers: []
    models: []
    additionalSignatures: []
```

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Enable enforcement. |
| `injectPrompt` | `true` | Add protocol-integrity guidance to the system prompt. |
| `inspectText` | `true` | Inspect visible assistant text. |
| `inspectReasoning` | `true` | Inspect reasoning output. Do not disable this for models that expose reasoning. |
| `maxRetries` | `2` | Automatic retries after a provenance violation (`0`-`10`). |
| `maxBufferedBytes` | `4194304` | Hard response-buffer bound (`1024`-`67108864`). Overflow fails closed. |
| `includeNonAgentRequests` | `false` | Also guard LLM calls without a DSH session id, such as auxiliary generation. |
| `providers` | `[]` | Exact provider allowlist; empty guards every provider. |
| `models` | `[]` | Exact model allowlist; empty guards every model. |
| `additionalSignatures` | `[]` | Extra case-insensitive literal strings to reject. |

Unknown or malformed settings fail at plugin load instead of silently weakening protection.

## Trade-offs and limits

- Strict validation delays live token display until a response finishes. This is intentional: releasing early chunks would make complete quarantine impossible.
- Literal reserved role syntax in assistant reasoning/text is rejected even when quoted. Use escaped wording in prose; tool-call arguments remain available for writing exact test fixtures or documentation.
- The plugin blocks structural role impersonation. No output filter can prove that every free-form model belief is true. Keep work in version control and review unexpected project-wide changes.
- Existing contaminated sessions are not rewritten. Start a clean session from a reviewed summary; otherwise a model may silently obey an old forged message without emitting a new detectable marker.

## Development

```bash
npm test
npm run check
```

The test suite uses only Node's built-in test runner.

## License

MIT
