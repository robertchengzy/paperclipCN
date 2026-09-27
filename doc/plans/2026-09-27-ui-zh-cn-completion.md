# Chinese display follow-up and themed configuration selects

This batch merges upstream `a6c4e7a8d11a2cd87a22d38544076cf9bf5f03e7` and preserves the fork's Chinese UI, sign-out flow and Codex managed gateway headers. Upstream adds migration `0284_petite_genesis` and per-user keyboard shortcut preferences; it also fixes remote Grok cancellation and obsolete execution continuations.

## Display contract

- Keep model usage **Token**, **Webhook**, and the product name **Paperclip Runner**. Translate credential tokens, ordinary runners, harnesses, worktrees, traces, fixtures, bots and workers according to context. Provider portal instructions retain original interface names next to Chinese explanations.
- Board governance uses 董事会. A missing human display name uses the separate 董事会成员 key. User names, agent output, raw logs, routes, configuration fields and enum values remain unchanged.
- `projectDisplayName` aliases the exact project name `Onboarding` to 入门引导 in Chinese read-only labels. Callers must use the original name for editing, saving and route generation. `InlineEditor.displayValue` does not change its draft or saved value.
- Both audit feeds use the shared activity mappings. Known non-linkable events omit a redundant entity descriptor; unknown actions and entity types retain diagnostic fallbacks. Language-sensitive memoized labels depend on the current language.
- Theme toggle labels in Chinese name the target mode: 浅色模式 / 深色模式.

## Configuration controls

`ConfigSelect` composes the existing themed Select primitives. It translates declarative option children into themed items and encodes values internally so an empty default remains selectable. The callback returns the original value, including the empty string. Configuration adapters, new-agent forms and secret/trust selectors use it. Searchable model selectors keep their existing search, groups and custom values.

The isolated browser reproduced a white native popup with nearly white option text in dark mode. The replacement uses the existing popover, foreground, border and accent tokens. Validation includes open light/dark menus, keyboard selection, empty default values, asynchronous option labels and custom model input.

## Evidence boundary

The deployment repository records the per-key review, source exemptions, test outcomes, frozen release SHA, migration smoke test and production cutover. Source changes and component tests alone do not establish deployment or complete live business acceptance. No real agent/provider task is required by this localization batch.
