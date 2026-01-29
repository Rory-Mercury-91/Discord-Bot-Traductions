import { useEffect, useMemo, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { useApp } from '../state/appContext';

interface TagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tagId: string) => void;
  selectedTagIds: string[];
  position?: { top: number; left: number; width: number };
}

export default function TagSelectorModal({
  isOpen,
  onClose,
  onSelectTag,
  selectedTagIds,
  position
}: TagSelectorModalProps) {
  const { savedTags } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  useEscapeKey(() => {
    if (isOpen) {
      onClose();
      setSearchQuery('');
    }
  }, isOpen);
  useModalScrollLock(isOpen);

  // Réinitialiser la recherche quand la modale se ferme
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Fonction pour retirer les emojis au début d'un texte
  const removeLeadingEmojis = (text: string): string => {
    return text.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\s]+/gu, '').trim();
  };

  // Séparer les tags génériques et traducteurs
  const genericTags = savedTags.filter(t => !t.isTranslator);
  const translatorTags = savedTags.filter(t => t.isTranslator);

  // Filtrer les tags disponibles (non sélectionnés)
  const availableGenericTags = useMemo(() => {
    return genericTags.filter(t => {
      const tagId = t.id || t.name;
      return !selectedTagIds.includes(tagId);
    });
  }, [genericTags, selectedTagIds]);

  const availableTranslatorTags = useMemo(() => {
    return translatorTags.filter(t => {
      const tagId = t.id || t.name;
      return !selectedTagIds.includes(tagId);
    });
  }, [translatorTags, selectedTagIds]);

  // Filtrer avec recherche
  const filterTags = (tags: typeof savedTags) => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter(t => {
      const nameWithoutEmoji = removeLeadingEmojis(t.name).toLowerCase();
      const nameWithEmoji = t.name.toLowerCase();
      const id = (t.id || '').toLowerCase();
      return nameWithoutEmoji.includes(query) || nameWithEmoji.includes(query) || id.includes(query);
    });
  };

  const filteredGenericTags = filterTags(availableGenericTags);
  const filteredTranslatorTags = filterTags(availableTranslatorTags);

  // Trier les tags par nom (sans emojis)
  const sortTags = (tags: typeof savedTags) => {
    return [...tags].sort((a, b) => {
      const nameA = removeLeadingEmojis(a.name);
      const nameB = removeLeadingEmojis(b.name);
      return nameA.localeCompare(nameB);
    });
  };

  const sortedGenericTags = sortTags(filteredGenericTags);
  const sortedTranslatorTags = sortTags(filteredTranslatorTags);

  if (!isOpen) return null;

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: position?.top ? `${position.top}px` : '50%',
    left: position?.left ? `${position.left}px` : '50%',
    width: position?.width ? `${position.width}px` : '500px',
    maxWidth: '90vw',
    maxHeight: '70vh',
    transform: position ? 'none' : 'translate(-50%, -50%)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    overflow: 'hidden'
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1999
        }}
      />

      {/* Modal */}
      <div className="panel" onClick={e => e.stopPropagation()} style={modalStyle}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>🏷️ Sélectionner un tag</h3>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 24,
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: 1
          }}>
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <input
            type="text"
            placeholder="🔍 Rechercher un tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontSize: 14
            }}
          />
        </div>

        {/* Content - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          minHeight: 0
        }} className="styled-scrollbar">
          {/* Tags génériques */}
          {sortedGenericTags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                🏷️ Tags génériques ({sortedGenericTags.length})
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8
              }}>
                {sortedGenericTags.map((tag) => {
                  const tagId = tag.id || tag.name;
                  return (
                    <div
                      key={tagId}
                      onClick={() => {
                        onSelectTag(tagId);
                        // Ne pas fermer la modale automatiquement - l'utilisateur peut ajouter plusieurs tags
                      }}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        hover: {
                          background: 'rgba(74, 158, 255, 0.1)',
                          borderColor: '#4a9eff'
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(74, 158, 255, 0.1)';
                        e.currentTarget.style.borderColor = '#4a9eff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--text)',
                        marginBottom: 4
                      }}>
                        {tag.name}
                      </div>
                      {tag.id && (
                        <div style={{
                          fontSize: 11,
                          color: 'var(--muted)',
                          fontFamily: 'monospace'
                        }}>
                          ID: {tag.id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags traducteurs */}
          {sortedTranslatorTags.length > 0 && (
            <div>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                👤 Tags traducteurs ({sortedTranslatorTags.length})
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8
              }}>
                {sortedTranslatorTags.map((tag) => {
                  const tagId = tag.id || tag.name;
                  return (
                    <div
                      key={tagId}
                      onClick={() => {
                        onSelectTag(tagId);
                        // Ne pas fermer la modale automatiquement - l'utilisateur peut ajouter plusieurs tags
                      }}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(74, 158, 255, 0.1)';
                        e.currentTarget.style.borderColor = '#4a9eff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--text)',
                        marginBottom: 4
                      }}>
                        {tag.name}
                      </div>
                      {tag.id && (
                        <div style={{
                          fontSize: 11,
                          color: 'var(--muted)',
                          fontFamily: 'monospace'
                        }}>
                          ID: {tag.id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message si aucun tag disponible */}
          {sortedGenericTags.length === 0 && sortedTranslatorTags.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--muted)',
              fontStyle: 'italic'
            }}>
              {searchQuery.trim() ? (
                <>Aucun tag ne correspond à votre recherche</>
              ) : (
                <>Tous les tags ont été ajoutés</>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button onClick={onClose} style={{ padding: '8px 16px' }}>
            🚪 Fermer
          </button>
        </div>
      </div>
    </>
  );
}
