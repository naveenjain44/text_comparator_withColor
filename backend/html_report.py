"""HTML report generator (self-contained, offline)."""
from __future__ import annotations

import html
import json
from datetime import datetime, timezone


STATUS_COLOR = {
    "match": ("#065f46", "#10b981", "#d1fae5"),
    "warning": ("#78350f", "#f59e0b", "#fef3c7"),
    "mismatch": ("#7f1d1d", "#ef4444", "#fee2e2"),
}


def _esc(s):
    return html.escape(str(s or ""))


def _badge(status: str) -> str:
    dark, mid, light = STATUS_COLOR.get(status, ("#1f2937", "#6b7280", "#e5e7eb"))
    return (
        f'<span style="display:inline-block;padding:2px 8px;font-size:11px;'
        f'font-family:ui-monospace,monospace;font-weight:700;text-transform:uppercase;'
        f'letter-spacing:.08em;border-radius:3px;color:{mid};background:{dark}20;'
        f'border:1px solid {mid}55;">{_esc(status)}</span>'
    )


def _row(label: str, mockup: str, output: str, status: str, extra: str = "") -> str:
    return f"""
    <div class="row">
      <div class="row-head">
        <div class="row-label">{_esc(label)}</div>
        <div>{_badge(status)}</div>
      </div>
      <div class="row-grid">
        <div class="cell">
          <div class="cell-label">Mockup (.docx)</div>
          <div class="cell-body">{_esc(mockup) or '<span class="dim">—</span>'}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Output (.eml/.msg)</div>
          <div class="cell-body">{_esc(output) or '<span class="dim">—</span>'}</div>
        </div>
      </div>
      {f'<div class="row-foot">{_esc(extra)}</div>' if extra else ''}
    </div>
    """


def _score_card(label: str, value: str, sub: str = "", color: str = "#fafafa") -> str:
    return f"""
    <div class="scard">
      <div class="scard-label">{_esc(label)}</div>
      <div class="scard-value" style="color:{color}">{value}</div>
      <div class="scard-sub">{_esc(sub)}</div>
    </div>
    """


