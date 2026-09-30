# WolfeAlpha backend — personal Wolfram|Alpha-style search site.
# Compute via the official free Wolfram Cloud MCP endpoint (no auth required).
# Results cached in SQLite; WA images proxied + cached locally.
# Chinese queries auto-translated to English via free machine-translation
# endpoints (no LLM): clients5.google.com (dict-chrome-ex) -> MyMemory.
# Result text (en -> zh) translated lazily through /api/mt with a local cache.
import asyncio
import hashlib
import html as _html
import json
import os
import re
import sqlite3
import time
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(os.environ.get("WA_DATA_DIR", "/app/data"))
STATIC_DIR = Path(os.environ.get("WA_STATIC_DIR", "/app/static"))
DB_PATH = DATA_DIR / "wa.db"
IMG_DIR = DATA_DIR / "img"
MCP_URL = os.environ.get("WA_MCP_URL", "https://agenttools.wolfram.com/mcp")
CACHE_TTL = int(os.environ.get("WA_CACHE_TTL", str(3 * 86400)))            # seconds
GLOBAL_DAILY_LIMIT = int(os.environ.get("WA_GLOBAL_DAILY_LIMIT", "800"))   # upstream calls / day
PER_IP_PER_MIN = int(os.environ.get("WA_PER_IP_PER_MIN", "20"))
MAX_QUERY_LEN = 500

DATA_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS queries ("
        " qkey TEXT PRIMARY KEY, query TEXT, raw TEXT, src_url TEXT,"
        " created REAL, hits INTEGER DEFAULT 0, trans TEXT DEFAULT '')"
    )
    try:
        conn.execute("ALTER TABLE queries ADD COLUMN trans TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    conn.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
    conn.execute("CREATE TABLE IF NOT EXISTS mt (src TEXT PRIMARY KEY, dst TEXT, ts REAL)")
    return conn


def cache_get(qkey):
    conn = db()
    try:
        row = conn.execute(
            "SELECT query, raw, src_url, created, hits, trans FROM queries WHERE qkey=?",
            (qkey,),
        ).fetchone()
        if not row:
            return None
        query, raw, src_url, created, hits, trans = row
        if time.time() - created > CACHE_TTL:
            return None
        conn.execute("UPDATE queries SET hits=hits+1 WHERE qkey=?", (qkey,))
        conn.commit()
        return {"query": query, "raw": raw, "src_url": src_url, "created": created,
                "hits": hits + 1, "trans": trans or ""}
    finally:
        conn.close()


def cache_put(qkey, query, raw, src_url, trans=""):
    conn = db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO queries (qkey, query, raw, src_url, created, hits, trans)"
            " VALUES (?,?,?,?,?, COALESCE((SELECT hits FROM queries WHERE qkey=?),0), ?)",
            (qkey, query, raw, src_url, time.time(), qkey, trans),
        )
        conn.commit()
    finally:
        conn.close()


def norm_key(q):
    q = re.sub(r"\s+", " ", q.strip().lower())
    return hashlib.sha1(q.encode("utf-8")).hexdigest()


# ---------- rate limiting ----------
_ip_hits = defaultdict(deque)
_mt_hits = defaultdict(deque)


def ip_allowed(ip):
    now = time.time()
    dq = _ip_hits[ip]
    while dq and now - dq[0] > 60:
        dq.popleft()
    if len(dq) >= PER_IP_PER_MIN:
        return False
    dq.append(now)
    return True


def mt_ip_allowed(ip):
    now = time.time()
    dq = _mt_hits[ip]
    while dq and now - dq[0] > 60:
        dq.popleft()
    if len(dq) >= 60:
        return False
    dq.append(now)
    return True


def daily_key():
    return "daily:" + time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))  # UTC+8


def daily_used():
    key = daily_key()
    conn = db()
    try:
        row = conn.execute("SELECT v FROM meta WHERE k=?", (key,)).fetchone()
        return key, int(row[0]) if row else 0
    finally:
        conn.close()


def daily_bump(key):
    conn = db()
    try:
        conn.execute(
            "INSERT INTO meta (k, v) VALUES (?, '1')"
            " ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER)+1 AS TEXT)",
            (key,),
        )
        conn.commit()
    finally:
        conn.close()


def client_ip(request: Request):
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    xr = request.headers.get("x-real-ip")
    if xr:
        return xr
    return request.client.host if request.client else "?"


# ---------- translation (machine translation only, no LLM) ----------
CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
GOOGLE_MT = "https://clients5.google.com/translate_a/t"
MYMEMORY_MT = "https://api.mymemory.translated.net/get"


