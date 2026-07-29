"""Backend API tests for UAT Text Comparator (iteration 2 - scoring, history, PRD)."""
import io
import os
import zipfile
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

SAMPLES = Path("/app/backend/samples")
DOCX = SAMPLES / "tos_update.docx"
EML = SAMPLES / "tos_update.eml"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    return s


def _files():
    return {
        "mockup": ("tos_update.docx", DOCX.read_bytes(),
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "output": ("tos_update.eml", EML.read_bytes(), "message/rfc822"),
    }


def _compare(client, mode="smart", use_glossary="true", save_history="true"):
    return client.post(f"{API}/compare", files=_files(),
                       data={"mode": mode, "use_glossary": use_glossary, "save_history": save_history},
                       timeout=120)


# ---------- health ----------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "ok"
        assert d["offline"] is True


# ---------- compare / scoring / strikethrough ----------
class TestCompare:
    def test_samples_exist(self):
        assert DOCX.exists() and EML.exists()

    def test_compare_smart_shape(self, client, tracked_ids):
        r = _compare(client)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        for k in ("scores", "summary", "link_stats", "image_stats", "mode", "use_glossary", "history_id"):
            assert k in d, f"missing key {k}"
        for k in ("subject", "greeting", "body", "cta", "links", "images", "footer"):
            assert k in d["scores"], f"missing score {k}"
            assert isinstance(d["scores"][k], (int, float))
        assert 0 <= d["summary"]["overall_score"] <= 100
        for stats in (d["link_stats"], d["image_stats"]):
            assert {"matched", "total", "pct"} <= set(stats.keys())
        assert d["mode"] == "smart"
        assert d["use_glossary"] is True
        tracked_ids.append(d["history_id"])

    def test_strikethrough_excluded_smart(self, client, tracked_ids):
        r = _compare(client, mode="smart")
        assert r.status_code == 200
        d = r.json()
        tracked_ids.append(d["history_id"])
        assert d["scores"]["body"] == 100, f"body score {d['scores']['body']} - strikethrough not excluded"
        assert d["summary"]["overall_score"] >= 88, d["summary"]["overall_score"]
        blob = str(d.get("body"))
        assert "OLD LEGAL DRAFT TEXT" not in blob, "strikethrough text leaked into body diff"

    def test_strikethrough_excluded_strict(self, client, tracked_ids):
        r = _compare(client, mode="strict")
        assert r.status_code == 200
        d = r.json()
        tracked_ids.append(d["history_id"])
        assert d["mode"] == "strict"
        assert d["scores"]["body"] == 100, f"strict body score {d['scores']['body']}"

    def test_link_and_image_stats(self, client, tracked_ids):
        r = _compare(client)
        d = r.json()
        tracked_ids.append(d["history_id"])
        assert d["link_stats"]["total"] >= 1
        assert d["image_stats"]["total"] >= 1

    def test_compare_bad_mockup_returns_400(self, client):
        r = client.post(f"{API}/compare", files={
            "mockup": ("bad.docx", b"not-a-docx", "application/octet-stream"),
            "output": ("tos_update.eml", EML.read_bytes(), "message/rfc822"),
        }, data={"mode": "smart"}, timeout=60)
        assert r.status_code == 400, r.status_code


# ---------- history ----------
class TestHistory:
    def test_history_list_contains_run(self, client, tracked_ids):
        r = _compare(client)
        assert r.status_code == 200
        hid = r.json()["history_id"]
        tracked_ids.append(hid)

        lr = client.get(f"{API}/history", timeout=30)
        assert lr.status_code == 200
        items = lr.json()["items"]
        assert isinstance(items, list) and len(items) > 0
        ids = [i["id"] for i in items]
        assert hid in ids
        item = next(i for i in items if i["id"] == hid)
        assert item["mockup_name"] == "tos_update.docx"
        assert item["output_name"] == "tos_update.eml"
        assert "overall_score" in item and "created_at" in item
        assert "_id" not in item

    def test_history_get_pdf_html_and_delete(self, client):
        hid = _compare(client).json()["history_id"]

        g = client.get(f"{API}/history/{hid}", timeout=30)
        assert g.status_code == 200
        assert g.json()["report"]["scores"]["body"] == 100

        p = client.get(f"{API}/history/{hid}/pdf", timeout=60)
        assert p.status_code == 200
        assert p.headers["content-type"].startswith("application/pdf")
        assert p.content[:4] == b"%PDF"

        h = client.get(f"{API}/history/{hid}/html", timeout=60)
        assert h.status_code == 200
        assert h.text.strip().lower().startswith("<!doctype html")

        d = client.delete(f"{API}/history/{hid}", timeout=30)
        assert d.status_code in (200, 204)
        assert client.get(f"{API}/history/{hid}", timeout=30).status_code == 404

    def test_history_404_unknown(self, client):
        assert client.get(f"{API}/history/does-not-exist", timeout=30).status_code == 404
        assert client.get(f"{API}/history/does-not-exist/pdf", timeout=30).status_code == 404


# ---------- PRD doc ----------
class TestPrd:
    def test_prd_docx(self, client):
        r = client.get(f"{API}/docs/prd", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"] == \
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(r.content) > 20 * 1024, f"size {len(r.content)}"
        assert r.content[:2] == b"PK"


# ---------- exports ----------
class TestExports:
    def test_export_html_and_pdf(self, client, tracked_ids):
        rep = _compare(client).json()
        tracked_ids.append(rep["history_id"])
        payload = {"report": rep, "mockup_filename": "tos_update.docx", "output_filename": "tos_update.eml"}

        h = client.post(f"{API}/export/html", json=payload, timeout=60)
        assert h.status_code == 200
        assert h.text.strip().lower().startswith("<!doctype html")
        assert "tos_update.docx" in h.text

        p = client.post(f"{API}/export/pdf", json=payload, timeout=60)
        assert p.status_code == 200
        assert p.content[:4] == b"%PDF"

    def test_export_html_missing_report(self, client):
        assert client.post(f"{API}/export/html", json={}, timeout=30).status_code == 400


# ---------- batch ----------
class TestBatch:
    def test_batch_zip(self, client):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            for stem in ("camp1", "camp2"):
                z.writestr(f"{stem}.docx", DOCX.read_bytes())
                z.writestr(f"{stem}.eml", EML.read_bytes())
        buf.seek(0)
        r = client.post(f"{API}/batch",
                        files={"files": ("TEST_batch.zip", buf.getvalue(), "application/zip")},
                        data={"mode": "smart", "use_glossary": "true"}, timeout=180)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert len(d["reports"]) == 2
        for rep in d["reports"]:
            assert "error" not in rep, rep.get("error")
            assert rep["scores"]["body"] == 100
            assert rep["summary"]["overall_score"] >= 88
        assert len(d["csv_rows"]) == 2
        for row in d["csv_rows"]:
            for col in ("overall_score", "subject_pct", "body_pct", "images_pct"):
                assert col in row
        assert d["unmatched"]["mockups_without_output"] == []


# ---------- iteration 3: paragraph blocks, placement, word diff, image rendered ----------
DOCX_V2 = SAMPLES / "tos_v2.docx"
EML_V2 = SAMPLES / "tos_v2.eml"

SWAP_A = "Thank you for using Google services!"
SWAP_B = "We make it clearer how various sections in our terms relate to each other."


def _files_v2():
    return {
        "mockup": ("tos_v2.docx", DOCX_V2.read_bytes(),
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "output": ("tos_v2.eml", EML_V2.read_bytes(), "message/rfc822"),
    }


@pytest.fixture(scope="class")
def report_v2(client, tracked_ids):
    r = client.post(f"{API}/compare", files=_files_v2(),
                    data={"mode": "smart", "use_glossary": "true", "save_history": "true"},
                    timeout=120)
    assert r.status_code == 200, r.text[:500]
    d = r.json()
    tracked_ids.append(d.get("history_id"))
    return d


class TestV2Paragraphs:
    def test_samples_v2_exist(self):
        assert DOCX_V2.exists() and EML_V2.exists()

    def test_body_row_count_is_ten(self, report_v2):
        # iteration_5: greeting is now prepended as body para 1 → 9 + 1 = 10 rows
        rows = report_v2["body"]
        assert len(rows) == 10, f"expected 10 body rows, got {len(rows)}"

    def test_row_fields_present(self, report_v2):
        for i, r in enumerate(report_v2["body"]):
            for k in ("mockup_index", "output_index", "placement", "text_match",
                      "mockup_words", "output_words"):
                assert k in r, f"row {i} missing {k}"
            assert isinstance(r["mockup_words"], list)
            assert isinstance(r["output_words"], list)
            assert r["placement"] in ("correct", "incorrect", "missing")

    def test_placement_swap_detected(self, report_v2):
        rows = report_v2["body"]
        incorrect = [r for r in rows if r["placement"] == "incorrect"]
        assert len(incorrect) == 2, [r["mockup"][:40] for r in incorrect]
        texts = {r["mockup"].strip() for r in incorrect}
        assert texts == {SWAP_A, SWAP_B}, texts
        for r in incorrect:
            assert r["status"] == "warning", r["status"]
            assert r["text_match"] is True
            assert r["similarity"] >= 0.98, r["similarity"]
            assert r["mockup_index"] != r["output_index"]
        # iteration_5: greeting row added → 8 correct-placement rows
        assert len([r for r in rows if r["placement"] == "correct"]) == 8

    def test_strikethrough_excluded_v2(self, report_v2):
        row = report_v2["body"][1]
        assert row["similarity"] >= 0.98, row["similarity"]
        assert row["status"] == "match", row["status"]
        words = " ".join(w["text"] for w in row["mockup_words"])
        assert "DRAFT" not in words.upper(), words[:200]

    def test_image_rendered_flag(self, report_v2):
        imgs = report_v2["images"]
        assert imgs, "no image rows"
        rendered = [i for i in imgs if i.get("rendered")]
        assert rendered, imgs
        assert any(i.get("rendered_label") == "Google Logo" for i in rendered), \
            [i.get("rendered_label") for i in imgs]
        for i in imgs:
            assert "rendered" in i and "rendered_label" in i

    def test_report_shape_v2(self, report_v2):
        d = report_v2
        for k in ("scores", "summary", "link_stats", "image_stats", "mode", "use_glossary", "history_id"):
            assert k in d
        for k in ("subject", "greeting", "body", "cta", "links", "images", "footer"):
            assert k in d["scores"]
        assert 0 <= d["summary"]["overall_score"] <= 100


class TestUnitLevel:
    """Direct comparator unit checks (word diff + unrendered image)."""

    def test_word_level_diff(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from comparator import compare_paragraphs
        rows, _ = compare_paragraphs(["Terms of Service"], ["Terms of Use"], [], "smart")
        mw = rows[0]["mockup_words"]
        ow = rows[0]["output_words"]
        assert {"text": "Service", "status": "del"} in mw, mw
        assert {"text": "Use", "status": "add"} in ow, ow
        assert {"text": "Terms", "status": "match"} in mw

    def test_image_not_rendered(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from comparator import compare_images, ImageItem
        rows, _ = compare_images([ImageItem(filename="hero.png", alt="Hero Banner")], [], [], "smart")
        assert rows[0]["rendered"] is False
        assert rows[0]["rendered_label"] == "no rendered image"


@pytest.fixture(scope="session")
def tracked_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(tracked_ids):
    yield
    s = requests.Session()
    for hid in set(tracked_ids):
        try:
            s.delete(f"{API}/history/{hid}", timeout=15)
        except Exception:
            pass
