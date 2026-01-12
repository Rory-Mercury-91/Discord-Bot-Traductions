import React from 'react';
import { useApp } from '../state/appContext';
import { useToast } from './ToastProvider';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from './ConfirmModal';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';

interface HistoryModalProps {
  onClose?: () => void;
}

export default function HistoryModal({ onClose }: HistoryModalProps) {
  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();
  
  const { publishedPosts, deletePublishedPost, loadPostForEditing, loadPostForDuplication } = useApp();
  const { showToast } = useToast();
  const { confirm, confirmState, closeConfirm } = useConfirm();

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Supprimer de l\'historique',
      message: 'Voulez-vous supprimer cette publication de l\'historique local ? (Le post Discord ne sera pas supprimé)',
      confirmText: 'Supprimer',
      type: 'warning'
    });
    if (!ok) return;
    deletePublishedPost(id);
    showToast('Publication supprimée de l\'historique', 'success');
  }

  function handleEdit(post: any) {
    loadPostForEditing(post);
    showToast('Post chargé en mode édition', 'info');
    if (onClose) onClose();
  }

  function handleDuplicate(post: any) {
    loadPostForDuplication(post);
    showToast('Contenu copié pour création d\'un nouveau post', 'success');
    if (onClose) onClose();
  }

  function handleOpen(url: string) {
    window.open(url, '_blank');
  }

  function formatDate(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getTemplateLabel(type: string) {
    if (type === 'my') return '🇫🇷 Mes traductions';
    if (type === 'partner') return '🤝 Partenaire';
    return '📄 Autre';
  }

  return (
    <div className="modal">
      <div className="panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>📋 Historique des publications</h3>

        {publishedPosts.length === 0 ? (
          <div style={{ 
            color: 'var(--muted)', 
            fontStyle: 'italic', 
            padding: 40, 
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8
          }}>
            Aucune publication dans l'historique.
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Les publications seront automatiquement sauvegardées ici après envoi.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {publishedPosts.map((post) => (
              <div 
                key={post.id} 
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 16,
                  background: 'rgba(255,255,255,0.02)',
                  display: 'grid',
                  gap: 12
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      {post.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{getTemplateLabel(post.template)}</span>
                      <span>•</span>
                      <span>📅 {formatDate(post.timestamp)}</span>
                      {post.tags && (
                        <>
                          <span>•</span>
                          <span>🏷️ {post.tags}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content preview */}
                <div 
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    maxHeight: 60,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.4
                  }}
                >
                  {post.content.substring(0, 200)}
                  {post.content.length > 200 && '...'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleOpen(post.discordUrl)}
                    style={{
                      fontSize: 13,
                      padding: '6px 12px',
                      background: 'var(--info)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                    title="Ouvrir dans Discord"
                  >
                    🔗 Ouvrir
                  </button>
                  <button
                    onClick={() => handleEdit(post)}
                    style={{
                      fontSize: 13,
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                    title="Charger pour modification"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDuplicate(post)}
                    style={{
                      fontSize: 13,
                      padding: '6px 12px',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                    title="Copier le contenu pour créer un nouveau post"
                  >
                    📋 Copier le contenu
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    style={{
                      fontSize: 13,
                      padding: '6px 12px',
                      background: 'transparent',
                      border: '1px solid var(--error)',
                      color: 'var(--error)',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                    title="Supprimer de l'historique local"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