def _parse_clients5(data):
    """clients5 response shapes: [["text","src"], ...] (zh->en) or ["text"] (en->zh)."""
    if isinstance(data, list) and data and isinstance(data[0], str):
        return data[0].strip() or None
    try:
        inner = data[0]
    except Exception:
        return None
    parts = []
    if isinstance(inner, list) and inner and all(isinstance(x, str) for x in inner):
        parts = [inner[0]]
    elif isinstance(inner, list):
        for seg in inner:
            if isinstance(seg, list) and seg and isinstance(seg[0], str):
                parts.append(seg[0])
    text = " ".join(p.strip() for p in parts if p and p.strip())
    return text or None


async def translate_to_en(text):
    """Translate Chinese query to English. Returns None if not needed or failed.
    Two full passes over the provider chain to absorb transient failures."""
    if not CJK_RE.search(text):
        return None
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
        for _pass in range(2):
            # 1) Google clients5 (dict-chrome-ex)
            try:
                r = await client.get(GOOGLE_MT, params={"client": "dict-chrome-ex", "sl": "auto", "tl": "en", "q": text})
                r.raise_for_status()
                out = _parse_clients5(r.json())
                if out and not CJK_RE.search(out):
                    return out.strip()[:MAX_QUERY_LEN]
            except Exception:
                pass
            # 2) MyMemory
            try:
                r = await client.get(MYMEMORY_MT, params={"q": text, "langpair": "zh-CN|en"})
                r.raise_for_status()
                d = r.json()
                out = _html.unescape((d.get("responseData") or {}).get("translatedText") or "").strip()
                if out and out.lower() != text.lower() and not CJK_RE.search(out):
                    return out.strip()[:MAX_QUERY_LEN]
            except Exception:
                pass
    return None


# ---------- result-text translation (en -> zh) ----------
MT_SEM = asyncio.Semaphore(8)
MT_MAX_ITEM = 380
MT_REQ_MAX = 250


def _needs_tr(s):
    """Only translate strings that carry real English words and are not
    formulas/unit fragments (those stay as-is, per product decision)."""
    if not s or len(s) > MT_MAX_ITEM:
        return False
    if CJK_RE.search(s):
        return False
    if re.fullmatch(r"[A-Z][a-z]?", s):
        return False  # element symbols (Li, Na, ...) stay as-is
    if not re.search(r"[A-Za-z]{2,}", s):
        return False
    if len(s) <= 80 and re.search(r"[\^_=]", s) and len(re.findall(r"[A-Za-z]{4,}", s)) < 2:
        return False
    if "->" in s:
        return False
    if re.search(r"[a-z]{2,5}\(", s, re.I):
        return False
    if not re.search(r"[A-Za-z]{4,}", s) and re.search(r"\d", s):
        return False
    return True


def mt_cache_get(src):
    conn = db()
    try:
        row = conn.execute("SELECT dst FROM mt WHERE src=?", (src,)).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def mt_cache_put(src, dst):
    conn = db()
    try:
        conn.execute("INSERT OR REPLACE INTO mt (src, dst, ts) VALUES (?,?,?)", (src, dst, time.time()))
        conn.commit()
    finally:
        conn.close()


async def translate_en2zh(text):
    """Translate a result-text fragment to Chinese via the free MT chain."""
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
        for _pass in range(2):
            try:
                r = await client.get(GOOGLE_MT, params={"client": "dict-chrome-ex", "sl": "en", "tl": "zh-CN", "q": text})
                r.raise_for_status()
                out = _parse_clients5(r.json())
                if out and CJK_RE.search(out):
                    return out.strip()[:600]
            except Exception:
                pass
            try:
                r = await client.get(MYMEMORY_MT, params={"q": text, "langpair": "en|zh-CN"})
                r.raise_for_status()
                d = r.json()
                out = _html.unescape((d.get("responseData") or {}).get("translatedText") or "").strip()
                if out and out.lower() != text.lower() and CJK_RE.search(out):
                    return out.strip()[:600]
            except Exception:
                pass
    return None


# ---------- MCP call ----------
RESULT_OPEN = re.compile(r"^<result[^>]*?url='([^']*)'[^>]*>\s*", re.S)
RESULT_CLOSE = re.compile(r"\s*</result>\s*$")


async def call_mcp(query: str):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "WolframAlpha", "arguments": {"query": query}},
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "User-Agent": "WolfeAlpha/0.1 (personal use)",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(75.0, connect=10.0)) as client:
        resp = await client.post(MCP_URL, json=payload, headers=headers)
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "")
        body = resp.text
    if "text/event-stream" in ctype:
        chunks = [ln[5:].strip() for ln in body.splitlines() if ln.startswith("data:")]
        body = "".join(chunks)
    data = json.loads(body)
    if "error" in data:
        raise RuntimeError(str(data["error"])[:300])
    content = data.get("result", {}).get("content") or []
    if not content:
        raise RuntimeError("empty result")
    raw = (content[0].get("text") or "").strip()
    m = RESULT_OPEN.match(raw)
    src_url = m.group(1) if m else ""
    raw = RESULT_OPEN.sub("", raw, count=1)
    raw = RESULT_CLOSE.sub("", raw, count=1)
    return raw.strip(), src_url


