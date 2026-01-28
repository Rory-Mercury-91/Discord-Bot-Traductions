import { useState } from 'react';
import { useConfirm } from '../hooks/useConfirm';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { useApp } from '../state/appContext';
import ConfirmModal from './ConfirmModal';
import { useToast } from './ToastProvider';

export default function TagsModal({ onClose }: { onClose?: () => void }) {
  const { savedTags, addSavedTag, deleteSavedTag, templates } = useApp();
  const { showToast } = useToast();

  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const [activeTab, setActiveTab] = useState<'my' | 'partner'>('partner');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', id: '', isTranslator: false });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [searchGeneric, setSearchGeneric] = useState('');
  const [searchTranslator, setSearchTranslator] = useState('');

  // Filtrer les tags selon l'onglet actif
  const currentTemplate = activeTab === 'my' ? 'my' : 'partner';
  const filteredTags = savedTags.filter(t => t.template === currentTemplate);

  // Fonction pour retirer les emojis au début d'un texte
  const removeLeadingEmojis = (text: string): string => {
    return text.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\s]+/gu, '').trim();
  };

  // Séparer les tags génériques et traducteurs
  const genericTags = filteredTags.filter(t => !t.isTranslator);
  const translatorTags = filteredTags.filter(t => t.isTranslator);

  // Filtrer avec recherche (en ignorant les emojis)
  const filterBySearch = (tags: typeof savedTags, searchTerm: string) => {
    if (!searchTerm.trim()) return tags;
    const searchLower = searchTerm.toLowerCase();
    return tags.filter(t => {
      const nameWithoutEmoji = removeLeadingEmojis(t.name).toLowerCase();
      const nameWithEmoji = t.name.toLowerCase();
      return nameWithoutEmoji.includes(searchLower) || nameWithEmoji.includes(searchLower);
    });
  };

  const filteredGenericTags = filterBySearch(genericTags, searchGeneric);
  const filteredTranslatorTags = filterBySearch(translatorTags, searchTranslator);

  // Grouper et trier
  const groupTags = (tags: typeof savedTags) => {
    const grouped = tags.reduce((acc, tag, originalIdx) => {
      const templateName = templates.find(tp => tp.id === tag.template)?.name || tag.template || 'Sans salon';
      if (!acc[templateName]) {
        acc[templateName] = [];
      }
      acc[templateName].push({ ...tag, originalIdx: savedTags.indexOf(tag) });
      return acc;
    }, {} as Record<string, Array<typeof savedTags[0] & { originalIdx: number }>>);

    // Trier A-Z sans emojis
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const nameA = removeLeadingEmojis(a.name);
        const nameB = removeLeadingEmojis(b.name);
        return nameA.localeCompare(nameB);
      });
    });

    return grouped;
  };

  const groupedGenericTags = groupTags(filteredGenericTags);
  const groupedTranslatorTags = groupTags(filteredTranslatorTags);

  function openAddModal() {
    setForm({ name: '', id: '', isTranslator: false });
    setEditingIdx(null);
    setShowAddModal(true);
  }

  function startEdit(originalIdx: number) {
    const t = savedTags[originalIdx];
    setForm({
      name: t.name,
      id: t.id || '',
      isTranslator: t.isTranslator || false
    });
    setEditingIdx(originalIdx);
    setShowAddModal(true);
  }

  function closeAddModal() {
    setForm({ name: '', id: '', isTranslator: false });
    setEditingIdx(null);
    setShowAddModal(false);
  }

  function saveTag() {
    if (!form.name.trim() || !form.id.trim()) {
      showToast('Le nom et l\'ID Discord sont requis', 'warning');
      return;
    }

    const existingIdx = savedTags.findIndex((t, i) => t.id === form.id && i !== editingIdx);
    if (existingIdx !== -1) {
      showToast('Un tag avec cet ID existe déjà', 'warning');
      return;
    }

    const tag = {
      name: form.name,
      id: form.id,
      template: currentTemplate,
      isTranslator: form.isTranslator
    };

    if (editingIdx !== null) {
      const newTags = [...savedTags];
      newTags[editingIdx] = tag;
      deleteSavedTag(editingIdx);
      addSavedTag(tag);
      showToast('Tag modifié', 'success');
    } else {
      addSavedTag(tag);
      showToast('Tag ajouté', 'success');
    }

    closeAddModal();
  }

  async function handleDelete(idx: number) {
    const ok = await confirm({
      title: 'Supprimer le tag',
      message: 'Voulez-vous vraiment supprimer ce tag ?',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    if (!ok) return;
    deleteSavedTag(idx);
    showToast('Tag supprimé', 'success');
  }

  const renderTagGrid = (groupedTags: ReturnType<typeof groupTags>) => {
    if (Object.keys(groupedTags).length === 0) {
      return (
        <div style={{
          color: 'var(--muted)',
          fontStyle: 'italic',
          padding: 24,
          textAlign: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 8
        }}>
          Aucun tag trouvé
        </div>
      );
    }

    return Object.entries(groupedTags).map(([templateName, tags]) => (
      <div key={templateName} style={{ marginBottom: 24 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 8
        }}>
          {tags.map((t) => (
            <div key={t.originalIdx} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              background: 'transparent',
              transition: 'background 0.2s'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(t.id || t.name);
                      setCopiedIdx(t.originalIdx);
                      setTimeout(() => setCopiedIdx(null), 2000);
                      showToast('ID du tag copié', 'success', 2000);
                    } catch (e) {
                      showToast('Erreur lors de la copie', 'error');
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    color: copiedIdx === t.originalIdx ? '#4ade80' : '#4a9eff',
                    transition: 'color 0.3s',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Cliquer pour copier l'ID: ${t.id}`}
                >
                  {t.name} {copiedIdx === t.originalIdx && <span style={{ fontSize: 11 }}>✓</span>}
                </strong>
                <div style={{
                  color: 'var(--muted)',
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  ID: {t.id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                <button
                  onClick={() => startEdit(t.originalIdx)}
                  title="Éditer"
                  style={{ padding: '4px 8px', fontSize: 14 }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(t.originalIdx)}
                  title="Supprimer"
                  style={{ padding: '4px 8px', fontSize: 14 }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <>
      <div className="modal">
        <div className="panel" onClick={e => e.stopPropagation()} style={{
          maxWidth: 1000,
          width: '95%',
          height: '80vh',  // Changé de 70vh à 80vh
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* HEADER : Titre + Navigation */}
          <div style={{
            borderBottom: '2px solid var(--border)',
            paddingBottom: 0
          }}>
            <h3 style={{ marginBottom: 12 }}>🏷️ Gestion des tags</h3>

            {/* Onglets avec compteurs */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActiveTab('partner')}
                style={{
                  background: activeTab === 'partner' ? 'var(--panel)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'partner' ? '2px solid #4a9eff' : '2px solid transparent',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'partner' ? 'bold' : 'normal',
                  color: activeTab === 'partner' ? '#4a9eff' : 'var(--text)',
                  marginBottom: '-2px'
                }}
              >
                📚 Mes traductions ({savedTags.filter(t => t.template === 'partner').length})
              </button>
              <button
                onClick={() => setActiveTab('my')}
                style={{
                  background: activeTab === 'my' ? 'var(--panel)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'my' ? '2px solid #4a9eff' : '2px solid transparent',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'my' ? 'bold' : 'normal',
                  color: activeTab === 'my' ? '#4a9eff' : 'var(--text)',
                  marginBottom: '-2px'
                }}
              >
                🌟 Traductions Rory ({savedTags.filter(t => t.template === 'my').length})
              </button>
            </div>
          </div>

          {/* CONTENU SCROLLABLE */}
          <div style={{
            flex: 1,
            padding: '16px',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {/* SECTION TAGS GÉNÉRIQUES */}
            <div style={{
              flex: 1,
              minHeight: activeTab === 'partner' ? '251px' : '528px', // 3 lignes × (80px carte + 8px gap) = 264px
              maxHeight: activeTab === 'partner' ? '251px' : '528px', // Force exactement 3 lignes
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                gap: 16
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: 16,
                  color: 'var(--text)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  🏷️ Tags génériques
                </h4>
                <input
                  type="text"
                  placeholder="🔍 Rechercher..."
                  value={searchGeneric}
                  onChange={e => setSearchGeneric(e.target.value)}
                  style={{
                    width: '250px',
                    padding: '6px 12px',
                    fontSize: 13
                  }}
                />
              </div>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: 8
              }} className="styled-scrollbar">
                {renderTagGrid(groupedGenericTags)}
              </div>
            </div>


            {/* LIGNE SÉPARATRICE - Visible uniquement pour "Mes traductions" */}
            {activeTab === 'partner' && (
              <div style={{
                height: 2,
                background: 'linear-gradient(to right, transparent, var(--border), transparent)',
                margin: '8px 0'
              }} />
            )}

            {/* SECTION TAGS TRADUCTEURS - Visible uniquement pour "Mes traductions" */}
            {activeTab === 'partner' && (
              <div style={{
                flex: 1,
                minHeight: activeTab === 'partner' ? '251px' : '528px', // 3 lignes × (80px carte + 8px gap) = 264px
                maxHeight: activeTab === 'partner' ? '251px' : '528px', // Force exactement 3 lignes
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  gap: 16
                }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: 16,
                    color: 'var(--text)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    👤 Traducteurs
                  </h4>
                  <input
                    type="text"
                    placeholder="🔍 Rechercher..."
                    value={searchTranslator}
                    onChange={e => setSearchTranslator(e.target.value)}
                    style={{
                      width: '250px',
                      padding: '6px 12px',
                      fontSize: 13
                    }}
                  />
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  minHeight: 0,
                  paddingRight: 8
                }} className="styled-scrollbar">
                  {renderTagGrid(groupedTranslatorTags)}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER : Boutons */}
          <div style={{
            borderTop: '2px solid var(--border)',
            paddingTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8
          }}>
            <button onClick={openAddModal} style={{ background: '#4a9eff', color: 'white' }}>
              ➕ Ajouter un tag
            </button>
            <button onClick={onClose}>🚪 Fermer</button>
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

      {/* Modale d'ajout/édition */}
      {showAddModal && (
        <div className="modal" style={{ zIndex: 1001 }}>
          <div className="panel" onClick={e => e.stopPropagation()} style={{
            maxWidth: 500,
            width: '90%'
          }}>
            <h3>{editingIdx !== null ? '✏️ Modifier le tag' : '➕ Ajouter un tag'}</h3>

            <div style={{
              background: 'rgba(74, 158, 255, 0.1)',
              border: '1px solid rgba(74, 158, 255, 0.3)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 13
            }}>
              <strong>
                {activeTab === 'partner' ? '📚 Mes traductions' : '🌟 Traductions Rory'}
              </strong>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Le tag sera automatiquement associé à ce salon
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                  Nom du tag *
                </label>
                <input
                  placeholder="ex: Traduction FR"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                  ID Discord *
                </label>
                <input
                  placeholder="ex: 1234567890"
                  value={form.id}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Checkbox Traducteur - Visible uniquement pour "Mes traductions" */}
              {activeTab === 'partner' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(74, 158, 255, 0.05)',
                  borderRadius: 6,
                  border: '1px solid rgba(74, 158, 255, 0.2)'
                }}>
                  <input
                    type="checkbox"
                    id="isTranslator"
                    checked={form.isTranslator}
                    onChange={e => setForm({ ...form, isTranslator: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="isTranslator"
                    style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                  >
                    👤 Traducteur
                  </label>
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                L'ID Discord du tag est lié au salon Forum spécifique
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={closeAddModal}>Annuler</button>
              <button onClick={saveTag} style={{ background: '#4a9eff', color: 'white' }}>
                {editingIdx !== null ? '✅ Enregistrer' : '➕ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
