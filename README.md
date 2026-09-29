# WolfeAlpha

A self-hosted, Wolfram|Alpha-style web app. Ask in **English or Chinese** and get Wolfram|Alpha's computational results — numbers, plots, tables, unit conversions — rendered in a clean WA-style UI.

> 自托管的 Wolfram|Alpha 风格计算知识引擎：中英文均可输入（中文自动机翻为英文），完整呈现 Wolfram 计算结果（图表 / 表格 / 单位换算），带缓存与配额保护。

## Features

- **Wolfram-grade answers** via Wolfram's official free **Cloud MCP** endpoint (`https://agenttools.wolfram.com/mcp`, no auth required)
- **Chinese input support** — queries containing Chinese characters are automatically machine-translated to English (no LLM, no API keys; free public MT endpoints with a fallback chain)
- **WA-style rendering** — pod layout, images (proxied + cached locally), multi-column tables, key–value rows, ASCII fallback diagrams
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
- Chinese→English translation uses free public machine-translation endpoints (no keys, no LLM). If they are unreachable, Chinese queries are passed through as-is.
- No accounts, no tracking. The only stored data is the local query cache (`data/`).

## License

MIT
