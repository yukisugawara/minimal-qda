import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listFolders, createFolder, isGoogleDriveConfigured } from '../utils/googleDrive';
import type { DriveFolder } from '../utils/googleDrive';
import {
  signIn,
  signOut,
  getToken,
  getConfig,
  setConfig,
  startAutoSave,
  stopAutoSave,
  isAutoSaveEnabled,
} from '../utils/autoSave';
import type { AutoSaveConfig } from '../utils/autoSave';

interface GoogleDriveSettingsModalProps {
  onClose: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function GoogleDriveSettingsModal({ onClose }: GoogleDriveSettingsModalProps) {
  const { t } = useTranslation();
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Folder picker state
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => {
    return getConfig()?.folderId ?? 'root';
  });
  const [selectedFolderName, setSelectedFolderName] = useState<string>(() => {
    return getConfig()?.folderName ?? 'My Drive';
  });

  // File name
  const [fileName, setFileName] = useState<string>(() => {
    return getConfig()?.fileName ?? 'project.mqda';
  });

  // Auto-save toggle
  const [autoSaveOn, setAutoSaveOn] = useState(() => isAutoSaveEnabled());

  const currentFolderId = breadcrumb[breadcrumb.length - 1].id;

  // Load folders when breadcrumb changes
  const loadFolders = useCallback(async (parentId: string) => {
    const token = getToken();
    if (!token) return;
    setLoadingFolders(true);
    try {
      const result = await listFolders(token.access_token, parentId);
      setFolders(result);
    } catch (err) {
      console.error('Failed to load folders:', err);
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadFolders(currentFolderId);
    }
  }, [loggedIn, currentFolderId, loadFolders]);

  // Handlers
  const handleSignIn = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await signIn();
      setLoggedIn(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLoggedIn(false);
    setAutoSaveOn(false);
    setBreadcrumb([{ id: 'root', name: 'My Drive' }]);
    setFolders([]);
    setSelectedFolderId('root');
    setSelectedFolderName('My Drive');
  };

