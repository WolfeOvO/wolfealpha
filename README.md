# WolfeAlpha

A self-hosted, Wolfram|Alpha-style web app. Ask in **English or Chinese** and get Wolfram|Alpha's computational results — numbers, plots, tables, unit conversions — rendered in a clean WA-style UI. Chinese support works in both directions: Chinese queries are machine-translated to English for Wolfram, and result text is machine-translated to Chinese for display (formulas, numbers and units are kept as-is).

> 自托管的 Wolfram|Alpha 风格计算知识引擎：中英文均可输入（中文自动机翻为英文查询），结果内容自动机翻为中文显示（公式/数字保持原样），完整呈现 Wolfram 计算结果（图表 / 表格 / 单位换算），带缓存与配额保护。

## Features

- **Wolfram-grade answers** via Wolfram's official free **Cloud MCP** endpoint (`https://agenttools.wolfram.com/mcp`, no auth required)
- **Chinese input support** — queries containing Chinese characters are automatically machine-translated to English (no LLM, no API keys; free public MT endpoints with a fallback chain)
- **Chinese result display** — result text (titles, table cells, paragraphs — but not formulas/numbers) is machine-translated to Chinese via a batched `/api/mt` endpoint with a persistent translation cache; the page shows the original first and swaps to Chinese as translations arrive, and repeat views are instant
- **WA-style rendering** — pod layout, images (proxied + cached locally), multi-column tables (both WA pipe-table layouts), key–value rows, ASCII fallback diagrams
- **Aggressive caching** — SQLite result cache (default 3-day TTL) makes repeat queries instant; image cache served with long-lived immutable headers
- **Quota protection** — per-IP rate limit + global daily cap, friendly limit messages
- **Single-container deployment** — FastAPI + uvicorn; no external database; binds `127.0.0.1` by default, ready for any reverse proxy

## How it works

```
Browser ── POST /api/query ──► FastAPI app
   ▲                              │  (Chinese? → machine-translate to English)
   │                              ▼
   │                   Wolfram Cloud MCP (official, free)
   │                              │
   └── pods + /img proxy ◄── SQLite cache (wa.db) + image cache

Browser ── POST /api/mt ──► batched en→zh machine translation (cached in SQLite)
```

## Quick start

```bash
docker compose up -d --build
# open http://127.0.0.1:9410
```

Then point your reverse proxy at `127.0.0.1:9410`. (For CDN setups, note the app sends no special cache headers on HTML/API; static assets are versioned via `?v=`.)

## Configuration

| Variable | Default | Description |
|---|---|---|
| `WA_CACHE_TTL` | `259200` (3 days) | Result cache TTL, in seconds |
| `WA_GLOBAL_DAILY_LIMIT` | `800` | Max upstream calls per day (UTC+8) — protects the free service |
| `WA_PER_IP_PER_MIN` | `20` | Per-IP request limit per minute |
| `WA_MCP_URL` | Wolfram Cloud MCP | Upstream MCP endpoint |

## Notes & disclaimers

- Not affiliated with Wolfram Research. "Wolfram" and "Wolfram|Alpha" are trademarks of Wolfram Research.
- The free Cloud MCP service is intended for **personal, light-scale use** — keep the quota limits sane and don't run it as a high-traffic public service.
- Machine translation (both directions) uses free public MT endpoints (no keys, no LLM). Translated fragments are cached locally so each unique string is only translated once; if the endpoints are unreachable, originals are shown / passed through as-is.
- No accounts, no tracking. The only stored data is the local cache (`data/`).

## License

MIT
