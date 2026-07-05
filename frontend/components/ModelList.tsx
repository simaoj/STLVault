import React, { useRef, useState, useMemo, useEffect } from "react";
import { STLModel, Folder } from "../types";
import { api } from "../services/api";
import Icon from "./Icon";

interface ModelListProps {
  models: STLModel[];
  folders: Folder[];
  folderCounts: Record<string, number>;
  currentFolderId: string;
  currentFolderName: string;
  onBackNavigation: () => void;
  onUpload: (files: FileList) => void;
  onImport: () => void;
  onSelectModel: (model: STLModel) => void;
  onDelete: (id: string) => void;
  onOpenManual: (model: STLModel) => void;
  selectedModelId: string | null;

  // Selection Props
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (filtered: STLModel[]) => void;
  onClearSelection: () => void;

  // Folder Interaction Props
  onNavigateFolder: (id: string) => void;
  onMoveToFolder: (folderId: string, modelIds: string[]) => void;
  onUploadToFolder: (folderId: string, files: FileList) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
}

type SortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc";

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date Added (Newest)",
  "date-asc": "Date Added (Oldest)",
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  "size-desc": "Size (Largest)",
  "size-asc": "Size (Smallest)",
};

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + " MB";

const ModelList: React.FC<ModelListProps> = ({
  models,
  folders,
  folderCounts,
  currentFolderId,
  currentFolderName,
  onBackNavigation,
  onUpload,
  onImport,
  onSelectModel,
  onDelete,
  onOpenManual,
  selectedModelId,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onNavigateFolder,
  onMoveToFolder,
  onUploadToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeMenuModelId, setActiveMenuModelId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    setIsTouchDevice(Boolean(isTouch));
  }, []);

  const processedModels = useMemo(() => {
    let result = [...models];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return b.dateAdded - a.dateAdded;
        case "date-asc":
          return a.dateAdded - b.dateAdded;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "size-desc":
          return b.size - a.size;
        case "size-asc":
          return a.size - b.size;
        default:
          return 0;
      }
    });
    return result;
  }, [models, searchQuery, sortBy]);

  const processedFolders = useMemo(() => {
    let result = [...folders];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [folders, searchQuery]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadToFolder(folderId, e.dataTransfer.files);
      return;
    }
    try {
      const data = e.dataTransfer.getData("application/json");
      if (data) {
        const { modelIds } = JSON.parse(data);
        if (Array.isArray(modelIds) && modelIds.length > 0) {
          onMoveToFolder(folderId, modelIds);
        }
      }
    } catch (err) {
      console.error("Failed to process drop on folder", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = "";
    }
  };

  const handleCardDragStart = (e: React.DragEvent, modelId: string) => {
    const idsToMove = selectedIds.has(modelId) ? Array.from(selectedIds) : [modelId];
    e.dataTransfer.setData("application/json", JSON.stringify({ modelIds: idsToMove }));
    e.dataTransfer.effectAllowed = "move";
  };

  const submitCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), currentFolderId === "all" ? null : currentFolderId);
    }
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const startRenameFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const submitRenameFolder = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editingFolderName.trim() && editingFolderName.trim() !== folders.find((f) => f.id === id)?.name) {
      onRenameFolder(id, editingFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const selectionMode = selectedIds.size > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-dim relative">
      <div className="p-margin-mobile sm:p-margin-desktop">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {currentFolderId !== "all" && (
                <button
                  onClick={onBackNavigation}
                  aria-label="Back"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors shrink-0"
                >
                  <Icon name="arrow_back" />
                </button>
              )}
              <h1 className="text-headline-lg font-headline-lg text-on-surface truncate">
                {currentFolderName}
              </h1>
            </div>
            <p className="text-body-md font-body-md text-on-surface-variant mt-1">
              {currentFolderId === "all"
                ? "Manage and organize your 3D assets in the secure cloud vault."
                : `${processedFolders.length} folder${processedFolders.length === 1 ? "" : "s"} • ${processedModels.length} model${processedModels.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] sm:w-80 sm:flex-none">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none"
              />
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search library..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-10 pr-9 py-2.5 text-body-sm font-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <Icon name="cancel" className="text-lg" />
                </button>
              )}
            </div>

            <button
              onClick={() => onSelectAll(processedModels)}
              className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all"
            >
              <Icon name="checklist" />
              <span className="text-label-md font-label-md hidden sm:inline">
                {models.length > 0 && models.length === selectedIds.size ? "Unselect All" : "Select All"}
              </span>
            </button>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort"
                className="appearance-none bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-xl pl-10 pr-8 py-2.5 text-label-md font-label-md cursor-pointer outline-none transition-all"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <option key={opt} value={opt}>
                    {SORT_LABELS[opt]}
                  </option>
                ))}
              </select>
              <Icon
                name="sort"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-lg"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setNewMenuOpen((v) => !v)}
                className="bg-primary-container text-on-primary-container rounded-xl px-6 py-2.5 flex items-center gap-2 font-bold transition-transform active:scale-95"
              >
                <Icon name="add" />
                <span className="text-label-md font-label-md">New</span>
              </button>
              {newMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setNewMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setNewMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm font-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Icon name="upload_file" className="text-lg" /> Upload Files
                    </button>
                    <button
                      onClick={() => {
                        onImport();
                        setNewMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm font-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Icon name="public" className="text-lg" /> Import from URL
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingFolder(true);
                        setNewMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm font-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Icon name="create_new_folder" className="text-lg" /> Create Folder
                    </button>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".stl,.step,.stp,.3mf"
                multiple
              />
            </div>
          </div>
        </div>

        {/* Collections Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">
              Collections
            </span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
            {processedFolders.map((folder) => {
              const count = folderCounts[folder.id] || 0;
              const isDragTarget = dragOverFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => editingFolderId !== folder.id && onNavigateFolder(folder.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(null);
                  }}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                  className={`glass-panel group cursor-pointer rounded-xl p-4 hover:border-primary transition-all duration-300 ${
                    isDragTarget ? "border-primary ring-2 ring-primary/40 -translate-y-1" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary-container/20 rounded-lg text-primary">
                      <Icon name="folder" filled />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-label-sm font-label-sm text-on-surface-variant group-hover:hidden">
                        {count} {count === 1 ? "Item" : "Items"}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenameFolder(folder);
                          }}
                          aria-label="Rename folder"
                          className="w-7 h-7 rounded-full bg-surface-container-highest/80 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <Icon name="edit" className="text-base" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder(folder.id);
                          }}
                          aria-label="Delete folder"
                          className="w-7 h-7 rounded-full bg-surface-container-highest/80 flex items-center justify-center text-on-surface-variant hover:text-error transition-colors"
                        >
                          <Icon name="delete" className="text-base" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {editingFolderId === folder.id ? (
                    <form onSubmit={(e) => submitRenameFolder(e, folder.id)} onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={(e) => submitRenameFolder(e as unknown as React.FormEvent, folder.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        className="w-full bg-transparent border-b border-primary outline-none text-headline-sm font-headline-sm text-on-surface mb-1"
                      />
                    </form>
                  ) : (
                    <h3 className="text-headline-sm font-headline-sm text-on-surface mb-1 truncate">
                      {folder.name}
                    </h3>
                  )}
                  <p className="text-body-sm font-body-sm text-on-surface-variant">Folder</p>
                </div>
              );
            })}

            {isCreatingFolder ? (
              <form
                onSubmit={submitCreateFolder}
                className="border-2 border-primary/60 bg-surface-container rounded-xl p-4 flex flex-col gap-3 justify-center"
              >
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="Folder name..."
                  className="w-full bg-transparent border-b border-outline-variant focus:border-primary outline-none text-body-md font-body-md text-on-surface py-1"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }}
                    className="text-label-sm font-label-sm text-on-surface-variant hover:text-on-surface px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="text-label-sm font-label-sm text-primary font-bold px-2 py-1">
                    Create
                  </button>
                </div>
              </form>
            ) : (
              <div
                onClick={() => setIsCreatingFolder(true)}
                className="border-2 border-dashed border-outline-variant rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-surface-container transition-all cursor-pointer group min-h-[132px]"
              >
                <Icon name="create_new_folder" className="text-2xl text-outline group-hover:text-primary" />
                <span className="text-label-md font-label-md text-on-surface-variant group-hover:text-primary">
                  Create Folder
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Files Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">
                {currentFolderId === "all" ? "Recent Files" : "Files"}
              </span>
              <div className="h-px w-24 bg-outline-variant" />
            </div>
            <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-1.5 rounded ${
                  viewMode === "grid"
                    ? "bg-surface-container-highest text-primary"
                    : "hover:bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                <Icon name="grid_view" className="text-[18px]" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-1.5 rounded ${
                  viewMode === "list"
                    ? "bg-surface-container-highest text-primary"
                    : "hover:bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                <Icon name="view_list" className="text-[18px]" />
              </button>
            </div>
          </div>

          {processedModels.length === 0 ? (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low/30 py-16"
            >
              {searchQuery ? (
                <>
                  <Icon name="search_off" className="text-5xl mb-4 opacity-50" />
                  <p className="text-body-lg font-body-lg">No matches found</p>
                  <p className="text-body-sm font-body-sm">Try adjusting your search query</p>
                </>
              ) : isDragging ? (
                <div className="text-center p-4">
                  <Icon name="cloud_upload" className="text-6xl text-primary mx-auto mb-4 animate-bounce" />
                  <h2 className="text-headline-sm font-headline-sm text-on-surface">Drop 3D files</h2>
                  <p className="text-on-surface-variant mt-2 text-body-sm">Supported: STL, STEP, 3MF</p>
                </div>
              ) : (
                <>
                  <Icon name="deployed_code" className="text-6xl mb-4 opacity-50" />
                  <p className="text-body-lg font-body-lg">This folder is empty</p>
                  <p className="text-body-sm font-body-sm">Drag and drop STL or STEP files to upload</p>
                  {isTouchDevice && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 bg-primary-container text-on-primary-container px-4 py-2 rounded-xl font-bold transition-transform active:scale-95"
                    >
                      Tap to choose files
                    </button>
                  )}
                </>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6"
            >
              {isDragging && (
                <div className="absolute inset-0 z-10 bg-black/50 border-4 border-dashed border-primary flex items-center justify-center backdrop-blur-sm rounded-xl pointer-events-none">
                  <div className="text-center">
                    <Icon name="cloud_upload" className="text-6xl text-primary mx-auto mb-4 animate-bounce" />
                    <h2 className="text-headline-sm font-headline-sm text-on-surface">Drop 3D files</h2>
                    <p className="text-primary-fixed mt-2 text-body-sm">Supported: STL, STEP, 3MF</p>
                  </div>
                </div>
              )}

              {processedModels.map((model) => {
                const isSelected = selectedIds.has(model.id);
                const isMenuOpen = activeMenuModelId === model.id;
                const ext = model.name.split(".").pop()?.toUpperCase() || "";
                return (
                  <div
                    key={model.id}
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, model.id)}
                    onClick={() => (selectionMode ? onToggleSelection(model.id) : onSelectModel(model))}
                    className="group model-card bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant transition-all hover:-translate-y-1 relative cursor-pointer active:cursor-grabbing"
                  >
                    <div className="aspect-square relative overflow-hidden bg-surface-container-highest">
                      {model.thumbnail ? (
                        <img
                          src={model.thumbnail}
                          alt={model.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-primary-container/20 to-transparent">
                          <Icon name="deployed_code" className="text-5xl text-on-surface-variant/50" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex gap-2">
                        <span className="px-1.5 py-0.5 bg-primary text-on-primary font-label-sm text-label-sm rounded uppercase font-bold">
                          {ext}
                        </span>
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelection(model.id);
                        }}
                        className={`absolute top-2 right-2 z-10 transition-opacity duration-200 ${
                          isSelected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          aria-label={`Select ${model.name}`}
                          className="w-4 h-4 rounded accent-primary cursor-pointer"
                        />
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectModel(model);
                          }}
                          aria-label="View model"
                          className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-primary transition-colors"
                        >
                          <Icon name="visibility" className="text-base" />
                        </button>
                        <a
                          href={api.getDownloadUrl(model)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Download model"
                          className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          <Icon name="download" className="text-base" />
                        </a>
                      </div>
                    </div>

                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="text-body-sm font-bold text-on-surface truncate flex-1">{model.name}</h4>
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuModelId(isMenuOpen ? null : model.id);
                            }}
                            aria-label="More actions"
                            className="w-5 h-5 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                          >
                            <Icon name="more_vert" className="text-base" />
                          </button>
                          {isMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setActiveMenuModelId(null)} />
                              <div className="absolute right-0 mt-1 w-48 bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl z-30 overflow-hidden py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectModel(model);
                                    setActiveMenuModelId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                                >
                                  <Icon name="open_in_new" className="text-base" /> Open
                                </button>
                                <a
                                  href={api.getSlicerUrl(model)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuModelId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                                >
                                  <Icon name="ios_share" className="text-base" /> Open in Slicer
                                </a>
                                {model.manual && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenManual(model);
                                      setActiveMenuModelId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                                  >
                                    <Icon name="menu_book" className="text-base" /> Manual
                                  </button>
                                )}
                                <div className="h-px bg-outline-variant my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(model.id);
                                    setActiveMenuModelId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-error hover:bg-surface-container-highest transition-colors text-left"
                                >
                                  <Icon name="delete" className="text-base" /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-label-sm font-label-sm text-on-surface-variant">
                          {formatSize(model.size)}
                        </span>
                        <span className="text-label-sm font-label-sm text-on-surface-variant opacity-60">
                          {formatRelativeTime(model.dateAdded)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative flex flex-col gap-2 pb-6"
            >
              {isDragging && (
                <div className="absolute inset-0 z-10 bg-black/50 border-4 border-dashed border-primary flex items-center justify-center backdrop-blur-sm rounded-xl pointer-events-none">
                  <div className="text-center">
                    <Icon name="cloud_upload" className="text-6xl text-primary mx-auto mb-4 animate-bounce" />
                    <h2 className="text-headline-sm font-headline-sm text-on-surface">Drop 3D files</h2>
                  </div>
                </div>
              )}
              {processedModels.map((model) => {
                const isSelected = selectedIds.has(model.id);
                const ext = model.name.split(".").pop()?.toUpperCase() || "";
                return (
                  <div
                    key={model.id}
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, model.id)}
                    onClick={() => (selectionMode ? onToggleSelection(model.id) : onSelectModel(model))}
                    className={`flex items-center gap-4 bg-surface-container-low border rounded-xl p-3 transition-colors cursor-pointer ${
                      isSelected ? "border-primary" : "border-outline-variant hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelection(model.id)}
                      aria-label={`Select ${model.name}`}
                      className="w-5 h-5 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-highest shrink-0 flex items-center justify-center">
                      {model.thumbnail ? (
                        <img src={model.thumbnail} alt={model.name} className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="deployed_code" className="text-on-surface-variant/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md font-bold text-on-surface truncate">{model.name}</p>
                      <p className="text-label-sm font-label-sm text-on-surface-variant">
                        {formatSize(model.size)} • {formatRelativeTime(model.dateAdded)}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-surface-container-highest text-on-surface font-label-sm text-label-sm rounded uppercase font-bold shrink-0">
                      {ext}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={api.getDownloadUrl(model)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Download model"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                      >
                        <Icon name="download" className="text-lg" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(model.id);
                        }}
                        aria-label="Delete model"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-surface-container-highest transition-colors"
                      >
                        <Icon name="delete" className="text-lg" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ModelList;
