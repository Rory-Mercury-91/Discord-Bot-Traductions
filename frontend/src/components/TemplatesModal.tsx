import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../hooks/useConfirm';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { useApp } from '../state/appContext';
import ConfirmModal from './ConfirmModal';
import MarkdownHelpModal from './MarkdownHelpModal';
import { useToast } from './ToastProvider';

export default function TemplatesModal({ onClose }: { onClose?: () => void }) {
  const { templates, updateTemplate, restoreDefaultTemplates, allVarsConfig, addVarConfig, updateVarConfig, deleteVarConfig } = useApp();
  const { showToast } = useToast();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();

  // Toujours éditer le template unique (index 0)
  const editingIdx = 0;
  const [form, setForm] = useState({ name: '', content: '' });
  const [isDraft, setIsDraft] = useState(false);
  const [draftCreatedAt, setDraftCreatedAt] = useState<number | null>(null);
  const [draftModifiedAt, setDraftModifiedAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showVarsSection, setShowVarsSection] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [editingVarIdx, setEditingVarIdx] = useState<number | null>(null);
  const [varForm, setVarForm] = useState({ name: '', label: '', type: 'text' as 'text' | 'textarea' | 'select' });
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Charger automatiquement le template unique au chargement
  useEffect(() => {
    if (templates.length > 0) {
      const t = templates[0];
      setForm({ name: t.name, content: t.content });
      setIsDraft(false);
      setDraftCreatedAt(t.createdAt || null);
      setDraftModifiedAt(t.modifiedAt || null);
      setLastSavedAt(t.lastSavedAt || null);
      setHasUnsavedChanges(false);
    }
  }, []);

  // Restauration automatique du brouillon au chargement
  useEffect(() => {
    try {
      const saved = localStorage.getItem('template_draft');
      if (saved) {
        const draft = JSON.parse(saved);
        (async () => {
          const restore = await confirm({
            title: 'Brouillon trouvé',
            message: 'Un brouillon non enregistré a été trouvé. Voulez-vous le restaurer ?',
            confirmText: 'Restaurer',
            cancelText: 'Supprimer'
          });
          if (restore) {
            setForm({ name: draft.name, content: draft.content });
            setIsDraft(true);
            setDraftCreatedAt(draft.createdAt);
            setDraftModifiedAt(draft.modifiedAt);
            setLastSavedAt(draft.lastSavedAt);
            showToast('Brouillon restauré', 'info');
          } else {
            localStorage.removeItem('template_draft');
          }
        })();
      }
    } catch (e) {
      console.error('Erreur lors de la restauration du brouillon:', e);
      showToast('Erreur lors de la restauration du brouillon', 'error');
    }
  }, []);

  useEffect(() => {
    if (form.name.trim() || form.content.trim()) {
      setIsDraft(true);
      setHasUnsavedChanges(true);
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setInterval(() => {
        saveDraft();
      }, 30000);
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
      }
    };
  }, [form.name, form.content]);

  useEffect(() => {
    if (form.name.trim() || form.content.trim()) {
      setHasUnsavedChanges(true);
    }
  }, [form.name, form.content]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (form.name.trim()) {
          saveTemplate();
        } else {
          showToast('Le nom du template est requis', 'warning');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form.name, form.content, editingIdx]);

  function cancelEdit() {
    // Recharger le template depuis templates[0]
    if (templates.length > 0) {
      const t = templates[0];
      setForm({ name: t.name, content: t.content });
      setIsDraft(false);
      setDraftCreatedAt(t.createdAt || null);
      setDraftModifiedAt(t.modifiedAt || null);
      setLastSavedAt(t.lastSavedAt || null);
    } else {
      setForm({ name: '', content: '' });
      setIsDraft(false);
      setDraftCreatedAt(null);
      setDraftModifiedAt(null);
      setLastSavedAt(null);
    }
    setHasUnsavedChanges(false);
    setShowVarsSection(false);
    cancelVarEdit();
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function saveDraft() {
    const now = Date.now();
    const draftData = {
      ...form,
      isDraft: true,
      createdAt: draftCreatedAt || now,
      modifiedAt: now,
      lastSavedAt: now,
      id: form.name.toLowerCase().replace(/\s+/g, '_'),
      type: 'Autres'
    };
    try {
      localStorage.setItem('template_draft', JSON.stringify(draftData));
      setLastSavedAt(now);
      setDraftModifiedAt(now);
      if (!draftCreatedAt) setDraftCreatedAt(now);
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error('Erreur lors de la sauvegarde du brouillon:', e);
      showToast('Erreur lors de la sauvegarde du brouillon', 'error');
    }
  }

  function saveTemplate() {
    if (!form.name.trim()) {
      showToast('Le nom est requis', 'warning');
      return;
    }
    if (templates.length === 0) {
      showToast('Aucun template à modifier', 'error');
      return;
    }
    const now = Date.now();
    const currentTemplate = templates[0];
    const payload = {
      id: currentTemplate.id || 'my',
      name: form.name,
      type: currentTemplate.type || 'my',
      content: form.content,
      isDraft: false,
      createdAt: draftCreatedAt || currentTemplate.createdAt || now,
      modifiedAt: now,
      lastSavedAt: undefined
    };
    updateTemplate(0, payload);
    try {
      localStorage.removeItem('template_draft');
    } catch (e) { }
    cancelEdit();
    showToast('Template modifié', 'success');
  }

  async function copyVarToClipboard(varName: string) {
    const textToCopy = `[${varName}]`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedVar(varName);
      setTimeout(() => setCopiedVar(null), 2000);
      showToast('Variable copiée', 'success', 2000);
    } catch (e) {
      showToast('Erreur lors de la copie', 'error');
    }
  }

  function startVarEdit(idx: number) {
    const v = allVarsConfig[idx];
    setVarForm({
      name: v.name,
      label: v.label,
      type: v.type || 'text'
    });
    setEditingVarIdx(idx);
  }

  function cancelVarEdit() {
    setVarForm({ name: '', label: '', type: 'text' });
    setEditingVarIdx(null);
  }

  function saveVar() {
    if (!varForm.name.trim() || !varForm.label.trim()) {
      showToast('Le nom et le label sont requis', 'warning');
      return;
    }
    const existingIdx = allVarsConfig.findIndex((v, i) => v.name === varForm.name && i !== editingVarIdx);
    if (existingIdx !== -1) {
      showToast('Une variable avec ce nom existe déjà', 'warning');
      return;
    }
    const varConfig = {
      name: varForm.name,
      label: varForm.label,
      type: varForm.type,
      templates: undefined, // Plus de filtrage par template - disponible pour tous
      isCustom: true
    };
    if (editingVarIdx !== null) {
      updateVarConfig(editingVarIdx, varConfig);
    } else {
      addVarConfig(varConfig);
    }
    cancelVarEdit();
    showToast(editingVarIdx !== null ? 'Variable modifiée' : 'Variable ajoutée', 'success');
  }

  async function handleDeleteVar(idx: number) {
    const ok = await confirm({
      title: 'Supprimer la variable',
      message: 'Voulez-vous vraiment supprimer cette variable ?',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    if (!ok) return;
    deleteVarConfig(idx);
    if (editingVarIdx === idx) cancelVarEdit();
    showToast('Variable supprimée', 'success');
  }

  // Fonction toggleVarTemplate supprimée - plus de sélection de templates pour les variables

  // Fonctions exportTemplate et importTemplate supprimées - un seul template maintenant

  // Template unique - toutes les variables sont visibles
  const visibleVars = allVarsConfig;
  const customVars = allVarsConfig.map((v, idx) => ({ v, idx })).filter(({ v }) => v.isCustom);

  function formatTimeSince(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} jour${days > 1 ? 's' : ''}`;
  }

  return (
    <div className="modal">
      <div className="panel" onClick={e => e.stopPropagation()} style={{
        maxWidth: 1200,
        width: '95%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '2px solid var(--border)'
        }}>
          <h3 style={{ margin: 0 }}>📄 Gestion des templates & variables</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Restaurer les templates par défaut',
                  message: 'Voulez-vous vraiment restaurer les templates par défaut ? Cela remplacera tous les templates actuels.',
                  confirmText: 'Restaurer',
                  type: 'warning'
                });
                if (ok) {
                  restoreDefaultTemplates();
                  showToast('Templates par défaut restaurés', 'success');
                }
              }}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: 'var(--accent)'
              }}
              title="Restaurer les templates par défaut"
            >
              🔄 Restaurer
            </button>
            {/* Bouton Importer retiré - un seul template maintenant */}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Formulaire d'édition du template unique */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>
                ✏️ Modifier le template
              </h4>

              {/* Badge Brouillon */}
              {isDraft && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: 'rgba(255, 193, 7, 0.15)',
                    color: '#ffc107',
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid rgba(255, 193, 7, 0.3)'
                  }}>
                    📝 Brouillon
                  </span>
                  {lastSavedAt && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Sauvegardé il y a {formatTimeSince(lastSavedAt)}
                    </span>
                  )}
                  <button
                    onClick={saveDraft}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      background: hasUnsavedChanges ? 'var(--info)' : 'rgba(255,255,255,0.1)',
                      opacity: hasUnsavedChanges ? 1 : 0.5
                    }}
                    title="Sauvegarder maintenant"
                    disabled={!hasUnsavedChanges}
                  >
                    💾
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                    Nom du template *
                  </label>
                  <input
                    placeholder="ex: Mon template"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                {/* Type retiré - un seul template maintenant */}
              </div>

              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'var(--muted)',
                  marginBottom: 4
                }}>
                  Contenu *
                  <button
                    type="button"
                    onClick={() => setShowMarkdownHelp(true)}
                    style={{
                      background: 'rgba(74, 158, 255, 0.15)',
                      border: '1px solid rgba(74, 158, 255, 0.3)',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: 0
                    }}
                    title="Aide Markdown"
                  >
                    ?
                  </button>
                </label>
                <textarea
                  ref={contentRef}
                  placeholder="Contenu du template..."
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={10}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    fontSize: 13
                  }}
                  spellCheck={true}
                  lang="fr-FR"
                />
              </div>

              {/* Variables disponibles */}
              {visibleVars.length > 0 && (
                <div style={{
                  padding: 12,
                  backgroundColor: 'rgba(74, 158, 255, 0.08)',
                  border: '1px solid rgba(74, 158, 255, 0.25)',
                  borderRadius: 6
                }}>
                  <div style={{ fontSize: 12, color: '#4a9eff', marginBottom: 8, fontWeight: 600 }}>
                    💡 Variables disponibles (cliquez pour copier)
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    maxHeight: 100,
                    overflowY: 'auto'
                  }}>
                    {visibleVars.map((v, idx) => (
                      <span
                        key={idx}
                        onClick={() => copyVarToClipboard(v.name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          backgroundColor: copiedVar === v.name ? '#4ade80' : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${copiedVar === v.name ? '#4ade80' : '#444'}`,
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          color: copiedVar === v.name ? '#000' : '#fff',
                          fontFamily: 'monospace',
                          fontWeight: 500
                        }}
                        title={`${v.label}`}
                      >
                        {copiedVar === v.name && <span style={{ marginRight: 4 }}>✓</span>}
                        [{v.name}]
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variables personnalisées - Section repliable */}
              {(
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => setShowVarsSection(!showVarsSection)}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: 'none',
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  >
                    <span>🔧 Variables personnalisées ({customVars.length})</span>
                    <span style={{ fontSize: 11 }}>{showVarsSection ? '▼' : '▶'}</span>
                  </button>

                  {showVarsSection && (
                    <div style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      {/* Liste variables custom */}
                      {customVars.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>
                            Variables existantes
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: 6
                          }}>
                            {customVars.map(({ v, idx }) => (
                              <div key={idx} style={{
                                display: 'grid',
                                gridTemplateColumns: editingVarIdx === idx ? '1fr' : '1fr auto auto',
                                gap: 6,
                                alignItems: 'center',
                                padding: 8,
                                background: editingVarIdx === idx ? 'rgba(74, 158, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                                borderRadius: 4,
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                {editingVarIdx === idx ? (
                                  <div style={{ fontSize: 11, color: '#4a9eff', fontWeight: 600 }}>
                                    ✏️ En édition
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <strong style={{ fontSize: 12, fontFamily: 'monospace' }}>[{v.name}]</strong>
                                      <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                                        {v.label}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => startVarEdit(idx)}
                                      style={{ fontSize: 11, padding: '3px 6px' }}
                                      title="Éditer"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteVar(idx)}
                                      style={{ fontSize: 11, padding: '3px 6px' }}
                                      title="Supprimer"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Formulaire variable */}
                      <div style={{
                        borderTop: customVars.length > 0 ? '1px solid var(--border)' : 'none',
                        paddingTop: customVars.length > 0 ? 12 : 0
                      }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600 }}>
                          {editingVarIdx !== null ? '✏️ Modifier la variable' : '➕ Ajouter une variable'}
                        </h5>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                                Nom *
                              </label>
                              <input
                                placeholder="ex: ma_var"
                                value={varForm.name}
                                onChange={e => setVarForm({ ...varForm, name: e.target.value })}
                                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                                Label *
                              </label>
                              <input
                                placeholder="ex: Ma variable"
                                value={varForm.label}
                                onChange={e => setVarForm({ ...varForm, label: e.target.value })}
                                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                                Type
                              </label>
                              <select
                                value={varForm.type}
                                onChange={e => setVarForm({ ...varForm, type: e.target.value as any })}
                                style={{
                                  width: '100%',
                                  fontSize: 12,
                                  padding: '6px 8px',
                                  background: 'var(--panel)',
                                  color: 'var(--text)',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                <option value="text">Texte</option>
                                <option value="textarea">Textarea</option>
                                <option value="select">Select</option>
                              </select>
                            </div>
                          </div>

                          {/* Sélection des templates retirée - un seul template maintenant */}

                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                            {editingVarIdx !== null && (
                              <button onClick={cancelVarEdit} style={{ fontSize: 12, padding: '6px 12px' }}>
                                ❌ Annuler
                              </button>
                            )}
                            <button onClick={saveVar} style={{ fontSize: 12, padding: '6px 12px' }}>
                              {editingVarIdx !== null ? '✅ Enregistrer' : '➕ Ajouter'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 8,
                paddingTop: 12,
                borderTop: '1px solid var(--border)'
              }}>
                <button onClick={cancelEdit} style={{ padding: '8px 16px' }}>
                  ❌ Annuler
                </button>
                <button
                  onClick={saveTemplate}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    fontWeight: 600
                  }}
                >
                  ✅ Enregistrer
                </button>
                <button onClick={onClose} style={{ padding: '8px 16px' }}>
                  🚪 Fermer
                </button>
              </div>
            </div>
          </div>
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

      {showMarkdownHelp && <MarkdownHelpModal onClose={() => setShowMarkdownHelp(false)} />}
    </div>
  );
}
