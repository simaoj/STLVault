import React, { useState } from "react";
import Icon from "./Icon";

type SlicerType = "orcaslicer" | "prusaslicer" | "bambu" | "cura";

interface SlicerConfig {
  name: string;
  protocol: string;
  icon: string;
  description: string;
}

const SLICERS: Record<SlicerType, SlicerConfig> = {
  orcaslicer: {
    name: "OrcaSlicer",
    protocol: "orcaslicer://open?file=",
    icon: "precision_manufacturing",
    description: "Recommended for high-speed prints",
  },
  prusaslicer: {
    name: "PrusaSlicer",
    protocol: "prusaslicer://open?file=",
    icon: "architecture",
    description: "Stable and feature-rich",
  },
  bambu: {
    name: "Bambu Studio",
    protocol: "bambustudioopen://open?path=",
    icon: "rocket_launch",
    description: "Downloads the file (Bambu Studio blocks opening files from external URLs)",
  },
  cura: {
    name: "Ultimaker Cura",
    protocol: "cura://open?file=",
    icon: "layers",
    description: "Broad compatibility",
  },
};

const Settings: React.FC = () => {
  const [apiPortStatus, setApiPortStatus] = useState(false);
  const [selectedSlicer, setSelectedSlicer] = useState<SlicerType>(() => {
    const saved = localStorage.getItem("stlvault-slicer");
    return saved && saved in SLICERS ? (saved as SlicerType) : "orcaslicer";
  });

  const [selectedApiPort, setSelectedApiPort] = useState<string>(() => {
    const envport = import.meta.env.VITE_API_URL;
    const port = localStorage.getItem("api-port-override");
    if (port) setApiPortStatus(true);
    return port ? port : envport;
  });

  const handleSlicerChange = (slicer: SlicerType) => {
    setSelectedSlicer(slicer);
    localStorage.setItem("stlvault-slicer", slicer);
  };

  const handleApiForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiPort) return;
    localStorage.setItem("api-port-override", selectedApiPort);
    setApiPortStatus(true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto p-margin-mobile sm:p-margin-desktop space-y-xl">
        <header>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Settings</h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Manage your slicing preferences and API connection.
          </p>
        </header>

        {/* Default Slicer */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-headline-sm font-headline-sm text-on-surface">Default Slicer</h3>
            <span className="text-label-md font-label-md text-on-surface-variant">
              Choose your primary workflow
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
            {(Object.keys(SLICERS) as SlicerType[]).map((slicer) => {
              const isActive = selectedSlicer === slicer;
              return (
                <button
                  key={slicer}
                  onClick={() => handleSlicerChange(slicer)}
                  className={`relative text-left cursor-pointer border p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 ${
                    isActive
                      ? "border-primary bg-primary-container/10"
                      : "border-outline-variant hover:border-primary/50"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3 text-primary">
                      <Icon name="check_circle" filled />
                    </div>
                  )}
                  <div
                    className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 ${
                      isActive ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    <Icon name={SLICERS[slicer].icon} className="text-3xl" />
                  </div>
                  <h4 className="font-bold text-on-surface mb-1">{SLICERS[slicer].name}</h4>
                  <p className="text-label-sm text-on-surface-variant">{SLICERS[slicer].description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">Note:</span> Your slicer application must be
              installed and configured to handle protocol links (e.g., {SLICERS[selectedSlicer].protocol}). The
              exact setup varies by slicer and operating system.
            </p>
          </div>
        </section>

        {/* API Host Configuration */}
        <section className="space-y-4">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">API Host Configuration</h3>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Override the API host used to reach your STLVault backend.
          </p>
          <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant">
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">Note:</span> The URL set here overrides the one
              from the environment variables.
            </p>
          </div>
          <form onSubmit={handleApiForm} className="max-w-md space-y-2">
            <label className="text-label-md font-label-md text-on-surface-variant">Main Node URL</label>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                required
                className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="http://0.0.0.0:8989"
                value={selectedApiPort}
                onChange={(e) => setSelectedApiPort(e.target.value)}
              />
              <button
                type="submit"
                disabled={!selectedApiPort}
                className="bg-primary hover:bg-primary-container text-on-primary font-bold px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set
              </button>
            </div>
            <p className="text-label-sm text-on-surface-variant">Insert the URL at which the API is served.</p>
            <div className={`flex items-center gap-2 ${apiPortStatus ? "text-primary" : "text-error"}`}>
              <Icon name={apiPortStatus ? "verified" : "error"} className="text-sm" />
              <span className="text-label-sm">{apiPortStatus ? "API host override active" : "Using default API host"}</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Settings;
