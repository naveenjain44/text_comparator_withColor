"""Iteration-6 tests: noise-filter additions, whitespace-tolerant date regex,
PDF subject extraction, partial-credit link scoring, empty-section exclusion
from the weighted overall score, and packaging/frontend static checks."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

AMEX = Path("/app/backend/samples/amex")
AMEX_PDF = AMEX / "Gmail - Fwd_ Your balance update.pdf"
AMEX_EML = AMEX / "Your balance update.eml"


@pytest.fixture(scope="session")
def client():
    return requests.Session()


# ---------- comparator._is_noise_line ----------

class TestNoiseFilterIteration6:
    @pytest.mark.parametrize("line", [
        "K C",
        "K  C",
        "https://mail.google.com/mail/u/0/?ik=abc123&view=pt&search=all&permmsgid=msg-f:12345 1/3",
    ])
    def test_new_noise_patterns(self, line):
        from comparator import _is_noise_line
        assert _is_noise_line(line) is True, line

    @pytest.mark.parametrize("line", [
        "Dear KIRTIMAAN CHHABRA,",
        "Your total balance is INR 12,500.00 as of 02-Jun-2026.",
        "View statement now",
        "Hi there",
    ])
    def test_real_content_not_filtered(self, line):
        from comparator import _is_noise_line
        assert _is_noise_line(line) is False, line


# ---------- apply_dynamic_normalization ----------

class TestDynamicDateNormalization:
    @pytest.mark.parametrize("raw", [
        "06- Jun-2026",
        "06 -Jun -2026",
        "02-Jun-2026",
        "06- Jun -2026",
    ])
    def test_whitespace_tolerant_date(self, raw):
        from comparator import apply_dynamic_normalization
        out = apply_dynamic_normalization(raw)
        assert "<DATE>" in out, (raw, out)


# ---------- compare_field empty flag ----------

class TestCompareFieldEmpty:
    def test_empty_both_sides(self):
        from comparator import compare_field
        r = compare_field("", "", [], "smart")
        assert r["empty"] is True, r
        assert r["status"] == "match"

    def test_non_empty_not_flagged(self):
        from comparator import compare_field
        r = compare_field("Hello", "Hello", [], "smart")
        assert r["empty"] is False, r
        assert r["similarity"] == 1.0

    def test_one_side_empty_not_flagged(self):
        from comparator import compare_field
        r = compare_field("Hello", "", [], "smart")
        assert r["empty"] is False, r


# ---------- empty section excluded from overall score ----------

class TestEmptySectionExclusion:
    def _build(self, footer_a, footer_b):
        from comparator import compare, ParsedEmail
        m = ParsedEmail(subject="Balance update", greeting="Dear A,",
                        body_paragraphs=["Line one here"], links=[], footer=footer_a)
        o = ParsedEmail(subject="Balance update", greeting="Dear A,",
                        body_paragraphs=["Line one here"], links=[], footer=footer_b)
        return compare(m, o, [], "smart")

    def test_empty_footer_flagged_and_excluded(self):
        rep_empty = self._build("", "")
        assert rep_empty["footer"]["empty"] is True, rep_empty["footer"]
        rep_pop = self._build("Unsubscribe | Privacy", "Unsubscribe | Privacy")
        assert rep_pop["footer"]["empty"] is False
        assert rep_pop["scores"]["footer"] == 100, rep_pop["scores"]
        # Empty footer (and empty cta) must be dropped from the weighted average.
        from comparator import WEIGHTS
        scores = rep_empty["scores"]
        present = ["subject", "body", "links", "images"]  # cta+footer empty→excluded
        w = {k: WEIGHTS[k] for k in present}
        expected = sum(scores[k] * w[k] for k in present) / sum(w.values())
        assert rep_empty["summary"]["overall_score"] == pytest.approx(expected, abs=0.05), (
            rep_empty["summary"], expected)

    def test_empty_links_and_images_should_not_penalise(self):
        """BUG(iteration_6): compare_links/compare_images use `max(len(a),len(b)) or 1`
        so an email with NO links/images gets total=1, pct=0 → the links (0.10) and
        images (0.10) weights still apply with score 0, dragging a perfect match
        down to 75/100."""
        rep = self._build("Unsubscribe | Privacy", "Unsubscribe | Privacy")
        assert rep["link_stats"]["total"] == 0, rep["link_stats"]
        assert rep["image_stats"]["total"] == 0, rep["image_stats"]
        assert rep["summary"]["overall_score"] == pytest.approx(100.0, abs=0.01), rep["scores"]

    def test_empty_section_does_not_mask_mismatch(self):
        """A mismatch elsewhere must lower overall score even with empty sections."""
        from comparator import compare, ParsedEmail
        m = ParsedEmail(subject="Balance update", greeting="Dear A,",
                        body_paragraphs=["Line one here"], links=[], footer="")
        o = ParsedEmail(subject="Totally different words",
                        greeting="Dear A,", body_paragraphs=["Completely other text"],
                        links=[], footer="")
        rep = compare(m, o, [], "smart")
        assert rep["summary"]["overall_score"] < 60, rep["summary"]


# ---------- AmEx PDF <-> EML via API ----------

@pytest.fixture(scope="class")
def amex_report(client):
    assert AMEX_PDF.exists() and AMEX_EML.exists()
    files = {
        "mockup": (AMEX_PDF.name, AMEX_PDF.read_bytes(), "application/pdf"),
        "output": (AMEX_EML.name, AMEX_EML.read_bytes(), "message/rfc822"),
    }
    r = client.post(f"{API}/compare", files=files,
                    data={"mode": "smart", "use_glossary": "true", "save_history": "false"},
                    timeout=180)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:600]}"
    return r.json()


class TestAmexIteration6:
    def test_pdf_subject_extracted(self, amex_report):
        assert amex_report["subject"]["mockup"] == "Your balance update", \
            amex_report["subject"]

    def test_subject_score(self, amex_report):
        assert amex_report["scores"]["subject"] >= 80, amex_report["scores"]

    def test_link_partial_credit(self, amex_report):
        stats = amex_report["link_stats"]
        assert stats["pct"] >= 0.40, stats
        assert amex_report["scores"]["links"] >= 40, amex_report["scores"]

    def test_overall_score_improved(self, amex_report):
        assert amex_report["summary"]["overall_score"] >= 50, amex_report["summary"]

    def test_body_first_row_greeting_match(self, amex_report):
        row = amex_report["body"][0]
        assert "Dear KIRTIMAAN CHHABRA" in row["mockup"], row["mockup"]
        assert "Dear KIRTIMAAN CHHABRA" in row["output"], row["output"]
        assert row["status"] == "match", row

    def test_no_avatar_initials_in_body(self, amex_report):
        stray = [r for r in amex_report["body"]
                 if (r.get("mockup") or "").strip() in ("K C", "K  C")]
        assert not stray, stray


# ---------- PDF parser subject ----------

class TestParsePdfSubject:
    def test_parse_pdf_subject_direct(self):
        from parsers import parse_pdf
        parsed = parse_pdf(AMEX_PDF.read_bytes())
        assert parsed.subject == "Your balance update", parsed.subject


# ---------- static checks ----------

class TestStaticIteration6:
    def test_spec_hiddenimports(self):
        src = Path("/app/uat_tool.spec").read_text()
        for token in ("lxml", "lxml.etree", "soupsieve", "html5lib", "sqlite3"):
            assert f'"{token}"' in src or f"'{token}'" in src, token

    def test_diffreport_dynamic_ext(self):
        src = Path("/app/frontend/src/components/DiffReport.jsx").read_text()
        assert "const mockupExt" in src
        assert "const outputExt" in src
        # every DiffRow must receive the ext props
        assert src.count("mockupExt={mockupExt}") == src.count("<DiffRow"), (
            src.count("mockupExt={mockupExt}"), src.count("<DiffRow"))

    def test_guide_mentions_formats_and_bundle(self):
        src = Path("/app/frontend/src/pages/Guide.jsx").read_text().lower()
        assert "10" in src
        assert "bundle" in src
        for ext in ("pptx", "xlsx", "csv", "pdf", "msg"):
            assert ext in src, ext
