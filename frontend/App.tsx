import React, { useState, useEffect, useMemo, useRef } from "react";
import ModelList from "./components/ModelList";
import DetailPanel from "./components/DetailPanel";
import Settings from "./components/Settings";
import Navbar from "./components/Navbar";
import ManualModal from "./components/ManualModal";
import Icon from "./components/Icon";
import { STLModel, Folder, STLModelCollection } from "./types";
import { generateThumbnail } from "./services/thumbnailGenerator";
import { api, authFetch } from "./services/api";
import Login from "./components/Login";
import JSZip from "jszip";
import { useVisualViewport } from "./hooks/useVisualViewport";

const primaryBtn =
  "bg-primary-container text-on-primary-container rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const outlinedBtn =
  "border border-outline-variant text-on-surface hover:bg-surface-container-highest rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-colors";
const modalInput =
  "w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all";

const App = () => {
  const visualViewport = useVisualViewport();
  const [authStatus, setAuthStatus] = useState<"loading" | "authed" | "anon">("loading");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [models, setModels] = useState<STLModel[]>([]);

  const [currentFolderId, setCurrentFolderId] = useState<string>("all");
  const [currentFolderParentId, setCurrentFolderParentId] = useState("all");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [bulkTags, setBulkTags] = useState("");

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadTags, setUploadTags] = useState("");

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportOptionsModal, setShowImportOptionsModal] = useState(false);
  const [modelsOptions, setModelsOptions] = useState<STLModelCollection[]>([]);
  const [folderOptions, setFolderOptions] = useState<Set<string>>(new Set());
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [importUrl, setImportUrl] = useState("");
  const [importFolderId, setImportFolderId] = useState("");
  const port = import.meta.env.VITE_API_URL;
  const navUploadInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: "single" | "bulk" | "folder";
    id?: string;
  }>({ isOpen: false, type: "single" });

  const [manualState, setManualState] = useState<{
    id: string | null;
    mode: "view" | "edit";
  }>({ id: null, mode: "view" });

  // Check for an existing session on load
  useEffect(() => {
    api
      .getMe()
      .then(() => setAuthStatus("authed"))
      .catch(() => setAuthStatus("anon"));
  }, []);

  // React to session expiry / 401s from any API call
  useEffect(() => {
    const handleUnauthorized = () => setAuthStatus("anon");
    window.addEventListener("stlvault:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("stlvault:unauthorized", handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setAuthStatus("anon");
  };

  // Initial Data Fetch
  useEffect(() => {
    if (authStatus !== "authed") return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedFolders, fetchedModels] = await Promise.all([
          api.getFolders(),
          api.getModels("all"),
        ]);
        setFolders(fetchedFolders);
        setModels(fetchedModels);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [authStatus]);

  // Direct-children counts per folder (models + subfolders), used for Collection card badges
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    models.forEach((m) => {
      counts[m.folderId] = (counts[m.folderId] || 0) + 1;
    });
    folders.forEach((f) => {
      if (f.parentId) counts[f.parentId] = (counts[f.parentId] || 0) + 1;
    });
    return counts;
  }, [models, folders]);

  // Filter models based on selection
  const filteredModels =
    currentFolderId === "all" ? models : models.filter((m) => m.folderId === currentFolderId);

  // Filter subfolders based on selection
  const filteredFolders =
    currentFolderId === "all"
      ? folders.filter((f) => f.parentId == null)
      : folders.filter((f) => f.parentId === currentFolderId);

  // Clear selection when changing folders to avoid confusion
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentFolderParentId(
      currentFolderId === "all"
        ? "all"
        : folders.find((f) => f.id === currentFolderId)?.parentId || "all",
    );
  }, [currentFolderId]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;
  const manualModel = models.find((m) => m.id === manualState.id) || null;

  const currentFolderName =
    currentFolderId === "all"
      ? "All Models"
      : folders.find((f) => f.id === currentFolderId)?.name || "Folder";

  const handleCreateFolder = async (name: string, parentId: string | null = null) => {
    try {
      const newFolder = await api.createFolder(name, parentId);
      setFolders((prev) => [...prev, newFolder]);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      await api.updateFolder(id, newName);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
    } catch (error) {
      console.error("Failed to rename folder", error);
    }
  };

  const handleDeleteFolder = (id: string) => {
    const hasModels = models.some((m) => m.folderId === id);
    const hasSubfolders = folders.some((f) => f.parentId === id);

    if (hasModels || hasSubfolders) {
      alert("Folder must be empty to delete. Please delete or move all models and subfolders first.");
      return;
    }
    setDeleteConfirmState({ isOpen: true, type: "folder", id });
  };

  // Core upload logic
  const executeUpload = async (files: File[], targetFolderId: string, tags: string[]) => {
    setUploadQueue((prev) => prev + files.length);

    for (const file of files) {
      try {
        let thumbnail: string | undefined = undefined;
        try {
          thumbnail = await generateThumbnail(file);
        } catch (e) {
          console.warn("Thumbnail generation failed, uploading without thumbnail");
        }

        const newModel = await api.uploadModel(file, targetFolderId, thumbnail, tags);
        setModels((prev) => [newModel, ...prev]);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      } finally {
        setUploadQueue((prev) => prev - 1);
      }
    }
  };

  const handleUpload = async (fileList: FileList, specificFolderId?: string) => {
    const files = Array.from(fileList);

    if (!specificFolderId && currentFolderId === "all") {
      setPendingFiles(files);
      setUploadFolderId(folders.length > 0 ? folders[0].id : "");
      setUploadTags("");
      setShowUploadModal(true);
      return;
    }

    const targetFolderId = specificFolderId || currentFolderId;

    const finalFolderId =
      targetFolderId === "all" && folders.length > 0 ? folders[0].id : targetFolderId;

    await executeUpload(files, finalFolderId, []);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFolderId) return;

    const tags = uploadTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setShowUploadModal(false);
    await executeUpload(pendingFiles, uploadFolderId, tags);
    setPendingFiles([]);
  };

  const handleOpenImport = () => {
    setImportUrl("");
    setSelectedOptions(new Set());
    setModelsOptions([]);
    setImportFolderId(currentFolderId !== "all" ? currentFolderId : folders[0]?.id || "");
    setShowImportModal(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl || !importFolderId) return;

    try {
      const ModelOptions = await api.retrieveModelOptions(importUrl);
      const NewSet = new Set("");
      ModelOptions.forEach((m) => {
        if (!NewSet.has(m.folder)) {
          NewSet.add(m.folder);
        }
      });
      setFolderOptions(NewSet);
      setModelsOptions(ModelOptions);
      setShowImportModal(false);
      setShowImportOptionsModal(true);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import from URL");
    }
  };

  const handleOptionsToggleSelection = (id: string) => {
    const newSet = new Set(selectedOptions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOptions(newSet);
  };

  const handleUpdateSTEPThumbnail = async (newModel: STLModel) => {
    let tbuff = await authFetch(port + newModel.url).then((response) => response);
    let thumbnailBuffer = await tbuff.bytes().then((bytes) => bytes);
    try {
      let thumbnail = await generateThumbnail(new File([thumbnailBuffer], newModel.name));
      let newerModel = await api.updateModel(newModel.id, { thumbnail: thumbnail });
      setModels((prev) => [newerModel, ...prev]);
    } catch (e) {
      console.warn("Thumbnail generation failed, uploading without thumbnail");
    }
  };

  const handleImportChoice = async () => {
    if (!importUrl || !importFolderId) return;

    setIsLoading(true);
    setShowImportOptionsModal(false);
    setUploadQueue((prev) => prev + selectedOptions.size);
    try {
      for (const model of modelsOptions) {
        if (selectedOptions.has(model.id)) {
          let newModel = await api.importModelFromId(
            model.id,
            model.name,
            model.parentId,
            model.previewPath,
            importFolderId,
            model.typeName,
          );
          await handleUpdateSTEPThumbnail(newModel);
          setUploadQueue((prev) => prev - 1);
        }
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import from URL");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<STLModel>) => {
    try {
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      await api.updateModel(id, updates);
    } catch (error) {
      console.error("Failed to update model:", error);
    }
  };

  const handleUploadManual = async (id: string, file: File) => {
    try {
      const updated = await api.uploadManual(id, file);
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, manual: updated.manual } : m)));
      return updated;
    } catch (error) {
      console.error("Failed to upload manual:", error);
      alert("Failed to upload manual");
      throw error;
    }
  };

  const handleDeleteManual = async (id: string) => {
    try {
      const updated = await api.deleteManual(id);
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, manual: updated.manual } : m)));
    } catch (error) {
      console.error("Failed to delete manual:", error);
      alert("Failed to delete manual");
    }
  };

  const handleDeleteModel = (id: string) => {
    setDeleteConfirmState({ isOpen: true, type: "single", id });
  };

  const handleBulkDelete = () => {
    setDeleteConfirmState({ isOpen: true, type: "bulk" });
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmState;

    try {
      if (type === "single" && id) {
        await api.deleteModel(id);
        setModels((prev) => prev.filter((m) => m.id !== id));
        if (selectedModelId === id) setSelectedModelId(null);
      } else if (type === "bulk") {
        const ids = Array.from(selectedIds) as string[];
        await api.bulkDeleteModels(ids);
        setModels((prev) => prev.filter((m) => !ids.includes(m.id)));
        setSelectedIds(new Set());
        if (selectedModelId && ids.includes(selectedModelId)) setSelectedModelId(null);
      } else if (type === "folder" && id) {
        await api.deleteFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (currentFolderId === id) setCurrentFolderId("all");
      }
    } catch (error) {
      console.error("Delete operation failed:", error);
      alert("Failed to delete. Please check console.");
    } finally {
      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // --- Bulk Actions Logic ---

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = (filtered: STLModel[]) => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = filtered.map((m) => m.id);
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkMoveSubmit = async (targetFolderId: string) => {
    try {
      const ids = Array.from(selectedIds) as string[];
      await api.bulkMoveModels(ids, targetFolderId);
      setModels((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, folderId: targetFolderId } : m)),
      );
      setShowMoveModal(false);
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Bulk move failed", e);
    }
  };

  const handleDropMove = async (targetFolderId: string, modelIds: string[]) => {
    try {
      await api.bulkMoveModels(modelIds, targetFolderId);
      setModels((prev) =>
        prev.map((m) => (modelIds.includes(m.id) ? { ...m, folderId: targetFolderId } : m)),
      );
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Drop move failed", e);
    }
  };

  const handleBulkTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ids = Array.from(selectedIds) as string[];
      const tags = bulkTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.bulkAddTags(ids, tags);
      setModels((prev) =>
        prev.map((m) => {
          if (selectedIds.has(m.id)) {
            return { ...m, tags: [...new Set([...m.tags, ...tags])] };
          }
          return m;
        }),
      );
      setShowTagModal(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk tag failed", err);
    }
  };

  const handleBulkDownload = async () => {
    setIsLoading(true);
    try {
      const zip = new JSZip();
      const selectedModels = models.filter((m) => selectedIds.has(m.id));

      const filePromises = selectedModels.map(async (model) => {
        try {
          const url = api.getDownloadUrl(model);
          const response = await authFetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${model.name}`);
          const blob = await response.blob();
          zip.file(model.name, blob);
        } catch (err) {
          console.error(`Error downloading ${model.name} for zip:`, err);
        }
      });

      await Promise.all(filePromises);

      const content = await zip.generateAsync({ type: "blob" });
      const saveUrl = URL.createObjectURL(content);

      const link = document.createElement("a");
      link.href = saveUrl;
      link.download = `stlvault-batch-${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(saveUrl);

      setSelectedIds(new Set());
    } catch (error) {
      console.error("Bulk download failed:", error);
      alert("Failed to generate zip file.");
    } finally {
      setIsLoading(false);
    }
  };

  const modalWrapperStyle = (extraZ = 60) => ({
    width: "100%",
    height: visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0),
    transform: `translate(${visualViewport.offsetLeft}px, ${visualViewport.offsetTop}px)`,
  });

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-dvh bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (authStatus === "anon") {
    return <Login onSuccess={() => setAuthStatus("authed")} />;
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Navbar
        activeView={showSettings ? "settings" : "library"}
        onNavigateLibrary={() => setShowSettings(false)}
        onNavigateSettings={() => setShowSettings(true)}
        onOpenUpload={() => navUploadInputRef.current?.click()}
        onFocusSearch={() => {
          setShowSettings(false);
          requestAnimationFrame(() => document.getElementById("search-input")?.focus());
        }}
        onLogout={handleLogout}
      />
      <input
        ref={navUploadInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".stl,.step,.stp,.3mf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {showSettings ? (
        <Settings />
      ) : (
        <main className="flex-1 flex overflow-hidden relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-dim z-50">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                <p className="text-on-surface-variant animate-pulse text-body-sm">Processing...</p>
              </div>
            </div>
          ) : (
            <ModelList
              models={filteredModels}
              folders={filteredFolders}
              folderCounts={folderCounts}
              currentFolderId={currentFolderId}
              currentFolderName={currentFolderName}
              onBackNavigation={() => setCurrentFolderId(currentFolderParentId)}
              onUpload={(files) => handleUpload(files)}
              onImport={handleOpenImport}
              onSelectModel={(m) => setSelectedModelId(m.id)}
              onDelete={handleDeleteModel}
              onOpenManual={(m) => setManualState({ id: m.id, mode: "view" })}
              selectedModelId={selectedModelId}
              selectedIds={selectedIds}
              onToggleSelection={handleToggleSelection}
              onSelectAll={(filtered) => handleSelectAll(filtered)}
              onClearSelection={() => setSelectedIds(new Set())}
              onNavigateFolder={(id) => setCurrentFolderId(id)}
              onMoveToFolder={handleDropMove}
              onUploadToFolder={(folderId, files) => handleUpload(files, folderId)}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          )}

          {/* Upload Indicator */}
          {uploadQueue > 0 && (
            <div className="absolute bottom-6 left-6 bg-primary-container text-on-primary-container px-4 py-2 rounded-xl shadow-lg z-50 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
              <span className="text-label-md font-label-md">Uploading {uploadQueue} file(s)...</span>
            </div>
          )}

          {/* Backdrop for closing detail panel */}
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] z-20 transition-opacity duration-300 ${
              selectedModelId ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setSelectedModelId(null)}
          />

          {/* Slide-over panel */}
          <div
            className={`absolute top-0 right-0 h-full transition-transform duration-300 ease-in-out transform ${
              selectedModelId ? "translate-x-0" : "translate-x-full"
            } z-30`}
          >
            <DetailPanel
              model={selectedModel}
              onClose={() => setSelectedModelId(null)}
              onUpdate={handleUpdateModel}
              onDelete={handleDeleteModel}
              onOpenManual={(m) => setManualState({ id: m.id, mode: "view" })}
              onEditManual={(m) => setManualState({ id: m.id, mode: "edit" })}
              onUploadManual={handleUploadManual}
              onDeleteManual={handleDeleteManual}
            />
          </div>

          {/* Floating Action Bar */}
          {selectedIds.size > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass-panel shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50">
              <div className="flex items-center gap-2 border-r border-outline-variant pr-4">
                <span className="font-bold text-on-surface">{selectedIds.size}</span>
                <span className="text-on-surface-variant text-body-sm">selected</span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-2 text-on-surface-variant hover:text-on-surface"
                  aria-label="Clear selection"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                  title="Move Selected"
                >
                  <Icon name="drive_file_move" className="text-lg" />
                  <span className="text-label-sm font-label-sm hidden sm:inline">Move</span>
                </button>

                <button
                  onClick={() => {
                    setBulkTags("");
                    setShowTagModal(true);
                  }}
                  className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-2"
                  title="Tag Selected"
                >
                  <Icon name="sell" className="text-lg" />
                  <span className="text-label-sm font-label-sm hidden sm:inline">Tag</span>
                </button>

                <button
                  onClick={handleBulkDownload}
                  className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-tertiary transition-colors flex items-center gap-2"
                  title="Download Selected"
                >
                  <Icon name="download" className="text-lg" />
                  <span className="text-label-sm font-label-sm hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-error transition-colors flex items-center gap-2"
                  title="Delete Selected"
                >
                  <Icon name="delete" className="text-lg" />
                  <span className="text-label-sm font-label-sm hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Modals Layer */}

          <ManualModal
            model={manualModel}
            initialMode={manualState.mode}
            onClose={() => setManualState({ id: null, mode: "view" })}
            onSave={handleUploadManual}
          />

          {/* Upload Modal */}
          {showUploadModal && (
            <div
              className={`fixed left-0 top-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="bg-surface-container-high border border-outline-variant rounded-xl p-6 w-96 shadow-2xl overflow-y-auto"
                style={{
                  maxHeight: Math.max(
                    240,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                    <Icon name="upload_file" className="text-primary" /> Upload Files
                  </h3>
                  <button onClick={() => setShowUploadModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" />
                  </button>
                </div>

                <form onSubmit={handleConfirmUpload}>
                  <div className="mb-4 p-3 bg-surface-container rounded-lg border border-outline-variant">
                    <p className="text-body-sm font-body-sm text-on-surface font-medium">
                      {pendingFiles.length} files selected
                    </p>
                    <p className="text-label-sm text-on-surface-variant truncate mt-1">
                      {pendingFiles.map((f) => f.name).join(", ")}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                      Destination Folder
                    </label>
                    <select
                      className={modalInput}
                      value={uploadFolderId}
                      onChange={(e) => setUploadFolderId(e.target.value)}
                    >
                      <option value="" disabled>
                        Select a folder...
                      </option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                      Add Tags (Optional)
                    </label>
                    <input
                      type="text"
                      className={modalInput}
                      placeholder="scifi, armor, weapon..."
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                    />
                    <p className="text-label-sm text-on-surface-variant mt-1">Separate tags with commas</p>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowUploadModal(false)} className={`${outlinedBtn} flex-1`}>
                      Cancel
                    </button>
                    <button type="submit" disabled={!uploadFolderId} className={`${primaryBtn} flex-1`}>
                      Upload
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Import URL Modal */}
          {showImportModal && (
            <div
              className={`fixed left-0 top-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="bg-surface-container-high border border-outline-variant rounded-xl p-6 w-96 shadow-2xl overflow-y-auto"
                style={{
                  maxHeight: Math.max(
                    240,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                    <Icon name="public" className="text-primary" /> Import from URL
                  </h3>
                  <button onClick={() => setShowImportModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" />
                  </button>
                </div>

                <form onSubmit={handleImportSubmit}>
                  <div className="mb-4">
                    <label className="block text-label-md font-label-md text-on-surface-variant mb-1">Model URL</label>
                    <input
                      autoFocus
                      type="url"
                      required
                      className={modalInput}
                      placeholder="https://www.printables.com/model/..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                    />
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      Paste a link from Printables or similar sites
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                      Destination Folder
                    </label>
                    <select
                      className={modalInput}
                      value={importFolderId}
                      onChange={(e) => setImportFolderId(e.target.value)}
                    >
                      <option value="" disabled>
                        Select a folder...
                      </option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowImportModal(false)} className={`${outlinedBtn} flex-1`}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!importUrl || !importFolderId}
                      className={`${primaryBtn} flex-1`}
                    >
                      Import
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Import Options Modal */}
          {showImportOptionsModal && (
            <div
              className={`fixed left-0 top-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="relative bg-surface-container-high border border-outline-variant rounded-xl p-6 w-full lg:w-1/2 shadow-2xl"
                style={{
                  maxHeight: Math.max(
                    240,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                    <Icon name="public" className="text-primary" /> Select model to download
                  </h3>
                  <button
                    onClick={() => setShowImportOptionsModal(false)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <div
                  className={`overflow-auto px-2 ${visualViewport.height > 900 ? "h-[700px]" : "h-[400px]"}`}
                >
                  {Array.from(folderOptions).map((f) => (
                    <div key={f || "root"}>
                      <div className="text-headline-sm font-headline-sm text-on-surface p-4">
                        {f ? f : "Root Folder"}
                      </div>
                      {modelsOptions.map(
                        (model) =>
                          model.folder == f && (
                            <div
                              key={model.id}
                              onClick={() => handleOptionsToggleSelection(model.id)}
                              className={`group bg-surface-container border rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 mb-2 relative overflow-hidden ${
                                selectedOptions.has(model.id)
                                  ? "border-primary ring-1 ring-primary/50"
                                  : "border-outline-variant hover:border-outline"
                              }`}
                            >
                              <div className="w-12 h-12 bg-primary-container/20 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-all shrink-0">
                                <img
                                  src={model.previewPath}
                                  alt={model.name}
                                  className="w-12 h-12 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                              </div>

                              <div className="min-w-0">
                                <h3 className="font-semibold text-on-surface truncate">{model.name}</h3>
                                <p className="text-label-sm text-on-surface-variant">{model.typeName}</p>
                              </div>
                            </div>
                          ),
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={() => handleImportChoice()} className={`${primaryBtn} w-full mt-4`}>
                  Import
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirmState.isOpen && (
            <div
              className={`fixed left-0 top-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="bg-surface-container-high border border-outline-variant rounded-xl p-6 w-96 shadow-2xl overflow-y-auto"
                style={{
                  maxHeight: Math.max(
                    240,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-12 h-12 bg-error-container/30 rounded-full flex items-center justify-center mb-4">
                    <Icon name="warning" className="text-2xl text-error" />
                  </div>
                  <h3 className="text-headline-sm font-headline-sm text-on-surface mb-2">Confirm Deletion</h3>
                  <p className="text-on-surface-variant text-body-sm">
                    {deleteConfirmState.type === "single" &&
                      "Are you sure you want to delete this model? This action cannot be undone."}
                    {deleteConfirmState.type === "bulk" &&
                      `Are you sure you want to delete ${selectedIds.size} models? This action cannot be undone.`}
                    {deleteConfirmState.type === "folder" && "Are you sure you want to delete this folder?"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))}
                    className={`${outlinedBtn} flex-1`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDelete}
                    className="flex-1 bg-error text-on-error rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {showMoveModal && (
            <div
              className={`fixed left-0 top-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="bg-surface-container-high border border-outline-variant rounded-xl p-6 w-80 shadow-2xl overflow-y-auto"
                style={{
                  maxHeight: Math.max(
                    200,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-on-surface flex items-center gap-2">
                    <Icon name="drive_file_move" className="text-lg" /> Move to Folder
                  </h3>
                  <button onClick={() => setShowMoveModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-lg" />
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleBulkMoveSubmit(folder.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-body-sm transition-colors"
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showTagModal && (
            <div
              className={`fixed left-0 top-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center p-4 ${
                visualViewport.keyboardOpen ? "items-start" : "items-center"
              }`}
              style={modalWrapperStyle()}
            >
              <div
                className="bg-surface-container-high border border-outline-variant rounded-xl p-6 w-96 shadow-2xl overflow-y-auto"
                style={{
                  maxHeight: Math.max(
                    240,
                    (visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0)) - 32,
                  ),
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-on-surface flex items-center gap-2">
                    <Icon name="sell" className="text-lg" /> Add Tags
                  </h3>
                  <button onClick={() => setShowTagModal(false)} className="text-on-surface-variant hover:text-on-surface">
                    <Icon name="close" className="text-lg" />
                  </button>
                </div>
                <form onSubmit={handleBulkTagSubmit}>
                  <p className="text-body-sm text-on-surface-variant mb-2">
                    Add tags to {selectedIds.size} items (comma separated):
                  </p>
                  <input
                    autoFocus
                    type="text"
                    className={`${modalInput} mb-4`}
                    placeholder="scifi, armor, weapon..."
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowTagModal(false)} className="px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface">
                      Cancel
                    </button>
                    <button type="submit" className="px-3 py-1.5 text-body-sm bg-primary-container text-on-primary-container rounded-lg font-bold">
                      Add Tags
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      )}

      {!port && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-error-container text-on-error-container px-4 py-2 rounded-xl shadow-2xl text-body-sm font-body-sm flex items-center gap-2">
          <Icon name="error" /> API Host Not Set
        </div>
      )}
    </div>
  );
};

export default App;