# ---------- routes ----------
@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /\n", media_type="text/plain")


@app.get("/api/health")
def health():
    _, used = daily_used()
    return {"ok": True, "daily_used": used, "daily_limit": GLOBAL_DAILY_LIMIT, "ts": int(time.time())}


@app.post("/api/query")
async def api_query(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "bad request"}, status_code=400)
    q = str(body.get("q", "")).strip()
    if not q or len(q) > MAX_QUERY_LEN:
        return JSONResponse({"ok": False, "error": "请输入 1-%d 字符的查询内容" % MAX_QUERY_LEN}, status_code=400)

    if not ip_allowed(client_ip(request)):
        return JSONResponse(
            {"ok": False, "error": "请求太频繁，请稍后再试（每分钟 %d 次上限）" % PER_IP_PER_MIN},
            status_code=429,
        )

    qkey = norm_key(q)
    hit = cache_get(qkey)
    if hit:
        return {
            "ok": True, "cached": True, "query": hit["query"], "raw": hit["raw"],
            "url": hit["src_url"], "created": int(hit["created"]), "hits": hit["hits"],
            "translated_to": hit["trans"] or None,
        }

    key, used = daily_used()
    if used >= GLOBAL_DAILY_LIMIT:
        return JSONResponse(
            {"ok": False, "error": "今日总配额已用完（%d 次），请明天再来" % GLOBAL_DAILY_LIMIT},
            status_code=429,
        )

    tq = await translate_to_en(q)
    effective_q = tq or q
    mt_failed = bool(CJK_RE.search(q)) and tq is None

    t0 = time.time()
    try:
        raw, src_url = await call_mcp(effective_q)
    except httpx.TimeoutException:
        return JSONResponse({"ok": False, "error": "Wolfram 服务超时，请稍后重试"}, status_code=504)
    except Exception as e:
        return JSONResponse({"ok": False, "error": "上游服务错误：%s" % str(e)[:200]}, status_code=502)
    ms = int((time.time() - t0) * 1000)

    if not raw:
        return JSONResponse({"ok": False, "error": "未找到可显示的结果（试试换个问法）"}, status_code=200)

    # If it was a Chinese query and translation failed, don't cache a "No Results"
    # (so a retry can succeed once the MT endpoint recovers).
    skip_cache = mt_failed and raw.startswith("No Results")
    if not skip_cache:
        cache_put(qkey, q, raw, src_url, tq or "")
        daily_bump(key)
    return {"ok": True, "cached": False, "query": q, "raw": raw, "url": src_url,
            "ms": ms, "translated_to": tq, "mt_failed": mt_failed}


@app.post("/api/mt")
async def api_mt(request: Request):
    """Batch en->zh translation for result-text fragments (cached server-side)."""
    if not mt_ip_allowed(client_ip(request)):
        return JSONResponse({"ok": False, "error": "请求太频繁，请稍后再试"}, status_code=429)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "bad request"}, status_code=400)
    items = [str(s).strip() for s in (body.get("items") or []) if isinstance(s, str)]
    out = {}
    missing = []
    for s in items[:MT_REQ_MAX]:
        if not _needs_tr(s):
            continue
        c = mt_cache_get(s)
        if c:
            out[s] = c
        elif s not in missing:
            missing.append(s)
    if missing:
        async def _one(s):
            async with MT_SEM:
                r = await translate_en2zh(s)
            return (s, r)
        rs = await asyncio.gather(*[_one(s) for s in missing], return_exceptions=True)
        for item in rs:
            if isinstance(item, tuple):
                s, r = item
                if r:
                    mt_cache_put(s, r)
                    out[s] = r
    return {"ok": True, "trans": out}


ALLOWED_IMG_HOSTS = ("wolframalpha.com",)


@app.get("/img")
async def img_proxy(u: str):
    try:
        purl = urlparse(u)
    except Exception:
        return Response(status_code=400)
    host = (purl.hostname or "").lower()
    if purl.scheme != "https" or not (host == "wolframalpha.com" or host.endswith(".wolframalpha.com")):
        return Response(status_code=403)
    hkey = hashlib.sha1(purl.geturl().encode()).hexdigest()
    ext = ".gif" if purl.path.lower().endswith(".gif") else (".png" if purl.path.lower().endswith(".png") else ".jpg")
    fpath = IMG_DIR / (hkey + ext)
    ctype = {".gif": "image/gif", ".png": "image/png", ".jpg": "image/jpeg"}[ext]
    if not fpath.exists():
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                r = await client.get(purl.geturl(), headers={"User-Agent": "Mozilla/5.0"})
                r.raise_for_status()
            data = r.content
            if len(data) > 8 * 1024 * 1024:
                return Response(status_code=502)
            fpath.write_bytes(data)
        except Exception:
            return Response(status_code=502)
    return FileResponse(fpath, media_type=ctype, headers={"Cache-Control": "public, max-age=1209600, immutable"})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
