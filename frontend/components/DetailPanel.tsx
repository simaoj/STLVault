import React, { useState, useCallback, useRef } from "react";
import { STLModel } from "../types";
import Viewer3D from "./Viewer3D";
import Icon from "./Icon";

import { generateThumbnail } from "../services/thumbnailGenerator";
import { api } from "../services/api";

interface DetailPanelProps {
  model: STLModel | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<STLModel>) => void;
  onDelete: (id: string) => void;
  onOpenManual: (model: STLModel) => void;
  onEditManual: (model: STLModel) => void;
  onUploadManual: (id: string, file: File) => unknown | Promise<unknown>;
  onDeleteManual: (id: string) => void | Promise<void>;
}

const primaryBtn =
  "bg-primary-container text-on-primary-container rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const outlinedBtn =
  "border border-outline-variant text-on-surface hover:bg-surface-container-highest rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const DetailPanel: React.FC<DetailPanelProps> = ({
  model,
  onClose,
  onUpdate,
  onDelete,
  onOpenManual,
  onEditManual,
  onUploadManual,
  onDeleteManual,
}) => {
  const [isReplacing, setIsReplacing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [tempThumb, setTempThumb] = useState("");
  const [errorState, setErrorState] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (model) {
      setEditName(model.name);
      setEditDesc(model.description || "");
      setEditTags(model.tags.join(", "));
      setIsEditing(false);
      setIsReplacing(false);
      setTempThumb("");
      setErrorState({ show: false, message: "" });
    }
  }, [model]);

  const handleModelLoaded = useCallback(
    (dimensions: { x: number; y: number; z: number }) => {
      if (model && !model.dimensions) {
        onUpdate(model.id, { dimensions });
      }
    },
    [model, onUpdate],
  );

  if (!model) return null;

  const getExtension = (filename: string) => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;

    const currentExt = getExtension(model.name);
    const newExt = getExtension(file.name);

    if (currentExt && newExt && currentExt !== newExt) {
      setErrorState({
        show: true,
        message: `You cannot replace a .${currentExt} file with a .${newExt} file.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsReplacing(true);
    try {
      let thumb: string | undefined;
      try {
        thumb = await generateThumbnail(file);
      } catch (err) {
        console.warn("Thumbnail failed", err);
      }

      const updated = await api.replaceModelFile(model.id, file, thumb);
      onUpdate(model.id, {
        url: updated.url,
        size: updated.size,
        thumbnail: updated.thumbnail,
      });
    } catch (e) {
      console.error("Failed to replace", e);
      alert("Failed to replace file");
    } finally {
      setIsReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReplaceThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;

    setIsReplacing(true);
    try {
      const updated = await api.replaceModelThumbnail(model.id, file);
      onUpdate(model.id, {
        url: updated.url,
        size: updated.size,
        thumbnail: updated.thumbnail,
      });
    } catch (e) {
      console.error("Failed to replace", e);
      alert("Failed to replace file");
    } finally {
      setIsReplacing(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  };

  const handleGenerateThumbnail = (dataurl: string) => {
    setTempThumb(dataurl);
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !model) return;
    try {
      await onUploadManual(model.id, file);
    } finally {
      if (manualInputRef.current) manualInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    const currentExt = getExtension(model.name);
    const editExt = getExtension(editName);
    const newName = editExt !== currentExt ? `${editName}.${currentExt}` : editName;

    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tempThumb !== "") {
      onUpdate(model.id, { name: newName, description: editDesc, tags: newTags, thumbnail: tempThumb });
    } else {
      onUpdate(model.id, { name: newName, description: editDesc, tags: newTags });
    }

    setIsEditing(false);
  };

  return (
    <div className="w-screen sm:w-96 border-l border-outline-variant bg-surface-container-low flex flex-col h-full shadow-2xl z-20 relative">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant flex justify-between items-center shrink-0">
        <h2 className="text-headline-sm font-headline-sm text-on-surface">Model Details</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Viewer */}
        <div className="-m-4 aspect-square bg-black overflow-hidden shadow-inner -mb-2">
          <Viewer3D
            url={model.url}
            filename={model.name}
            thumbnail={model.thumbnail}
            editing={isEditing}
            onMakeThumbnail={handleGenerateThumbnail}
            onLoaded={handleModelLoaded}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={api.getDownloadUrl(model)}
            download={model.name}
            className={`${primaryBtn} flex-1`}
          >
            <Icon name="download" className="text-lg" /> Download
          </a>
          <a href={api.getSlicerUrl(model)} className={`${outlinedBtn} flex-1`}>
            <Icon name="ios_share" className="text-lg" />
            <span className="truncate">Open in Slicer</span>
          </a>
        </div>

        {/* Info Form */}
        <div className="space-y-4">
          <div>
            <h3 className="text-headline-sm font-headline-sm text-on-surface mb-1">Name</h3>
            {isEditing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            ) : (
              <p className="text-body-md font-body-md text-on-surface-variant break-words">{model.name}</p>
            )}
          </div>

          <p className="text-body-sm font-body-sm text-on-surface-variant">
            Filename:
            <br />
            {model.id}.{model.name.split(".").pop()}
          </p>
          <div className="h-px bg-outline-variant" />

          <div>
            <p className="text-body-md font-body-md text-on-surface mb-1">Description</p>
            {isEditing ? (
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Add a description..."
                className="w-full min-h-[80px] bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
              />
            ) : (
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                {model.description || "No Description"}
              </p>
            )}
          </div>
          <div className="h-px bg-outline-variant" />

          <div>
            <p className="text-body-md font-body-md text-on-surface mb-2">Manual</p>
            {isEditing ? (
              model.manual ? (
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-body-sm font-body-sm text-on-surface-variant flex-1 truncate">
                    {model.manual}
                  </p>
                  <button
                    onClick={() => onEditManual(model)}
                    aria-label="Edit manual"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                  >
                    <Icon name="edit" className="text-lg" />
                  </button>
                  <button
                    onClick={() => onDeleteManual(model.id)}
                    aria-label="Delete manual"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-surface-container-highest transition-colors"
                  >
                    <Icon name="delete" className="text-lg" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className={`${primaryBtn} cursor-pointer`}>
                    <Icon name="upload_file" className="text-lg" /> Upload Manual
                    <input
                      type="file"
                      ref={manualInputRef}
                      className="hidden"
                      accept=".md,.markdown,text/markdown"
                      onChange={handleManualUpload}
                    />
                  </label>
                  <button onClick={() => onEditManual(model)} className={outlinedBtn}>
                    <Icon name="edit" className="text-lg" /> Or paste
                  </button>
                </div>
              )
            ) : model.manual ? (
              <button onClick={() => onOpenManual(model)} className={`${outlinedBtn} w-full`}>
                <Icon name="menu_book" className="text-lg" /> Open Manual
              </button>
            ) : (
              <p className="text-body-sm font-body-sm text-on-surface-variant">No manual</p>
            )}
          </div>
          <div className="h-px bg-outline-variant" />

          <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">
            Metadata
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-outline-variant space-y-3">
              <div>
                <p className="text-body-sm font-body-sm text-on-surface-variant mb-2">Tags</p>
                {isEditing ? (
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="scifi, armor, character..."
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                ) : model.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {model.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-primary/10 text-primary px-3 py-0.5 rounded-full text-label-sm font-label-sm flex items-center gap-1"
                      >
                        <Icon name="sell" className="text-sm" />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-on-surface-variant/60 italic text-body-sm">No tags</span>
                )}
              </div>
              <div className="h-px bg-outline-variant" />
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Icon name="calendar_today" className="text-sm" />
                <span className="text-body-sm">Added:</span>
                <span className="text-label-sm">{new Date(model.dateAdded).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Icon name="hard_drive" className="text-sm" />
                <span className="text-body-sm">File Size:</span>
                <span className="text-label-sm">{(model.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
            <div className="h-px bg-outline-variant" />

            {isEditing && (
              <div className="pb-3 border-b border-outline-variant mb-3 space-y-3">
                <h3 className="text-headline-sm font-headline-sm text-on-surface">File editing</h3>

                <div>
                  <p className="text-body-md font-body-md text-on-surface">Source File</p>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    {model.id}.{model.name.split(".").pop()}
                  </p>
                </div>
                <label className={`${primaryBtn} cursor-pointer ${isReplacing ? "opacity-50 pointer-events-none" : ""}`}>
                  <Icon name={isReplacing ? "autorenew" : "upload_file"} className="text-lg" />
                  {isReplacing ? "Uploading..." : "Replace 3D Model File"}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".stl,.step,.stp,.3mf"
                    onChange={handleReplaceFile}
                  />
                </label>

                <p className="text-body-md font-body-md text-on-surface">Thumbnail</p>
                <div className="w-full flex justify-center">
                  <img
                    className="h-48 w-48 rounded-lg object-cover bg-surface-container-highest"
                    src={tempThumb !== "" ? tempThumb : model.thumbnail}
                    alt="thumbnail"
                  />
                </div>
                <label className={`${primaryBtn} cursor-pointer ${isReplacing ? "opacity-50 pointer-events-none" : ""}`}>
                  <Icon name={isReplacing ? "autorenew" : "upload_file"} className="text-lg" />
                  {isReplacing ? "Uploading..." : "Replace Thumbnail"}
                  <input
                    type="file"
                    ref={thumbInputRef}
                    className="hidden"
                    accept=".jpeg,.png,.jpg"
                    onChange={handleReplaceThumbnail}
                  />
                </label>
                <button
                  disabled={isReplacing}
                  onClick={() => setTempThumb("")}
                  className={`${outlinedBtn} w-full text-error border-error/40`}
                >
                  <Icon name="close" className="text-lg" /> Clear Generated Thumbnail
                </button>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className={`${primaryBtn} flex-1`}>
                  <Icon name="save" className="text-lg" /> Save Changes
                </button>
                <button onClick={() => setIsEditing(false)} className={`${outlinedBtn} flex-1`}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className={`${outlinedBtn} w-full`}>
              <Icon name="edit" className="text-lg" /> Edit
            </button>
          )}
          <div className="h-px bg-outline-variant" />
          <h3 className="text-headline-sm font-headline-sm text-error">Warning Zone</h3>
          <button
            onClick={() => onDelete(model.id)}
            className="w-full bg-error text-on-error rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95"
          >
            <Icon name="delete" className="text-lg" /> Delete Model
          </button>
        </div>

        {/* Error Modal Overlay */}
        {errorState.show && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-6">
            <div className="bg-surface-container-high border border-error/50 rounded-xl shadow-2xl w-full p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-error-container/30 flex items-center justify-center">
                  <Icon name="warning" className="text-2xl text-error" />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">File Mismatch</h3>
                  <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                    {errorState.message}
                  </p>
                </div>
                <button
                  onClick={() => setErrorState({ show: false, message: "" })}
                  className={`${outlinedBtn} w-full mt-2`}
                >
                  Okay, got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