def generate_html(report: dict, mockup_name: str, output_name: str) -> str:
    s = report.get("summary", {})
    sc = report.get("scores", {})
    ls = report.get("link_stats", {})
    ims = report.get("image_stats", {})
    when = datetime.now(timezone.utc).astimezone().strftime("%d %b %Y, %H:%M")

    body_rows = "".join(
        _row(f"Para {i+1}", r["mockup"], r["output"], r["status"],
             f"similarity: {r.get('similarity', 0):.2%}")
        for i, r in enumerate(report.get("body", []))
    ) or '<div class="empty">No body paragraphs found.</div>'

    link_rows = "".join(
        _row(f"Link {i+1}",
             f"{r['mockup_text']}\n{r['mockup_url']}",
             f"{r['output_text']}\n{r['output_url']}",
             r["status"],
             f"text_match: {r['text_match']} · url_match: {r['url_match']}")
        for i, r in enumerate(report.get("links", []))
    ) or '<div class="empty">No hyperlinks found.</div>'

    img_rows = "".join(
        _row(f"Image {i+1}",
             f"{r['mockup_filename']}\nalt: {r['mockup_alt'] or '—'}",
             f"{r['output_filename']}\nalt: {r['output_alt'] or '—'}",
             r["status"],
             f"alt_match: {r['alt_match']} · name_match: {r['name_match']}")
        for i, r in enumerate(report.get("images", []))
    ) or '<div class="empty">No images found.</div>'

    cta = report.get("cta", {})
    field_rows = (
        _row("Subject", report["subject"]["mockup"], report["subject"]["output"],
             report["subject"]["status"], f"similarity: {report['subject']['similarity']:.2%}")
        + _row("Greeting", report["greeting"]["mockup"], report["greeting"]["output"],
               report["greeting"]["status"])
        + _row("CTA",
               f"{cta.get('mockup_text','')}\n{cta.get('mockup_url','')}",
               f"{cta.get('output_text','')}\n{cta.get('output_url','')}",
               cta.get("status", "warning"),
               f"url_match: {cta.get('url_match', False)} · text_sim: {cta.get('text_similarity', 0):.2%}")
        + _row("Footer", report["footer"]["mockup"], report["footer"]["output"],
               report["footer"]["status"])
    )

    overall_color = {"match": "#10b981", "warning": "#f59e0b", "mismatch": "#ef4444"}.get(
        s.get("overall", ""), "#fafafa")

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>UAT Report — {_esc(mockup_name)} ↔ {_esc(output_name)}</title>
<style>
  html, body {{
    background:#0a0a0b; color:#fafafa; margin:0; padding:0;
    font-family: Inter, "IBM Plex Sans", system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing:antialiased;
  }}
  * {{ box-sizing:border-box; }}
  .container {{ max-width:1200px; margin:0 auto; padding:40px 32px; }}
  h1 {{ font-size:24px; font-weight:700; margin:0 0 8px; letter-spacing:-0.01em; }}
  h2 {{ font-size:16px; font-weight:600; margin:32px 0 12px; letter-spacing:-0.01em; }}
  .meta {{ color:#a1a1aa; font-size:12px; font-family:ui-monospace,monospace; }}
  .cards {{ display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; margin:24px 0; }}
  .scard {{ border:1px solid #27272a; background:#141416; border-radius:6px; padding:16px; }}
  .scard-label {{ font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#71717a; font-family:ui-monospace,monospace; }}
  .scard-value {{ font-size:28px; font-weight:700; margin:6px 0 2px; letter-spacing:-0.02em; }}
  .scard-sub {{ font-size:11px; color:#a1a1aa; font-family:ui-monospace,monospace; }}
  .row {{ border:1px solid #27272a; border-radius:6px; margin-bottom:8px; overflow:hidden; background:#141416; }}
  .row-head {{ display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-bottom:1px solid #27272a; background:#0f0f10; }}
  .row-label {{ font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:#a1a1aa; font-family:ui-monospace,monospace; }}
  .row-grid {{ display:grid; grid-template-columns:1fr 1fr; }}
  .cell {{ padding:12px 16px; border-right:1px solid #27272a; }}
  .cell:last-child {{ border-right:0; }}
  .cell-label {{ font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#71717a; margin-bottom:4px; font-family:ui-monospace,monospace; }}
  .cell-body {{ font-size:13px; color:#f4f4f5; white-space:pre-wrap; overflow-wrap:anywhere; }}
  .row-foot {{ padding:8px 16px; border-top:1px solid #27272a; background:#0a0a0b; font-size:11px; color:#71717a; font-family:ui-monospace,monospace; }}
  .empty {{ padding:24px; color:#71717a; font-size:13px; text-align:center; border:1px dashed #27272a; border-radius:6px; }}
  .dim {{ color:#52525b; font-style:italic; }}
  .footer {{ margin-top:40px; padding-top:16px; border-top:1px solid #27272a; color:#71717a; font-size:11px; font-family:ui-monospace,monospace; }}
</style>
</head>
<body>
  <div class="container">
    <h1>UAT Comparison Report</h1>
    <div class="meta">
      Mockup: <b>{_esc(mockup_name)}</b> &nbsp; Output: <b>{_esc(output_name)}</b><br/>
      Generated: {_esc(when)} · Mode: <b>{_esc(report.get('mode','smart').upper())}</b> · Glossary: <b>{'ON' if report.get('use_glossary') else 'OFF'}</b>
    </div>

    <div class="cards">
      {_score_card("Overall", f'{s.get("overall_score", 0):.2f}%', s.get("overall","").upper(), overall_color)}
      {_score_card("Subject", f'{sc.get("subject", 0):.1f}%', report["subject"]["status"].upper())}
      {_score_card("Body", f'{sc.get("body", 0):.1f}%', f'{len(report.get("body",[]))} segments')}
      {_score_card("URLs", f'{ls.get("matched",0)}/{ls.get("total",0)}', f'{sc.get("links",0):.1f}% match')}
      {_score_card("Images", f'{ims.get("matched",0)}/{ims.get("total",0)}', f'{sc.get("images",0):.1f}% match')}
    </div>

    <h2>Fields</h2>
    {field_rows}

    <h2>Body paragraphs</h2>
    {body_rows}

    <h2>Hyperlinks</h2>
    {link_rows}

    <h2>Images</h2>
    {img_rows}

    <div class="footer">
      UAT Text Comparator · offline localhost tool · Match {s.get('match',0)} · Warning {s.get('warning',0)} · Mismatch {s.get('mismatch',0)}
    </div>
  </div>
</body>
</html>
"""
