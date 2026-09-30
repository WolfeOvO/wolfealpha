/* WolfeAlpha frontend */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var form = $("#search"), input = $("#q"), statusEl = $("#status"), resultEl = $("#result");

  var md = window.markdownit({ html: false, linkify: true });
  var linkOpen = md.renderer.rules.link_open || function (t, i, o, e, s) { return s.renderToken(t, i, o); };
  md.renderer.rules.link_open = function (t, i, o, e, s) {
    t[i].attrSet("target", "_blank");
    t[i].attrSet("rel", "noopener");
    return linkOpen(t, i, o, e, s);
  };

  /* common pod titles -> Chinese (display only) */
  var TITLES = {
    "input interpretation": "输入解析",
    "input": "输入",
    "result": "结果",
    "results": "结果",
    "plot": "图表",
    "root plot": "根分布图",
    "number line": "数轴",
    "sum of roots": "根之和",
    "product of roots": "根之积",
    "unit conversions": "单位换算",
    "number name": "数字读法",
    "decimal form": "小数形式",
    "exact result": "精确结果",
    "visual representation": "可视化",
    "real number line": "实数轴",
    "input information": "输入信息",
    "equation": "方程",
    "solution": "解",
    "solutions": "解",
    "value": "数值",
    "values": "数值",
    "current time": "当前时间",
    "population history": "人口历史"
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function imgSrc(u) { return "/img?u=" + encodeURIComponent(u); }
  function stripEsc(s) { return s.replace(/\\(.)/g, "$1"); }

  /* split a WA pipe line into cells ("\|" is the column separator) */
  function parseCells(line) {
    var parts = line.split(/\s*\\\|\s*/);
    while (parts.length && parts[parts.length - 1] === "") { parts.pop(); }
    while (parts.length && parts[0] === "") { parts.shift(); }
    return parts;
  }

  /* ---- render one pod ---- */
  function renderSection(title, bodyLines) {
    var blocks = [], buf = [], abuf = [], pbuf = [];

    function flushMd() {
      if (!buf.length) return;
      var t = buf.join("\n");
      buf = [];
      if (t.trim()) blocks.push("<div class='md'>" + md.render(t) + "</div>");
    }
    function flushAscii() {
      if (!abuf.length) return;
      blocks.push("<pre class='ascii'>" + esc(abuf.join("\n")) + "</pre>");
      abuf = [];
    }
    function flushPipes() {
      if (!pbuf.length) return;
      var lines = pbuf;
      pbuf = [];
      var rows = lines.map(parseCells);
      var counts = rows.map(function (r) { return r.length; });
      var minc = Math.min.apply(null, counts), maxc = Math.max.apply(null, counts);
      /* consistent multi-column block (>=3 cols, >=2 rows) -> real table */
      if (lines.length >= 2 && minc >= 3 && minc === maxc) {
        var t = ["<div class='tablewrap'><table class='watable'><tbody>"];
        rows.forEach(function (row, i) {
          var tag = i === 0 ? "th" : "td";
          t.push("<tr>" + row.map(function (c) { return "<" + tag + ">" + md.renderInline(c) + "</" + tag + ">"; }).join("") + "</tr>");
        });
        t.push("</tbody></table></div>");
        blocks.push(t.join(""));
        return;
      }
      lines.forEach(function (line) {
        /* "caption |" (trailing empty cell) -> plain line */
        var stripped = line.replace(/\s*\\\|\s*$/, "").trim();
        if (stripped && stripped !== line.trim() && stripped.indexOf("\\|") === -1) {
          blocks.push("<div class='md'><p>" + md.renderInline(stripEsc(stripped)) + "</p></div>");
          return;
        }
        var kv = line.match(/^(.*?)\s*\\?\|\s+(.+)$/);
        if (kv) {
          var k = stripEsc(kv[1]).trim();
          var v = kv[2];
          if (k) {
            blocks.push("<div class='kv'><span class='k'>" + esc(k) + "</span><span class='v'>" + md.renderInline(v) + "</span></div>");
          } else {
            blocks.push("<div class='kv cont'><span class='v'>" + md.renderInline(v) + "</span></div>");
          }
          return;
        }
        blocks.push("<div class='md'><p>" + md.renderInline(stripEsc(line.trim())) + "</p></div>");
      });
    }

    bodyLines.forEach(function (line) {
      var img = line.match(/^!\[(.*?)\]\((\S+?)\)\s*$/);
      if (img) {
        flushPipes(); flushAscii(); flushMd();
        blocks.push("<figure><img loading='lazy' src='" + imgSrc(img[2]) + "' alt='" + esc(img[1]) + "'></figure>");
        return;
      }
      /* WA "text fallback" diagram lines (e.g. manipulatives):
         only digits / operators / pipes -> monospace block */
      var probe = line.replace(/\\/g, "");
      if (/^[0-9+\-=\s|]+$/.test(probe) && probe.indexOf("|") >= 0) {
        flushPipes(); flushMd();
        abuf.push(stripEsc(line).replace(/\s+$/, ""));
        return;
      }
      if (line.indexOf("\\|") >= 0) {
        flushAscii(); flushMd();
        pbuf.push(line);
        return;
      }
      flushPipes(); flushAscii();
      buf.push(line);
    });
    flushPipes(); flushAscii(); flushMd();

    if (!blocks.length) return "";
    var dispTitle = title ? (TITLES[title.toLowerCase()] || title) : "";
    var h = dispTitle ? "<h3 class='pod-title'>" + esc(dispTitle) + "</h3>" : "";
    return "<section class='pod'>" + h + blocks.join("") + "</section>";
  }

  function renderResult(d) {
    var lines = d.raw.split("\n");
    var secs = [], cur = { title: null, lines: [] };
    lines.forEach(function (line) {
      var h = line.match(/^#\s+(.*)$/);
      if (h) { secs.push(cur); cur = { title: h[1].trim(), lines: [] }; }
      else { cur.lines.push(line); }
    });
    secs.push(cur);

    var html = "<div class='result-head'><span class='rq'>" + esc(d.query) + "</span>";
    if (d.url) {
      html += "<a class='wa-link' href='" + esc(d.url) + "' target='_blank' rel='noopener'>在 Wolfram|Alpha 打开 ↗</a>";
    }
    html += "</div>";
    if (d.translated_to) {
      html += "<div class='transnote'>已自动翻译为英文查询：<b>" + esc(d.translated_to) + "</b>（Wolfram 仅支持英文输入）</div>";
    }
    if (d.mt_failed) {
      html += "<div class='transnote warn'>⚠️ 机翻服务暂时不可用，本次已按原文提交。建议稍后重试，或直接用英文查询。</div>";
    }
    if (/^\s*No Results Found/i.test(d.raw)) {
      var msg = d.translated_to
        ? ("已由机器翻译为「" + esc(d.translated_to) + "」提交查询，但 Wolfram 没有找到对应结果——换个说法再试试。")
        : "Wolfram 没有找到对应结果。提示：Wolfram|Alpha 以英文查询为主，换个说法或改用英文再试试。";
      resultEl.innerHTML = html + "<section class='pod'><div class='md'><p>" + msg + "</p></div></section>";
      return;
    }
    secs.forEach(function (s) {
      if (s.title || s.lines.join("").trim()) { html += renderSection(s.title, s.lines); }
    });
    resultEl.innerHTML = html;
  }

  /* ---- recent queries ---- */
  function loadRecent() {
    try { return JSON.parse(localStorage.getItem("wa_recent") || "[]"); } catch (e) { return []; }
  }
  function saveRecent(q) {
    try {
      var a = loadRecent().filter(function (x) { return x !== q; });
      a.unshift(q);
      localStorage.setItem("wa_recent", JSON.stringify(a.slice(0, 8)));
    } catch (e) {}
  }
  function buildRecent() {
    var row = document.getElementById("recent-row"), box = document.getElementById("recent");
    if (!row || !box) return;
    var a = loadRecent();
    if (!a.length) { row.hidden = true; return; }
    row.hidden = false;
    box.innerHTML = a.map(function (q) {
      return "<button class='chip' data-q=\"" + esc(q) + "\">" + esc(q) + "</button>";
    }).join("");
  }

  function setLanding(on) { document.body.classList.toggle("landing", on); }

  /* ---- main flow ---- */
  function run(q) {
    q = (q || "").trim();
    if (!q) return;
    input.value = q;
    setLanding(false);
    window.scrollTo(0, 0);
    document.body.classList.add("busy");
    statusEl.hidden = false;
    statusEl.className = "status";
    statusEl.textContent = "正在计算…（中文会自动机翻为英文，复杂查询可能要几秒）";
    resultEl.innerHTML = "";
    document.title = q + " — WolfeAlpha";
    history.replaceState(null, "", "#q=" + encodeURIComponent(q));

    fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: q })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; });
      })
      .then(function (x) {
        var r = x.r, d = x.d;
        if (!r.ok || !d.ok) {
          statusEl.className = "status err";
          statusEl.textContent = d.error || ("请求失败（HTTP " + r.status + "）");
          return;
        }
        renderResult(d);
        statusEl.className = "status";
        if (d.cached) { statusEl.textContent = "⚡ 命中缓存"; }
        else { statusEl.textContent = "✓ 实时计算" + (d.ms ? " · " + d.ms + " ms" : ""); }
        if (d.translated_to) { statusEl.textContent += " · 已机翻"; }
        saveRecent(q);
      })
      .catch(function (e) {
        statusEl.className = "status err";
        statusEl.textContent = "网络错误：" + e;
      })
      .finally(function () { document.body.classList.remove("busy"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(input.value);
  });

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-q]") : null;
    if (t) {
      e.preventDefault();
      run(t.getAttribute("data-q"));
    }
  });

  var home = document.getElementById("homeLink");
  if (home) {
    home.addEventListener("click", function (e) {
      e.preventDefault();
      setLanding(true);
      resultEl.innerHTML = "";
      statusEl.hidden = true;
      statusEl.className = "status";
      input.value = "";
      document.title = "WolfeAlpha — 计算知识引擎";
      history.replaceState(null, "", "/");
      input.focus();
      buildRecent();
    });
  }

  buildRecent();
  var m = location.hash.match(/^#q=(.*)$/);
  if (m && m[1]) { run(decodeURIComponent(m[1])); }
  else { input.focus(); }

  window.addEventListener("hashchange", function () {
    var mm = location.hash.match(/^#q=(.*)$/);
    if (mm && mm[1]) { run(decodeURIComponent(mm[1])); }
  });

  window.__wa = { run: run };
})();
