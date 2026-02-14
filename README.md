# Excel AI Assistant (Office.js + React + Gemini)

A Claude-like Excel task-pane add-in built with Office.js, TypeScript, React, Vite, and Fluent UI.

## What It Includes

- Sidebar chat inside Excel with streaming-style responses.
- Provider abstraction with:
  - Google Gemini (required, implemented)
  - OpenAI (optional, implemented)
  - Anthropic (optional, implemented)
- BYO API key mode (stored in Office Roaming Settings + localStorage fallback).
- Optional proxy mode (`proxyBaseUrl` + `proxyEnabled`), not required for direct use.
- Workbook-aware context pack retrieval:
  - active sheet
  - selected range values/formulas/formats
  - workbook map (sheets, table names, pivot names, chart names)
- Tool-calling agent loop with Office.js tools:
  - read/write, formulas, formatting, sort/filter
  - sheet operations
  - conditional formatting
  - data validation
  - chart and pivot operations (best-effort where API limitations apply)
  - optional web search tool
- Always-on citation format in responses (`[[Sheet!A1]]` style) and clickable citation links.
- Change tracking and diff cards:
  - before/after snapshots
  - changed range highlighting
  - per-change revert
  - undo last turn
- Approval mode (default ON) vs Autonomous mode.
- Risky operation confirmation layer for:
  - external web search
  - large writes (> threshold)
  - overwriting non-empty/formula cells
- Optional session logging to `AI Log` worksheet:
  - prompt, model/provider, token estimates, tool calls, edited ranges, summary
  - memory compaction events
- Auto-compaction memory flow when budget is exceeded.
- Token budget slider with enforced preflight reductions.

## Repository Structure

```text
/src
  /taskpane
  /office
  /llm
  /state
  /ui
/public
/manifest
/docs
/.github/workflows
```

## Prerequisites

- Node.js 20+
- npm 10+
- Excel Desktop (Microsoft 365)
- Office Add-in sideload capability

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start HTTPS dev server (recommended for Office add-ins):

```bash
npm run dev:https
```

This uses `office-addin-dev-certs` and starts a local HTTPS Vite server for debugging.

Use `manifest/manifest.xml` for sideloading.

3. Build bundle:

```bash
npm run build
```

4. Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
```

## Sideloading Instructions

### Windows (Excel Desktop)

1. Start Excel.
2. Go to `Insert` -> `My Add-ins` -> `Manage My Add-ins`.
3. Upload `manifest/manifest.xml`.
4. Open the add-in from `My Add-ins`.

Alternative admin/shared-folder sideloading also works.

### Mac (Excel Desktop)

1. Start Excel.
2. Go to `Insert` -> `Add-ins` -> `My Add-ins`.
3. Upload `manifest/manifest.xml`.
4. Open the add-in.

## GitHub Pages Deployment

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main`
- Steps:
  - install deps
  - lint
  - typecheck
  - tests
  - build
  - deploy `dist/` to GitHub Pages

### Required Manifest URL Update

`manifest/manifest.xml` is configured to:

- `https://azertiv.github.io/excel-ai-assistant/`

If your repository slug differs from `excel-ai-assistant`, update the URL path accordingly.

Also ensure GitHub Pages is enabled for the repository.

## Security Notes

- No secrets are committed.
- API keys are user-provided and stored locally/roaming settings.
- Approval mode defaults ON.
- Web search is OFF by default.
- Risky operations require confirmation.
- Prompt injection warning is shown in Settings.
- Workbook context is trimmed before LLM calls; full workbook dumps are avoided by default.

## Token Budget Slider Behavior

`Max token budget per request` is enforced before each LLM call.

If over budget, the runner reduces context in this order:

1. Trim workbook context to selection-focused pack.
2. Auto-compact older chat turns into memory summary.
3. Drop non-essential workbook map fields (charts/pivots/tables detail).
4. Trim oldest remaining messages until within budget.

Each turn logs estimated input/output tokens to `AI Log` when logging is enabled.

## Provider Notes

### Gemini (Required)

- Default options shown in Settings:
  - `gemini-3-flash-preview`
  - `gemini-3-flash-lite`
- Model is selectable in Settings and shown in header.
- Uses Gemini function declarations where available.
- Falls back to JSON tool-call protocol parsing.
- Streaming: simulated progressive rendering for consistent UX.

### OpenAI / Anthropic

- Implemented behind the same provider interface.
- Optional and configurable in Settings.

## Risk & Approval Modes

- **Approval mode ON**: every workbook-editing tool call requests confirmation.
- **Autonomous mode**: tool calls auto-apply except risky-operation confirmation layer (for sensitive actions).

## AI Log Sheet

When enabled, creates/updates `AI Log` and appends:

- timestamp
- prompt
- provider/model
- estimated input/output tokens
- tool calls + args
- edited ranges
- summary
- memory compaction events

## Sample Prompts

- `Explain why [[Sheet1!D18]] changes when I update [[Sheet1!B3]]`
- `Fix the #REF! errors across the workbook and explain each change`
- `Create a documentation sheet describing all tabs and key formulas`
- `Clean this imported CSV sheet and build a pivot + chart dashboard`
- `Create a scenario sheet with base/bull/bear assumptions and a chart`

## Data Handling

- Data sent to providers is minimized by context-pack strategy.
- Web search calls are optional and user-controlled.
- Do not use this add-in with untrusted spreadsheets containing hostile prompt content.
