# Security policy

## Scope

The plugin enforces one property: an assistant response containing a configured reserved-role signature cannot become an assistant history message or execute its tool calls.

It does not authenticate provider traffic, validate the truth of arbitrary natural-language reasoning, sanitize existing session history, or replace version control and backups.

## Reporting

Before publishing this repository, enable GitHub private vulnerability reporting. Report bypasses privately and include:

- DSH and plugin versions;
- provider and model;
- the smallest reproducing stream chunks;
- whether the bypass appeared in reasoning, text, or a tool call.

Do not include API keys or unrelated session content.
