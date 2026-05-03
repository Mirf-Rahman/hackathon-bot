/**
 * Convert a tiny subset of Markdown into HTML suitable for a print-friendly
 * "save as PDF" dialog. Only handles the constructs that
 * `generatePerformanceReport` actually emits:
 *   - `# heading` / `## heading`
 *   - `**bold**`
 *   - `- list item`
 *   - blank-line paragraph breaks
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inPara: string[] = [];

  const flushPara = () => {
    if (inPara.length) {
      out.push(`<p>${inline(inPara.join(" "))}</p>`);
      inPara = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      closeList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushPara();
      closeList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara();
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    inPara.push(line);
  }
  flushPara();
  closeList();
  return out.join("\n");
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 48px 56px;
    line-height: 1.55;
  }
  .meta {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 32px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 12px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .brand {
    font-weight: 700;
    color: #2563eb;
  }
  h1 { font-size: 26px; margin: 8px 0 18px; color: #0f172a; }
  h2 { font-size: 16px; margin: 24px 0 10px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  p { margin: 8px 0 12px; font-size: 14px; }
  ul { margin: 4px 0 16px; padding-left: 20px; }
  li { font-size: 13px; margin-bottom: 4px; }
  strong { color: #0f172a; }
  .label-pill {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 16px;
  }
  .label-pill.outstanding { background: #ddd6fe; color: #5b21b6; }
  .label-pill.strong      { background: #bbf7d0; color: #14532d; }
  .label-pill.stable      { background: #dbeafe; color: #1e3a8a; }
  .label-pill.at_risk     { background: #fed7aa; color: #9a3412; }
  .label-pill.critical    { background: #fecaca; color: #7f1d1d; }
  @page { margin: 16mm; }
  @media print {
    body { padding: 0; }
  }
`;

export type PrintReportInput = {
  markdown: string;
  label: string;
  score: number;
  userId: string;
  displayName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  organizationId: string;
};

/**
 * Open the report in a new browser window styled for printing, then trigger
 * the print dialog so the user can pick "Save as PDF". Falls back to a same-
 * tab navigation if popups are blocked.
 */
export function openReportPrintWindow(input: PrintReportInput): void {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Performance Review · ${escapeHtml(input.displayName)} · ${escapeHtml(input.period)}</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <div class="meta">
      <span><span class="brand">PeerTemp</span> · accountability report</span>
      <span>Generated ${new Date().toLocaleString()}</span>
    </div>
    <div class="label-pill ${escapeHtml(input.label)}">${escapeHtml(
      input.label.replace(/_/g, " ").toUpperCase(),
    )} · Score ${(input.score * 100).toFixed(0)} / 100</div>
    ${markdownToHtml(input.markdown)}
    <div class="meta" style="margin-top: 40px; border-top: 1px solid #e2e8f0; border-bottom: none; padding-top: 12px;">
      <span>User: <strong>${escapeHtml(input.displayName)}</strong> (${escapeHtml(input.userId)})</span>
      <span>Org: ${escapeHtml(input.organizationId)}</span>
    </div>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 350);
      });
    </script>
  </body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) {
    // Popup blocked → use a data URL in the same tab
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.location.href = url;
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Render the same markdown for in-page preview (without opening a window). */
export function reportToPreviewHtml(markdown: string): string {
  return markdownToHtml(markdown);
}