  const handleFolderOpen = async (folder: DriveFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const handleSelectCurrentFolder = () => {
    const current = breadcrumb[breadcrumb.length - 1];
    setSelectedFolderId(current.id);
    setSelectedFolderName(current.name);
  };

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const tk = getToken();
    if (!tk) return;
    setCreatingFolder(true);
    try {
      const created = await createFolder(tk.access_token, name, currentFolderId);
      setFolders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFolderId(created.id);
      setSelectedFolderName(created.name);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleToggleAutoSave = () => {
    if (autoSaveOn) {
      stopAutoSave();
      setAutoSaveOn(false);
    } else {
      // Validate
      const name = fileName.trim();
      if (!name) return;
      const finalName = name.endsWith('.mqda') ? name : `${name}.mqda`;
      setFileName(finalName);

      const existingConfig = getConfig();
      const cfg: AutoSaveConfig = {
        folderId: selectedFolderId,
        folderName: selectedFolderName,
        fileName: finalName,
        driveFileId: existingConfig?.driveFileId ?? null,
      };
      setConfig(cfg);
      startAutoSave();
      setAutoSaveOn(true);
    }
  };

  const handleSaveSettings = () => {
    if (!autoSaveOn) {
      // Just save settings without starting
      const name = fileName.trim();
      if (!name) return;
      const finalName = name.endsWith('.mqda') ? name : `${name}.mqda`;
      const existingConfig = getConfig();
      const cfg: AutoSaveConfig = {
        folderId: selectedFolderId,
        folderName: selectedFolderName,
        fileName: finalName,
        driveFileId: existingConfig?.driveFileId ?? null,
      };
      setConfig(cfg);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white/90 dark:bg-dpurple-800/90 backdrop-blur-md rounded-2xl shadow-xl p-5 w-[420px] max-w-[90vw] max-h-[80vh] overflow-y-auto animate-scale-in border border-violet-200/50 dark:border-violet-600/30"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <CloudIcon />
          {t('driveSync.title')}
        </h3>

        {!isGoogleDriveConfigured() ? (
          /* ---- Client ID not configured ---- */
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('driveSync.notConfigured')}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dpurple-900/40 rounded-xl px-3 py-2.5 font-mono leading-relaxed">
              <div>1. {t('driveSync.setupStep1')}</div>
              <div>2. {t('driveSync.setupStep2')}</div>
              <div className="mt-1.5 select-all text-violet-500 dark:text-violet-400">
                VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
              </div>
              <div className="mt-1.5">3. {t('driveSync.setupStep3')}</div>
            </div>
          </div>
        ) : !loggedIn ? (
          /* ---- Not logged in ---- */
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('driveSync.description')}
            </p>
            {loginError && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                {loginError}
              </div>
            )}
            <button
              onClick={handleSignIn}
              disabled={loggingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-xl hover:from-violet-600 hover:to-pink-600 disabled:opacity-50 active:scale-95 transition-all shadow-md"
            >
              <GoogleIcon />
              {loggingIn ? t('driveSync.signingIn') : t('driveSync.signIn')}
            </button>
          </div>
        ) : (
          /* ---- Logged in ---- */
          <div className="space-y-4">
            {/* Folder picker */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t('driveSync.folder')}
              </label>

              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2 flex-wrap">
                {breadcrumb.map((item, i) => (
                  <span key={item.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
                    <button
                      onClick={() => handleBreadcrumbClick(i)}
                      className="hover:text-violet-500 dark:hover:text-violet-400 transition-colors truncate max-w-[120px]"
                    >
                      {item.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* Folder list */}
              <div className="border border-violet-200/50 dark:border-violet-600/30 rounded-xl max-h-40 overflow-y-auto bg-white/50 dark:bg-dpurple-900/30">
                {loadingFolders ? (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">
                    {t('driveSync.loading')}
                  </div>
                ) : folders.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">
                    {t('driveSync.noFolders')}
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`flex items-center w-full text-xs transition-colors ${
                        selectedFolderId === folder.id
                          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                      }`}
                    >
                      <button
                        onClick={() => {
                          handleFolderOpen(folder);
                          setSelectedFolderId(folder.id);
                          setSelectedFolderName(folder.name);
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left"
                      >
                        <FolderSmallIcon />
                        <span className="truncate">{folder.name}</span>
                      </button>
                      <button
                        onClick={() => handleFolderOpen(folder)}
                        className="flex-shrink-0 px-2 py-2 text-gray-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                        title={t('driveSync.openFolder')}
                      >
                        <ChevronRightIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* New folder + Select current folder */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setShowNewFolder((v) => !v)}
                  className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  <PlusIcon />
                  {t('driveSync.newFolder')}
                </button>
                <button
                  onClick={handleSelectCurrentFolder}
                  className="text-xs text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  {t('driveSync.useCurrentFolder')}
                </button>
                <span className="text-xs text-gray-400 truncate max-w-[150px]">
                  → {selectedFolderName}
                </span>
              </div>

              {/* New folder input */}
              {showNewFolder && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
                    placeholder={t('driveSync.newFolderPlaceholder')}
                    autoFocus
                    className="flex-1 border border-violet-200 dark:border-violet-600/40 rounded-lg px-2 py-1 text-xs bg-white dark:bg-dpurple-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="px-3 py-1 text-xs font-semibold text-white bg-violet-500 rounded-lg hover:bg-violet-600 disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {creatingFolder ? '...' : t('driveSync.create')}
                  </button>
                </div>
              )}
            </div>

            {/* File name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t('driveSync.fileName')}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="project.mqda"
                className="w-full border border-violet-200 dark:border-violet-600/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-dpurple-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            {/* Auto-save toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('driveSync.autoSave')}
              </span>
              <button
                onClick={handleToggleAutoSave}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  autoSaveOn
                    ? 'bg-violet-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    autoSaveOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-violet-200/30 dark:border-violet-600/20">
              <button
                onClick={handleSignOut}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                {t('driveSync.signOut')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full active:scale-95 transition-all"
                >
                  {t('driveSync.cancel')}
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
                >
                  {t('driveSync.ok')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function CloudIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5H3.5C2.12 12.5 1 11.38 1 10C1 8.62 2.12 7.5 3.5 7.5C3.57 7.5 3.64 7.5 3.71 7.51C4.16 5.49 5.94 4 8 4C10.06 4 11.84 5.49 12.29 7.51C12.36 7.5 12.43 7.5 12.5 7.5C13.88 7.5 15 8.62 15 10C15 11.38 13.88 12.5 12.5 12.5H11.5" />
      <path d="M8 10V15" />
      <path d="M6 12L8 10L10 12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 6.545v3.273h4.582c-.186 1.2-.746 2.218-1.582 2.909l2.564 1.991C15.164 13.2 16 11.273 16 8.727c0-.618-.055-1.218-.164-1.8H8v3.618z" fillOpacity="0.9" />
      <path d="M3.516 9.527A4.848 4.848 0 0 1 3.2 8c0-.536.091-1.055.255-1.536L.891 4.473A8 8 0 0 0 0 8c0 1.291.31 2.51.855 3.591l2.661-2.064z" fillOpacity="0.7" />
      <path d="M8 16c2.164 0 3.982-.718 5.309-1.945l-2.564-1.991c-.718.482-1.636.763-2.745.763a4.8 4.8 0 0 1-4.484-3.3L.891 11.59C2.2 14.182 4.891 16 8 16z" fillOpacity="0.8" />
      <path d="M8 3.2c1.327 0 2.518.455 3.455 1.345l2.545-2.545C12.573.764 10.455 0 8 0 4.891 0 2.2 1.818.891 4.473L3.455 6.4A4.8 4.8 0 0 1 8 3.2z" fillOpacity="0.9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 2V10" />
      <path d="M2 6H10" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2.5L8 6L4.5 9.5" />
    </svg>
  );
}

function FolderSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" />
    </svg>
  );
}
