import React, { useState } from "react";
import Icon from "./Icon";

export type NavView = "library" | "settings";

interface NavbarProps {
  activeView: NavView;
  onNavigateLibrary: () => void;
  onNavigateSettings: () => void;
  onOpenUpload: () => void;
  onFocusSearch: () => void;
  onLogout: () => void;
}

const NAV_LINK_BASE =
  "font-label-md text-label-md px-3 py-1.5 rounded-lg transition-colors";

const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigateLibrary,
  onNavigateSettings,
  onOpenUpload,
  onFocusSearch,
  onLogout,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const linkClass = (view: NavView) =>
    view === activeView
      ? `${NAV_LINK_BASE} text-primary font-bold`
      : `${NAV_LINK_BASE} text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface`;

  const links = (onNavigate?: () => void) => (
    <>
      <a
        className={linkClass("library")}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigateLibrary();
          onNavigate?.();
        }}
      >
        Library
      </a>
      <a
        className={`${NAV_LINK_BASE} text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface`}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onOpenUpload();
          onNavigate?.();
        }}
      >
        Uploads
      </a>
      <a
        className={`${NAV_LINK_BASE} text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface`}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onFocusSearch();
          onNavigate?.();
        }}
      >
        Search
      </a>
      <a
        className={linkClass("settings")}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigateSettings();
          onNavigate?.();
        }}
      >
        Settings
      </a>
    </>
  );

  return (
    <header className="relative flex justify-between items-center h-16 w-full px-margin-mobile sm:px-margin-desktop sticky top-0 z-50 bg-background border-b border-outline-variant shrink-0">
      <div className="flex items-center gap-8 min-w-0">
        <span className="text-headline-md font-headline-md font-bold text-primary tracking-tight shrink-0">
          STLVault
        </span>
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex gap-2">{links()}</nav>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative group hidden sm:block">
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary cursor-pointer p-2 rounded-full transition-colors">
            notifications
          </span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
        </div>
        <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer p-2 rounded-full transition-colors hidden sm:inline-block">
          help
        </span>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
          <Icon name="person" filled className="text-xl" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-on-surface-variant hover:text-error p-2 rounded-full hover:bg-surface-container-highest transition-colors hidden sm:inline-flex"
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="logout" />
        </button>
        <button
          type="button"
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          aria-label="Toggle navigation"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          <Icon name={mobileNavOpen ? "close" : "menu"} />
        </button>
      </div>

      {mobileNavOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden bg-background border-b border-outline-variant flex flex-col p-2 gap-1 shadow-2xl z-50">
          {links(() => setMobileNavOpen(false))}
          <a
            className={`${NAV_LINK_BASE} text-error hover:bg-surface-container-highest`}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onLogout();
              setMobileNavOpen(false);
            }}
          >
            Log out
          </a>
        </div>
      )}
    </header>
  );
};

export default Navbar;
