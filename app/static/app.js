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
    /* 通用 */
    "input interpretation": "输入解析",
    "input": "输入",
    "input information": "输入信息",
    "result": "结果",
    "results": "结果",
    "value": "数值",
    "values": "数值",
    "solution": "解",
    "solutions": "解",
    "exact result": "精确结果",
    "exact forms": "精确形式",
    "decimal form": "小数形式",
    "decimal approximation": "小数近似",
    "expanded form": "展开形式",
    "expanded forms": "展开形式",
    "alternative representations": "其他表示形式",
    "number name": "数字读法",
    "scientific notation": "科学计数法",
    "binary form": "二进制形式",
    "hexadecimal form": "十六进制形式",
    "number bases": "进制表示",
    "continued fraction": "连分数",
    "visual representation": "可视化",
    "basic information": "基本信息",
    "additional information": "补充信息",
    "related queries": "相关查询",
    "examples": "示例",
    "comparison": "对比",
    "comparisons": "对比",
    "sources": "数据来源",
    "source": "来源",
    "website": "网站",
    /* 数学 */
    "plot": "图表",
    "plots": "图表",
    "graph": "图形",
    "graphs": "图形",
    "equation": "方程",
    "equations": "方程",
    "inequalities": "不等式",
    "derivative": "导数",
    "derivatives": "导数",
    "integral": "积分",
    "integrals": "积分",
    "definite integral": "定积分",
    "indefinite integral": "不定积分",
    "limit": "极限",
    "limit at infinity": "无穷远处极限",
    "series expansion": "级数展开",
    "partial fraction decomposition": "部分分式分解",
    "roots": "根",
    "root plot": "根分布图",
    "zeros": "零点",
    "sum of roots": "根之和",
    "product of roots": "根之积",
    "discriminant": "判别式",
    "vertex": "顶点",
    "focus": "焦点",
    "eccentricity": "离心率",
    "axis of symmetry": "对称轴",
    "domain": "定义域",
    "range": "值域",
    "parity": "奇偶性",
    "periodicity": "周期性",
    "global minimum": "全局最小值",
    "global maximum": "全局最大值",
    "local minima": "局部极小值",
    "local maxima": "局部极大值",
    "inflection points": "拐点",
    "stationary points": "驻点",
    "turning points": "极值点",
    "asymptotes": "渐近线",
    "number line": "数轴",
    "real number line": "实数轴",
    "number line diagram": "数轴图",
    "factorizations": "因式分解",
    "prime factorization": "质因数分解",
    "factor": "因子",
    "divisors": "约数",
    "divisor sum": "约数和",
    "prime numbers": "质数",
    "number properties": "数论性质",
    "matrix": "矩阵",
    "matrix inverse": "逆矩阵",
    "determinant": "行列式",
    "eigenvalues": "特征值",
    "vector": "向量",
    "vector plot": "向量图",
    "dot product": "点积",
    "cross product": "叉积",
    /* 单位与物理 */
    "unit conversions": "单位换算",
    "unit conversion": "单位换算",
    "conversions": "换算",
    "physical quantity": "物理量",
    "dimension": "量纲",
    "definition": "定义",
    "formula": "公式",
    "physical constants": "物理常数",
    "corresponding quantities": "对应的量",
    "comparisons as mass": "质量对比",
    "comparisons as length": "长度对比",
    "comparisons as time": "时长对比",
    "comparisons as energy": "能量对比",
    "interpretation": "解释",
    /* 化学 */
    "chemical names and formulas": "化学名称与分子式",
    "chemical formula": "化学式",
    "chemical names": "化学名称",
    "molar mass": "摩尔质量",
    "molecular mass": "分子质量",
    "density": "密度",
    "melting point": "熔点",
    "boiling point": "沸点",
    "phase": "相态",
    "phase at STP": "标准状态相态",
    "atomic number": "原子序数",
    "atomic mass": "原子质量",
    "element": "元素",
    "symbol": "符号",
    "symbols": "符号",
    "other names": "其他名称",
    "alternate names": "别名",
    "periodic table location": "周期表位置",
    "physical properties": "物理性质",
    "chemical properties": "化学性质",
    "structure": "结构",
    "3D structure": "三维结构",
    "structure diagram": "结构示意图",
    "oxidation states": "氧化态",
    "solubility": "溶解度",
    /* 时间与天气 */
    "current time": "当前时间",
    "current date": "当前日期",
    "current local time": "当地时间",
    "time zone": "时区",
    "sunrise": "日出",
    "sunset": "日落",
    "day length": "白天时长",
    "moon phase": "月相",
    "current weather": "当前天气",
    "weather forecast": "天气预报",
    "current temperature": "当前温度",
    /* 地理与人口 */
    "population history": "人口历史",
    "recent population history": "近期人口变化",
    "long-term population history": "长期人口变化",
    "demographics": "人口统计",
    "age distribution": "年龄分布",
    "largest cities": "主要城市",
    "country rank": "国家排名",
    "world rank": "世界排名",
    "location": "位置",
    "map": "地图",
    "coordinates": "坐标",
    "area": "面积",
    "elevation": "海拔",
    "distance": "距离",
    "travel time": "行程时间",
    "flight time": "飞行时间",
    "driving distance": "驾车距离",
    "flag": "旗帜",
    "capital": "首都",
    "border countries": "邻国",
    "neighboring countries": "邻国",
    /* 金融 */
    "currency conversion": "汇率换算",
    "currency conversions": "汇率换算",
    "current exchange rate": "当前汇率",
    "exchange rate history": "汇率历史",
    "average exchange rate": "平均汇率",
    /* 健康 */
    "body mass index": "身体质量指数",
    "comparison to USA population": "与美国人口对比",
    "basal metabolic rate": "基础代谢率",
    "calories": "卡路里",
    "nutritional information": "营养信息",
    "serving size": "每份含量",
    /* 统计 */
    "basic statistics": "基本统计",
    "mean": "平均值",
    "median": "中位数",
    "mode": "众数",
    "standard deviation": "标准差",
    "variance": "方差",
    "sum": "总和",
    "total": "总计",
    "sample size": "样本量",
    "correlation": "相关性",
    /* 百科 */
    "wikipedia summary": "维基百科摘要",
    "wikipedia page": "维基百科页面",
    "notable facts": "相关事实",
    "timeline": "时间线",
    "birth date": "出生日期",
    "birthplace": "出生地",
    "age": "年龄",
    "height": "身高",
    "weight": "体重"
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
      function consistent(rows) {
        var counts = rows.map(function (r) { return r.length; });
        var minc = Math.min.apply(null, counts), maxc = Math.max.apply(null, counts);
        return lines.length >= 2 && minc >= 3 && minc === maxc;
      }
      /* try trimmed cells first, then an alternative parse that keeps a
         leading empty cell (WA emits " \| col \| col" header rows whose
         blank first cell represents the label column) */
      var rows = lines.map(parseCells);
      if (!consistent(rows)) {
        var alt = lines.map(function (l) {
          var parts = l.split(/\s*\\\|\s*/);
          while (parts.length && parts[parts.length - 1].trim() === "") { parts.pop(); }
          return parts.map(function (s) { return s.trim(); });
        });
        if (consistent(alt)) { rows = alt; }
      }
      /* consistent multi-column block (>=3 cols, >=2 rows) -> real table */
      if (consistent(rows)) {
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
