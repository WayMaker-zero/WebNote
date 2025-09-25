// Minimal Markdown renderer (no external deps). Good-enough for MVP.
// Supports: headings, bold, italic, inline code, fenced code blocks (with line numbers),
// links, lists, horizontal rules, tables, paragraphs.

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCodeBlock(code, lang = '') {
  const escaped = escapeHtml(code.replace(/\n+$/,'') );
  const lines = code.replace(/\n+$/,'').split('\n');
  const count = Math.max(1, lines.length);
  let nums = '';
  for (let i = 1; i <= count; i++) nums += i + "\n";
  const cls = lang ? ` class="lang-${lang}"` : '';
  return `<div class="codeblock"><div class="code-nums">${nums}</div><pre><code${cls}>${escaped}</code></pre></div>`;
}

function renderInline(text) {
  // inline code
  text = text.replace(/`([^`]+)`/g, (m, c) => `<code>${escapeHtml(c)}</code>`);
  // bold **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *text*
  text = text.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
  // links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return text;
}

function renderBlock(text) {
  const lines = text.split(/\r?\n/);
  let out = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      out.push('<ul>');
      for (const item of listBuffer) out.push(`<li>${renderInline(item)}</li>`);
      out.push('</ul>');
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushList();
      out.push('');
      continue;
    }

    // fenced code block
    if (/^```/.test(line)) {
      flushList();
      const lang = line.replace(/^```\s*/, '').trim();
      let codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(renderCodeBlock(codeLines.join('\n'), lang));
      continue;
    }

    // horizontal rule: --- or *** or ___ (3+)
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushList();
      out.push('<hr />');
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2].trim())}</h${level}>`);
      continue;
    }

    // table (GitHub-flavored): header | header\n --- | :---: | ---:\n rows...
    if (isTableHeader(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushList();
      const headerCells = splitTableRow(line);
      const align = parseAlignments(lines[i + 1]);
      i += 2; // skip header and divider
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      i--; // compensate loop increment
      out.push(renderTable(headerCells, align, bodyRows));
      continue;
    }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      listBuffer.push(li[1]);
      continue;
    }

    flushList();
    out.push(`<p>${renderInline(line)}</p>`);
  }
  flushList();

  return out.join('\n');
}

export function renderMarkdown(src) {
  if (!src) return '';
  return renderBlock(src);
}

// --- table helpers ---
function isTableHeader(line) {
  return isTableRow(line);
}
function isTableRow(line) {
  return /\|/.test(line);
}
function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\||\|$/g, '');
  return trimmed.split('|').map(c => c.trim());
}
function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(c => /^:?-{3,}:?$/.test(c));
}
function parseAlignments(line) {
  const cells = splitTableRow(line);
  return cells.map(c => {
    const left = c.trim().startsWith(':');
    const right = c.trim().endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return 'left';
  });
}
function renderTable(headers, align, rows) {
  const th = headers.map((h, i) => `<th style="text-align:${align[i] || 'left'}">${renderInline(h)}</th>`).join('');
  const body = rows.map(r => {
    const tds = r.map((c, i) => `<td style="text-align:${align[i] || 'left'}">${renderInline(c)}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table class="md-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}
