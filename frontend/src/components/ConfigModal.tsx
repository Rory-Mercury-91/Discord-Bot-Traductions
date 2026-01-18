// Déclaration globale pour éviter l'erreur TS sur window.__TAURI__
declare global {
  interface Window {
    __TAURI__?: any;
  }
}
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '../hooks/useConfirm';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { useApp } from '../state/appContext';
import ConfirmModal from './ConfirmModal';
import { useToast } from './ToastProvider';

// ✅ NOUVEAU : Type pour l'état de la fenêtre
type WindowState = 'normal' | 'maximized' | 'fullscreen' | 'minimized';

export default function ConfigModal({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const {
    templates,
    savedTags,
    savedInstructions,
    savedTraductors,
    allVarsConfig,
    publishedPosts,
    importFullConfig
  } = useApp();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('apiUrl') || localStorage.getItem('apiBase') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '');

  // ✅ NOUVEAU : État de la fenêtre
  const [windowState, setWindowState] = useState<WindowState>(() => {
    const saved = localStorage.getItem('windowState') as WindowState;
    return saved || 'maximized';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();

  const applyWindowStateLive = async (next: WindowState) => {
    try {
      // Uniquement en contexte Tauri
      if (!window.__TAURI__) return;

      let win: any = null;

      // Tauri v2 (WebviewWindow)
      try {
        const wv: any = await import('@tauri-apps/api/webviewWindow');
        if (typeof wv.getCurrentWebviewWindow === 'function') win = wv.getCurrentWebviewWindow();
        else if (wv.appWindow) win = wv.appWindow;
      } catch {}

      // Tauri v1 (Window/appWindow)
      if (!win) {
        try {
          const w: any = await import('@tauri-apps/api/window');
          if (typeof w.getCurrentWindow === 'function') win = w.getCurrentWindow();
          else if (w.appWindow) win = w.appWindow;
        } catch {}
      }

      if (!win) return;

      // Sortir du fullscreen si la cible n'est pas fullscreen
      if (next !== 'fullscreen' && typeof win.setFullscreen === 'function') {
        const isFs = typeof win.isFullscreen === 'function' ? await win.isFullscreen() : false;
        if (isFs) await win.setFullscreen(false);
      }

      // Sortir du minimized si besoin
      if (next !== 'minimized') {
        if (typeof win.isMinimized === 'function') {
          const isMin = await win.isMinimized();
          if (isMin && typeof win.unminimize === 'function') await win.unminimize();
        } else if (typeof win.unminimize === 'function') {
          await win.unminimize();
        }
      }

      switch (next) {
        case 'fullscreen':
          // éviter les conflits fullscreen/maximize
          if (typeof win.isMaximized === 'function' && typeof win.unmaximize === 'function') {
            const isMax = await win.isMaximized();
            if (isMax) await win.unmaximize();
          } else if (typeof win.unmaximize === 'function') {
            await win.unmaximize();
          }
          if (typeof win.setFullscreen === 'function') await win.setFullscreen(true);
          break;
        case 'maximized':
          if (typeof win.maximize === 'function') await win.maximize();
          break;
        case 'normal':
          if (typeof win.unmaximize === 'function') await win.unmaximize();
          break;
        case 'minimized':
          if (typeof win.minimize === 'function') await win.minimize();
          break;
      }
    } catch (e) {
      console.error('Erreur application état fenêtre:', e);
    }
  };

  const handleSave = async () => {
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('apiBase', apiUrl);
    localStorage.setItem('apiKey', apiKey);

    // ✅ NOUVEAU : Sauvegarder l'état de fenêtre via Tauri
    try {
      // @ts-ignore - Tauri API
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        await invoke('save_window_state', { state: windowState });
        showToast("Configuration enregistrée !", "success");
      } else {
        // Fallback pour développement web
        localStorage.setItem('windowState', windowState);
        showToast("Configuration enregistrée !", "success");
      }
    } catch (e) {
      console.error('Erreur sauvegarde état fenêtre:', e);
      showToast("Configuration enregistrée (erreur état fenêtre)", "warning");
    }
  };

  const handleExportConfig = () => {
    try {
      const fullConfig = {
        apiUrl,
        apiBase: apiUrl,
        apiKey,
        templates,
        allVarsConfig,
        savedTags,
        savedInstructions,
        savedTraductors,
        publishedPosts,
        windowState, // ✅ Inclure l'état de fenêtre dans l'export
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_discord_generator_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("Sauvegarde complète téléchargée", "success");
    } catch (err: any) {
      console.error(err?.message || "Erreur export");
      showToast("Erreur lors de l'export", "error");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const ok = await confirm({
      title: '⚠️ Importer une sauvegarde',
      message:
        "Importer une sauvegarde va écraser tes données actuelles (templates, variables, tags, instructions, traducteurs, historique). Continuer ?",
      confirmText: 'Importer',
      cancelText: 'Annuler',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      importFullConfig(data);

      setApiUrl(localStorage.getItem('apiUrl') || localStorage.getItem('apiBase') || '');
      setApiKey(localStorage.getItem('apiKey') || '');

      // ✅ Restaurer l'état de fenêtre si présent
      if (data.windowState) {
        setWindowState(data.windowState);
        localStorage.setItem('windowState', data.windowState);
        void applyWindowStateLive(data.windowState);
      }

      showToast('Sauvegarde importée avec succès !', 'success');
    } catch (err: any) {
      console.error(err?.message || err);
      showToast("Erreur lors de l'import (fichier invalide ?)", 'error');
    }
  };

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          borderRadius: '12px',
          width: '90%',
          // ✅ Même gabarit que InstructionsManagerModal
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="modal-header" style={{
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>⚙️ Configuration</h2>
          <button
            className="close-button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', display: 'grid', gap: 16 }}>
          {/* Section API */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 12,
              background: 'rgba(255,255,255,0.02)',
              display: 'grid',
              gap: 12
            }}
          >
            <h4 style={{ margin: 0 }}>🌐 Configuration API</h4>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                URL de l'API Koyeb
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://votre-app.koyeb.app"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                💡 URL de base de votre service Koyeb (sans /api)
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                Clé API
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Votre clé secrète"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                🔒 Clé de sécurité pour l'accès à l'API
              </div>
            </div>
          </div>

          {/* ✅ NOUVELLE SECTION : État de la fenêtre */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 12,
              background: 'rgba(255,255,255,0.02)',
              display: 'grid',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <h4 style={{ margin: 0 }}>🪟 État de la fenêtre au démarrage</h4>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{windowState}</div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              {(['normal', 'maximized', 'fullscreen', 'minimized'] as WindowState[]).map((state) => {
                const labels = {
                  normal: '📐 Normal',
                  maximized: '⬜ Maximisé',
                  fullscreen: '🖥️ Plein écran',
                  minimized: '➖ Minimisé'
                };

                const active = windowState === state;

                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => { setWindowState(state); void applyWindowStateLive(state); }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'var(--muted)',
                      fontSize: 12,
                      fontWeight: active ? 700 : 600,
                      transition: 'all 0.15s'
                    }}
                  >
                    {labels[state]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={onClose}>🚪 Fermer</button>
              <button onClick={handleSave}>💾 Enregistrer</button>
            </div>
          </div>

          {/* Section Sauvegarde */}
          <div style={{
            padding: '16px',
            background: 'rgba(74, 158, 255, 0.1)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            borderRadius: 12
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '0.95rem',
              color: 'var(--text)'
            }}>
              💾 Sauvegarde complète
            </h4>
            <p style={{
              fontSize: '13px',
              color: 'var(--muted)',
              margin: '0 0 12px 0',
              lineHeight: '1.5'
            }}>
              Exporter toutes les données de l'application dans un fichier JSON :
            </p>
            <ul style={{
              fontSize: '12px',
              color: 'var(--muted)',
              margin: '0 0 16px 0',
              paddingLeft: '20px',
              lineHeight: '1.6'
            }}>
              <li>Configuration API</li>
              <li>Templates (par défaut modifiés + personnalisés)</li>
              <li>Variables personnalisées</li>
              <li>Tags sauvegardés</li>
              <li>Traducteurs sauvegardés</li>
              <li>Instructions sauvegardées</li>
              <li>Historique complet des publications</li>
              <li>État de fenêtre préféré</li>
            </ul>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              marginBottom: '12px',
              borderLeft: '3px solid #4a9eff'
            }}>
              <span style={{ fontSize: '14px' }}>ℹ️</span>
              <p style={{
                fontSize: '11px',
                color: 'var(--muted)',
                margin: 0,
                fontStyle: 'italic'
              }}>
                Le fichier sera enregistré automatiquement dans votre dossier <strong>"Téléchargements"</strong>.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />

            <button
              onClick={handleImportClick}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(74, 255, 158, 0.12)',
                border: '1px solid rgba(74, 255, 158, 0.25)',
                color: 'var(--text)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '10px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(74, 255, 158, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(74, 255, 158, 0.12)';
              }}
            >
              📥 Importer une sauvegarde
            </button>

            <button
              onClick={handleExportConfig}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(74, 158, 255, 0.2)',
                border: '1px solid rgba(74, 158, 255, 0.4)',
                color: '#4a9eff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(74, 158, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(74, 158, 255, 0.2)';
              }}
            >
              📤 Télécharger la sauvegarde complète
            </button>
          </div>
        </div>
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          type={confirmState.type}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
