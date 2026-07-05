import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "./Icon";

import { STLModel } from "../types";
import { api, authFetch } from "../services/api";
import { useVisualViewport } from "../hooks/useVisualViewport";
import "./styles/manual.css";

type ManualMode = "view" | "edit";

interface ManualModalProps {
  model: STLModel | null;
  onClose: () => void;
  initialMode?: ManualMode;
  onSave: (id: string, file: File) => Promise<unknown>;
}

const ManualModal: React.FC<ManualModalProps> = ({
  model,
  onClose,
  initialMode = "view",
  onSave,
}) => {
  const visualViewport = useVisualViewport();
  const [mode, setMode] = useState<ManualMode>(initialMode);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!model) return;
    setMode(initialMode);
    setError("");
    setContent("");
    setDraft("");

    if (!model.manual) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    authFetch(api.getManualUrl(model))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load manual");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setDraft(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load manual");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [model?.id]);

  useEffect(() => {
    if (!model) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model, onClose]);

  if (!model) return null;

  const viewportHeight =
    visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0);

  const handleSave = async () => {
    if (!model || saving) return;
    setSaving(true);
    setError("");
    try {
      const filename = model.manual || "manual.md";
      const file = new File([draft], filename, { type: "text/markdown" });
      await onSave(model.id, file);
      setContent(draft);
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!model.manual) {
      onClose();
      return;
    }
    setDraft(content);
    setMode("view");
  };

  return (
    <div
      className="fixed left-0 top-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4"
      style={{
        width: "100%",
        height: viewportHeight,
        transform: `translate(${visualViewport.offsetLeft}px, ${visualViewport.offsetTop}px)`,
      }}
      onClick={mode === "edit" ? undefined : onClose}
    >
      <div
        className="bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl flex flex-col w-full max-w-3xl"
        style={{ maxHeight: Math.max(240, viewportHeight - 32) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-3 p-5 border-b border-outline-variant sticky top-0 bg-surface-container-high rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="text-headline-sm font-headline-sm text-on-surface truncate">{model.displayName}</h3>
            {mode === "view" ? (
              <button
                onClick={() => setMode("edit")}
                className="text-on-surface-variant hover:text-on-surface shrink-0 p-1.5 rounded-full hover:bg-surface-container-highest transition-colors"
                aria-label="Edit manual"
                title="Edit manual"
              >
                <Icon name="edit" className="text-lg" />
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-label-md font-label-md bg-primary-container text-on-primary-container disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Icon name="save" className="text-base" />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 text-label-md font-label-md border border-outline-variant hover:bg-surface-container-highest disabled:opacity-50 text-on-surface rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface shrink-0"
            aria-label="Close manual"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1 min-h-0 flex flex-col">
          {loading && <p className="text-body-sm text-on-surface-variant italic">Loading manual...</p>}
          {!loading && error && <p className="text-body-sm text-error mb-3">{error}</p>}
          {!loading && mode === "view" && !error && (
            <article className="manual-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
          {!loading && mode === "edit" && (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your manual in Markdown..."
              className="flex-1 min-h-[240px] w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface font-mono text-sm resize-none outline-none focus:border-primary overflow-y-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualModal;
