import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Save, Trash2, Loader2 } from "lucide-react";
import { getGlossary, saveGlossary, friendlyError } from "@/lib/api";

export default function GlossaryPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getGlossary();
        setRules(r);
      } catch (e) {
        toast.error(friendlyError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (i, field, val) => {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  };

  const add = () => setRules((prev) => [...prev, { original: "", variation: "" }]);

  const remove = (i) => setRules((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = rules.filter((r) => r.original.trim() && r.variation.trim());
      const saved = await saveGlossary(cleaned);
      setRules(saved);
      toast.success(`Saved ${saved.length} rule${saved.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0A0A0B]/95 backdrop-blur">
        <div className="px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Glossary / Case Rules</h1>
            <p className="text-xs text-zinc-500 font-mono">
              Treat variations as equivalent during comparison
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={add}
              variant="outline"
              data-testid="add-rule-btn"
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Add rule
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              data-testid="save-glossary-btn"
              className="bg-white text-black hover:bg-zinc-200"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6" data-testid="glossary-page">
        {loading ? (
          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-md bg-[#141416] overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-3 border-b border-zinc-800 bg-zinc-950 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <div className="col-span-5">Canonical (original)</div>
              <div className="col-span-5">Variation (allowed)</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {rules.length === 0 && (
              <div className="px-4 py-8 text-sm text-zinc-500 text-center">
                No rules. Click <span className="text-white">Add rule</span> to create one.
              </div>
            )}
            {rules.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-zinc-900 last:border-b-0 items-center"
                data-testid={`rule-row-${i}`}
              >
                <Input
                  className="col-span-5 bg-zinc-950 border-zinc-800"
                  placeholder="e.g. Hi"
                  value={r.original}
                  onChange={(e) => update(i, "original", e.target.value)}
                  data-testid={`rule-original-${i}`}
                />
                <Input
                  className="col-span-5 bg-zinc-950 border-zinc-800"
                  placeholder="e.g. Hey"
                  value={r.variation}
                  onChange={(e) => update(i, "variation", e.target.value)}
                  data-testid={`rule-variation-${i}`}
                />
                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={() => remove(i)}
                    data-testid={`rule-remove-${i}`}
                    className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-zinc-500 font-mono">
          <span className="text-zinc-400">Example:</span> "Hi" ↔ "Hey" — during comparison, "Hey team"
          in the output will be considered equivalent to "Hi team" in the mockup.
        </div>
      </div>
    </div>
  );
}
