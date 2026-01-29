import React, { useEffect, useMemo, useRef, useState } from 'react';
import DiscordIcon from '../assets/discord-icon.svg';
import { useConfirm } from '../hooks/useConfirm';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { tauriAPI } from '../lib/tauri-api';
import { useApp } from '../state/appContext';
import ConfirmModal from './ConfirmModal';
import ImageThumbnail from './ImageThumbnail';
import TagSelectorModal from './TagSelectorModal';
import { useToast } from './ToastProvider';
// Si tu n'as pas de composant "Button" personnalisé, on utilisera des balises <button> normales
export default function ContentEditor() {
  // 1️⃣ D'ABORD : Extraire toutes les valeurs du context
  const {
    allVarsConfig,
    inputs,
    setInput,
    preview,
    postTitle,
    setPostTitle,
    postTags,
    setPostTags,
    publishPost,
    publishInProgress,
    lastPublishResult,
    savedTags,
    savedInstructions,
    templates,
    currentTemplateIdx,
    uploadedImages,
    addImageFromUrl,
    removeImage,
    editingPostId,
    setEditingPostId,
    translationType,
    setTranslationType,
    isIntegrated,
    setIsIntegrated,
    setEditingPostData,
    rateLimitCooldown,
    resetAllFields,
    additionalTranslationLinks,
    addAdditionalTranslationLink,
    updateAdditionalTranslationLink,
    deleteAdditionalTranslationLink
  } = useApp();

  const { showToast } = useToast();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { linkConfigs, setLinkConfig, /* autres... */ } = useApp();
  // 2️⃣ ENSUITE : Calculer les valeurs dérivées
  const currentTemplate = templates[currentTemplateIdx]; // ✅ UNE SEULE FOIS
  const canPublish = (currentTemplate?.type === 'my' || currentTemplate?.type === 'partner') &&
    rateLimitCooldown === null;
  const isEditMode = editingPostId !== null;
  const rateLimitRemaining = rateLimitCooldown ? Math.ceil((rateLimitCooldown - Date.now()) / 1000) : 0;

  // 3️⃣ États locaux
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorPosition, setTagSelectorPosition] = useState<{ top: number; left: number; width: number } | undefined>();
  const tagButtonRef = useRef<HTMLButtonElement | null>(null);
  const [instructionSearchQuery, setInstructionSearchQuery] = useState<string>('');
  const [showInstructionSuggestions, setShowInstructionSuggestions] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const overviewRef = useRef<HTMLTextAreaElement | null>(null);

  // 4️⃣ ENFIN : useEffect
  useEffect(() => {
    // Si les valeurs dans le contexte sont vides, on reset les barres de recherche locales
    if (!inputs['instruction']) setInstructionSearchQuery('');
  }, [inputs['instruction']]);

  // On garde celui-ci pour les changements de templates/posts
  useEffect(() => {
    setInstructionSearchQuery('');
    setInput('instruction', '');
  }, [currentTemplateIdx, editingPostId]);

  // Undo/Redo pour le textarea Synopsis
  const { recordState, undo, redo, reset: resetUndoRedo } = useUndoRedo();

  useEffect(() => {
    recordState(inputs['Overview'] || '');
  }, []);

  const handleOverviewKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      const prevState = undo();
      if (prevState !== null) {
        setInput('Overview', prevState);
      }
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      const nextState = redo();
      if (nextState !== null) {
        setInput('Overview', nextState);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      recordState(inputs['Overview'] || '');
    }, 500);
    return () => clearTimeout(timer);
  }, [inputs['Overview']]);

  const currentTemplateId = templates[currentTemplateIdx]?.id || templates[currentTemplateIdx]?.name;

  // Variables déjà affichées en dur dans le formulaire (à exclure de visibleVars)
  const hardcodedVarNames = [
    'Game_name', 'Game_version', 'Game_link', 'Translate_version', 'Translate_link',
    'Overview', 'is_modded_game', 'Mod_link', 'instruction'
  ];

  const visibleVars = useMemo(() => {
    return allVarsConfig.filter(v => {
      // Exclure les variables déjà affichées en dur
      if (hardcodedVarNames.includes(v.name)) return false;

      // Filtrer par template si nécessaire
      if (!v.templates || v.templates.length === 0) return true;
      return v.templates.includes(currentTemplateId);
    });
  }, [allVarsConfig, currentTemplateId]);

  // Calculer les IDs des tags sélectionnés
  const selectedTagIds = useMemo(() => {
    return postTags ? postTags.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [postTags]);

  // Fonction pour ouvrir la modale de sélection des tags
  const handleOpenTagSelector = () => {
    // Trouver l'élément preview pour obtenir sa position exacte
    const previewElement = document.querySelector('[data-preview-container]') as HTMLElement;

    if (previewElement) {
      const previewRect = previewElement.getBoundingClientRect();
      // Positionner la modale juste au-dessus du preview, alignée à gauche du preview
      setTagSelectorPosition({
        top: previewRect.top - 10, // Juste au-dessus du preview
        left: previewRect.left + 16,
        width: Math.min(previewRect.width - 32, 500)
      });
    } else {
      // Fallback : utiliser les valeurs par défaut basées sur le layout
      const previewLeft = window.innerWidth * 0.65;
      const previewWidth = window.innerWidth * 0.35;
      setTagSelectorPosition({
        top: 120,
        left: previewLeft + 16,
        width: Math.min(previewWidth - 32, 500)
      });
    }
    setShowTagSelector(true);
  };

  // Fonction pour sélectionner un tag
  const handleSelectTag = (tagId: string) => {
    const currentTags = postTags ? postTags.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!currentTags.includes(tagId)) {
      setPostTags([...currentTags, tagId].join(','));
    }
  };


  const filteredInstructions = useMemo(() => {
    if (!instructionSearchQuery.trim()) return Object.keys(savedInstructions);
    const query = instructionSearchQuery.toLowerCase();
    return Object.keys(savedInstructions).filter(name => name.toLowerCase().includes(query));
  }, [savedInstructions, instructionSearchQuery]);

  // Composant pour le label avec checkbox et prévisualisation du lien
  function LinkFieldLabelWithCheckbox({
    label,
    linkName,
    linkConfigs,
    checked,
    onCheckboxChange,
    onLinkClick
  }: {
    label: string;
    linkName: 'Game_link' | 'Translate_link' | 'Mod_link';
    linkConfigs: Record<string, { source: string; value: string }>;
    checked: boolean;
    onCheckboxChange: (checked: boolean) => void;
    onLinkClick: (url: string) => Promise<void>;
  }) {
    const config = linkConfigs[linkName];
    const finalUrl = config.source === 'F95'
      ? `https://f95zone.to/threads/${config.value || '...'}/`
      : config.source === 'Lewd'
        ? `https://lewdcorner.com/threads/${config.value || '...'}/`
        : config.value || '...';

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'flex-start', width: '100%', minHeight: 32 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
          {label}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Prévisualisation du lien final */}
          {finalUrl && !finalUrl.includes('...') ? (
            <div
              onClick={() => onLinkClick(finalUrl)}
              style={{
                fontSize: 11,
                color: '#5865F2',
                fontFamily: 'monospace',
                padding: '2px 8px',
                background: 'rgba(88, 101, 242, 0.1)',
                borderRadius: 4,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                display: 'inline-block',
                transition: 'all 0.2s',
                flexShrink: 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(88, 101, 242, 0.2)';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(88, 101, 242, 0.1)';
                e.currentTarget.style.textDecoration = 'none';
              }}
              title="Cliquer pour ouvrir dans le navigateur externe"
            >
              🔗 {finalUrl}
            </div>
          ) : (
            <div style={{
              fontSize: 11,
              color: '#5865F2',
              fontFamily: 'monospace',
              padding: '2px 8px',
              background: 'rgba(88, 101, 242, 0.1)',
              borderRadius: 4,
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1
            }}>
              🔗 {finalUrl}
            </div>
          )}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '3px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onCheckboxChange(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>Masquer le lien</span>
          </label>
        </div>
      </div>
    );
  }

  function LinkField({
    label,
    linkName,
    placeholder,
    disabled = false,
    showLabel = true,
    customLabelContent
  }: {
    label: string;
    linkName: 'Game_link' | 'Translate_link' | 'Mod_link';
    placeholder: string;
    disabled?: boolean;
    showLabel?: boolean;
    customLabelContent?: React.ReactNode;
  }) {
    const config = linkConfigs[linkName];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;

      // Détection automatique du type (F95/Lewd) si une URL complète est collée
      const lowerVal = val.toLowerCase();
      let detectedSource: 'F95' | 'Lewd' | 'Autre' = config.source;

      if (lowerVal.includes('f95zone.to')) {
        detectedSource = 'F95';
      } else if (lowerVal.includes('lewdcorner.com')) {
        detectedSource = 'Lewd';
      }

      // Extraction de l'ID du thread si c'est une URL F95 ou Lewd
      if (detectedSource !== 'Autre') {
        const threadIdMatch = val.match(/threads\/.*\.(\d+)\/?/);
        if (threadIdMatch && threadIdMatch[1]) {
          val = threadIdMatch[1];
        }
      }

      setLinkConfig(linkName, detectedSource, val);
    };

    const finalUrl = config.source === 'F95'
      ? `https://f95zone.to/threads/${config.value || '...'}/`
      : config.source === 'Lewd'
        ? `https://lewdcorner.com/threads/${config.value || '...'}/`
        : config.value || '...';

    return (
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* LIGNE 1 : Label/Custom content et Prévisualisation du lien final */}
        {(showLabel || customLabelContent) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            alignItems: 'flex-start',
            marginBottom: 8,
            minHeight: 32,
            width: '100%'
          }}>
            {customLabelContent ? customLabelContent : (
              <>
                <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                  {label}
                </label>

                {/* Prévisualisation du lien final */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  {finalUrl && !finalUrl.includes('...') ? (
                    <div
                      onClick={async () => {
                        const result = await tauriAPI.openUrl(finalUrl);
                        if (!result.ok) {
                          console.error('Erreur ouverture URL:', result.error);
                        }
                      }}
                      style={{
                        fontSize: 11,
                        color: '#5865F2',
                        fontFamily: 'monospace',
                        padding: '2px 8px',
                        background: 'rgba(88, 101, 242, 0.1)',
                        borderRadius: 4,
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        display: 'inline-block',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(88, 101, 242, 0.2)';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(88, 101, 242, 0.1)';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                      title="Cliquer pour ouvrir dans le navigateur externe"
                    >
                      🔗 {finalUrl}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 11,
                      color: '#5865F2',
                      fontFamily: 'monospace',
                      padding: '2px 8px',
                      background: 'rgba(88, 101, 242, 0.1)',
                      borderRadius: 4,
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      🔗 {finalUrl}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* LIGNE 2 : Les contrôles (Dropdown + Input) */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, alignItems: 'start', width: '100%' }}>
          <select
            value={config.source}
            onChange={(e) => setLinkConfig(linkName, e.target.value as any, config.value)}
            disabled={disabled}
            style={{
              height: '38px',
              borderRadius: 6,
              padding: '0 8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}
          >
            <option value="F95">F95</option>
            <option value="Lewd">Lewd</option>
            <option value="Autre">Autre</option>
          </select>

          <input
            type="text"
            value={config.value}
            onChange={handleInputChange}
            placeholder={config.source === 'Autre' ? placeholder : 'Collez l\'ID ou l\'URL complète'}
            disabled={disabled}
            style={{
              height: '40px',
              borderRadius: 6,
              padding: '0 12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              opacity: disabled ? 0.5 : 1
            }}
          />
        </div>
      </div>
    );
  }

  // Fonction pour importer les données du scraper (F95/LC)
  const handlePasteImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);

      // ✅ Champs simples (inputs)
      if (data.name) setInput('Game_name', data.name);
      if (data.version) setInput('Game_version', data.version);

      // ✅ IMPORTANT : ton UI "Lien du jeu" utilise linkConfigs + setLinkConfig
      const rawLink = typeof data.link === 'string' ? data.link.trim() : '';
      const rawId =
        typeof data.id === 'string' || typeof data.id === 'number'
          ? String(data.id).trim()
          : '';

      const detectSource = (link: string): 'F95' | 'Lewd' | 'Autre' => {
        const l = link.toLowerCase();
        if (l.includes('f95zone.to')) return 'F95';
        if (l.includes('lewdcorner.com')) return 'Lewd';
        return 'Autre';
      };

      const extractThreadId = (link: string): string => {
        // Ex: https://f95zone.to/threads/xxxxx.232384/
        const m = link.match(/threads\/.*\.(\d+)\/?/i);
        return m?.[1] ?? '';
      };

      // Priorité: data.id -> id depuis l'url -> si link = "232384" -> fallback url en "Autre"
      let idToUse = rawId || (rawLink ? extractThreadId(rawLink) : '');
      let sourceToUse: 'F95' | 'Lewd' | 'Autre' = rawLink ? detectSource(rawLink) : 'F95';

      if (!idToUse && rawLink && /^\d+$/.test(rawLink)) {
        idToUse = rawLink;
      }

      if (idToUse) {
        // On met l'ID dans l'input du lien
        if (sourceToUse === 'Autre') sourceToUse = 'F95'; // le scraper vient en général de F95
        setLinkConfig('Game_link', sourceToUse, idToUse);
      } else if (rawLink) {
        // Secours : garder l'URL complète si on n'a pas l'ID
        setLinkConfig('Game_link', 'Autre', rawLink);
      }

      showToast('Données importées !', 'success');
    } catch (err) {
      showToast('Erreur : Presse-papier invalide', 'error');
    }
  };

  // Fonction pour synchroniser les versions
  const syncVersion = () => {
    const gameVer = inputs['Game_version'] || '';
    setInput('Translate_version', gameVer);
  };

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0, overflow: 'auto', boxSizing: 'border-box', width: '100%', maxWidth: '100%' }}>

      {/* Badge mode édition - inchangé */}
      {isEditMode && (
        <div style={{
          background: 'rgba(125, 211, 252, 0.1)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>✏️ Mode édition</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Vous modifiez un post existant sur Discord.</div>
          </div>
          <button
            onClick={() => {
              setEditingPostId(null);
              showToast('Mode édition annulé', 'info');
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            ❌ Annuler
          </button>
        </div>
      )}

      {/* LIGNE 1 : Titre */}
      <h4 style={{ marginBottom: 16 }}>📝 Contenu du post Discord</h4>

      <div style={{ display: 'grid', gap: 16, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

        {/* Layout: Ligne 1 (Titre + Tags) | Ligne 2 (Nom du jeu + Lien image) | Colonne droite (Image sur 2 lignes) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gridTemplateRows: 'auto auto', gap: 12, width: '100%', maxWidth: '100%' }}>

          {/* LIGNE 1 - Col 1 : Titre du post */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Titre du post
            </label>
            <input
              readOnly
              value={postTitle}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 12px',
                background: 'rgba(255,255,255,0.03)',
                cursor: 'default'
              }}
            />
          </div>

          {/* LIGNE 1 - Col 2 : Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Tags
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                ref={tagButtonRef}
                type="button"
                onClick={handleOpenTagSelector}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(74, 158, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#4a9eff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--panel)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                ➕ Ajouter
              </button>

              {/* Tags actifs affichés */}
              {selectedTagIds.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center'
                }}>
                  {selectedTagIds.map((tagId) => {
                    const tag = savedTags.find(t => (t.id || t.name) === tagId);
                    return (
                      <div
                        key={tagId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 14px',
                          borderRadius: 999,
                          background: 'rgba(99, 102, 241, 0.14)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          fontSize: 13,
                          lineHeight: 1.2,
                          fontWeight: 600
                        }}
                      >
                        <span style={{ color: 'var(--text)' }}>{tag?.name || tagId}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newTags = selectedTagIds.filter(t => t !== tagId);
                            setPostTags(newTags.join(','));
                          }}
                          title="Retirer"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1,
                            fontSize: 14,
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LIGNE 1-2 - Col 3 : Miniature de l'image (rowspan 2) - À DROITE */}
          <div style={{ gridColumn: 3, gridRow: '1 / 3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Image
            </label>
            {uploadedImages.length > 0 ? (
              <ImageThumbnail
                imagePath={uploadedImages[0].path || uploadedImages[0].url || ''}
                isMain={true}
                onSetMain={() => { }}
                onCopyName={() => { }}
                onDelete={async () => {
                  const ok = await confirm({ title: 'Supprimer', message: 'Supprimer cette image ?', type: 'danger' });
                  if (ok) removeImage(0);
                }}
                onChange={() => { }}
              />
            ) : (
              <div style={{
                width: '100%',
                minHeight: '120px',
                border: '2px dashed var(--border)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--muted)',
                padding: '12px',
                gap: '8px'
              }}>
                <div style={{ fontSize: 32 }}>🖼️</div>
                <div style={{ fontSize: 11, textAlign: 'center' }}>Aucune image</div>
              </div>
            )}
          </div>

          {/* LIGNE 2 - Col 1 : Nom du jeu */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Nom du jeu
            </label>
            <input
              value={inputs['Game_name'] || ''}
              onChange={e => setInput('Game_name', e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                borderRadius: 6,
                padding: '0 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
              placeholder="Nom du jeu"
            />
          </div>

          {/* LIGNE 2 - Col 2 : Lien de l'image */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Lien de l'image
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const url = imageUrlInput.trim();
                    if (url) {
                      addImageFromUrl(url);
                      setImageUrlInput('');
                    }
                  }
                }}
                placeholder="URL de l'image (https://...)"
                style={{
                  flex: 1,
                  height: '40px',
                  borderRadius: 6,
                  padding: '0 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const url = imageUrlInput.trim();
                  if (url) {
                    addImageFromUrl(url);
                    setImageUrlInput('');
                  }
                }}
                disabled={!imageUrlInput.trim()}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: imageUrlInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: imageUrlInput.trim() ? 1 : 0.5,
                  background: imageUrlInput.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'white'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* LIGNE 4 : Version du jeu et Version de la trad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Version du jeu
            </label>
            <input
              value={inputs['Game_version'] || ''}
              onChange={e => setInput('Game_version', e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                borderRadius: 6,
                padding: '0 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
              placeholder="v1.0.4"
            />
          </div>

          <div style={{ paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={syncVersion}
              title="Copier vers version traduction"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ⇆
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Version de la trad
            </label>
            <input
              value={inputs['Translate_version'] || ''}
              onChange={e => setInput('Translate_version', e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                borderRadius: 6,
                padding: '0 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
              placeholder="v1.0"
            />
          </div>
        </div> {/* FIN LIGNE 5 */}

        {/* LIGNE 6 : Lien du jeu et Lien de la trad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <LinkField
            label="Lien du jeu"
            linkName="Game_link"
            placeholder="https://..."
          />

          <LinkField
            label={isIntegrated ? "Lien de la trad (Fusionné)" : "Lien de la trad"}
            linkName="Translate_link"
            placeholder="https://..."
            disabled={inputs['use_additional_links'] === 'true'}
            customLabelContent={
              <LinkFieldLabelWithCheckbox
                label={isIntegrated ? "Lien de la trad (Fusionné)" : "Lien de la trad"}
                linkName="Translate_link"
                linkConfigs={linkConfigs}
                checked={inputs['use_additional_links'] === 'true'}
                onCheckboxChange={(checked) => setInput('use_additional_links', checked ? 'true' : 'false')}
                onLinkClick={async (url) => {
                  const result = await tauriAPI.openUrl(url);
                  if (!result.ok) {
                    console.error('Erreur ouverture URL:', result.error);
                  }
                }}
              />
            }
          />
        </div>

        {/* LIGNE 6.5 : Header Liens additionnels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
            Liens additionnels (Saisons, Chapitres, Épisodes spéciaux, etc.)
          </label>
          <button
            type="button"
            onClick={addAdditionalTranslationLink}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            ➕ Ajouter un lien additionnel
          </button>
        </div>

        {/* LIGNE 6.6+ : Liens additionnels individuels */}
        {additionalTranslationLinks.map((link, index) => (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 12,
              alignItems: 'end',
              marginBottom: 0
            }}
          >
            <div>
              {index === 0 && (
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                  Label
                </label>
              )}
              {index > 0 && <div style={{ height: 0 }} />}
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateAdditionalTranslationLink(index, { ...link, label: e.target.value })}
                placeholder="Saison 1"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: 6,
                  padding: '0 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div>
              {index === 0 && (
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                  Lien
                </label>
              )}
              {index > 0 && <div style={{ height: 0 }} />}
              <input
                type="text"
                value={link.link}
                onChange={(e) => updateAdditionalTranslationLink(index, { ...link, link: e.target.value })}
                placeholder="https://..."
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: 6,
                  padding: '0 12px'
                }}
              />
            </div>
            <div>
              {index === 0 && <div style={{ height: 26 }} />}
              {index > 0 && <div style={{ height: 0 }} />}
              <button
                type="button"
                onClick={() => deleteAdditionalTranslationLink(index)}
                style={{
                  padding: '8px',
                  height: '40px',
                  width: '40px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--error)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.borderColor = 'var(--error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                title="Supprimer ce lien"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        {/* LIGNE 7 : Type de traduction et Lien du mod */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
              minHeight: 32
            }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                Type de traduction
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                userSelect: 'none',
                fontSize: 12,
                color: 'var(--text)',
                fontWeight: 600
              }}>
                <input
                  type="checkbox"
                  checked={isIntegrated}
                  onChange={e => setIsIntegrated(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span>Traduction intégrée (VF incluse)</span>
              </label>
            </div>
            <div style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
              height: '40px'
            }}>
              {(['Automatique', 'Semi-automatique', 'Manuelle'] as const).map((opt) => {
                const active = translationType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTranslationType(opt)}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'var(--muted)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      transition: 'all 0.15s'
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <LinkField
              label="Lien du mod"
              linkName="Mod_link"
              placeholder="ID du thread ou URL..."
              disabled={inputs['is_modded_game'] !== 'true'}
              customLabelContent={
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  minHeight: 32
                }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                    Lien du mod
                  </span>

                  {/* Groupe : Prévisualisation + Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Prévisualisation du lien */}
                    {(() => {
                      const config = linkConfigs['Mod_link'];
                      const modFinalUrl = config.source === 'F95'
                        ? `https://f95zone.to/threads/${config.value || '...'}/`
                        : config.source === 'Lewd'
                          ? `https://lewdcorner.com/threads/${config.value || '...'}/`
                          : config.value || '...';

                      return modFinalUrl && !modFinalUrl.includes('...') ? (
                        <div
                          onClick={async () => {
                            const result = await tauriAPI.openUrl(modFinalUrl);
                            if (!result.ok) {
                              console.error('Erreur ouverture URL:', result.error);
                            }
                          }}
                          style={{
                            fontSize: 11,
                            color: '#5865F2',
                            fontFamily: 'monospace',
                            padding: '2px 8px',
                            background: 'rgba(88, 101, 242, 0.1)',
                            borderRadius: 4,
                            maxWidth: '200px',  // ⬅️ Réduit pour laisser place à la checkbox
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            display: 'inline-block',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(88, 101, 242, 0.2)';
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(88, 101, 242, 0.1)';
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                          title="Cliquer pour ouvrir dans le navigateur externe"
                        >
                          🔗 {modFinalUrl}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: 11,
                          color: '#5865F2',
                          fontFamily: 'monospace',
                          padding: '2px 8px',
                          background: 'rgba(88, 101, 242, 0.1)',
                          borderRadius: 4,
                          maxWidth: '200px',  // ⬅️ Réduit pour laisser place à la checkbox
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          🔗 {modFinalUrl}
                        </div>
                      );
                    })()}

                    {/* Checkbox */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,  // ⬅️ Réduit de 8 à 6
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontSize: 12,
                      color: 'var(--text)',
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '3px 8px',  // ⬅️ Réduit le padding vertical
                      borderRadius: 4,
                      whiteSpace: 'nowrap'
                    }}>
                      <input
                        type="checkbox"
                        checked={inputs['is_modded_game'] === 'true'}
                        onChange={e => setInput('is_modded_game', e.target.checked ? 'true' : 'false')}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <span>Mod compatible</span>
                    </label>
                  </div>
                </div>
              }
            />
          </div>
        </div>

        {/* LIGNE 8 : Variables Custom (masquer si aucune) */}
        {visibleVars.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {visibleVars.map((v) => (
              <div key={v.name}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                  {v.label || v.name}
                </label>
                <input
                  value={inputs[v.name] || ''}
                  onChange={e => setInput(v.name, e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: 6,
                    padding: '0 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)'
                  }}
                  placeholder={v.placeholder || ''}
                />
              </div>
            ))}
          </div>
        )}

        {/* LIGNE 9 : Synopsis et Instructions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          {/* Synopsis (gauche) - prend toute la hauteur */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '150px' }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Synopsis
            </label>
            <textarea
              ref={overviewRef}
              value={inputs['Overview'] || ''}
              onChange={e => setInput('Overview', e.target.value)}
              onKeyDown={handleOverviewKeyDown}
              style={{
                width: '100%',
                flex: 1,
                minHeight: 0,
                borderRadius: 6,
                padding: '12px',
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.5,
                resize: 'none',
                overflowY: 'auto'
              }}
              className="styled-scrollbar"
              placeholder="Décrivez le jeu..."
            />
          </div>

          {/* Instructions (droite) - 2 lignes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: '150px' }}>
            {/* Ligne 1 : Dropdown */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                Instructions d'installation
              </label>
              <input
                type="text"
                placeholder="Rechercher une instruction..."
                value={instructionSearchQuery}
                onChange={e => {
                  setInstructionSearchQuery(e.target.value);
                  setShowInstructionSuggestions(true);
                }}
                onFocus={() => setShowInstructionSuggestions(true)}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: 6,
                  padding: '0 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
              />
              {showInstructionSuggestions && filteredInstructions.length > 0 && (
                <div
                  className="suggestions-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1001,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {filteredInstructions.map((name, idx) => (
                    <div
                      key={idx}
                      className="suggestion-item"
                      onClick={() => {
                        setInput('instruction', savedInstructions[name]);
                        setInstructionSearchQuery(name);
                        setShowInstructionSuggestions(false);
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {savedInstructions[name].substring(0, 50)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ligne 2 : Textarea - prend la hauteur restante */}
            <textarea
              value={inputs['instruction'] || ''}
              onChange={e => setInput('instruction', e.target.value)}
              style={{
                width: '100%',
                flex: 1,
                minHeight: 0,
                borderRadius: 6,
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'none',
                overflowY: 'auto'
              }}
              className="styled-scrollbar"
              placeholder="Tapez ou sélectionnez une instruction..."
            />
          </div>
        </div>

        {/* LIGNE 10 : Footer & Publication */}
        <div style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--border)'
        }}>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handlePasteImport}
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
                padding: '10px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>📥</span>
              Importer Data
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Vider le formulaire',
                  message: 'Voulez-vous vraiment vider tous les champs du formulaire ? Cette action est irréversible.',
                  confirmText: 'Vider',
                  cancelText: 'Annuler',
                  type: 'danger'
                });
                if (ok) {
                  resetAllFields();
                  showToast('Formulaire vidé', 'success');
                }
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '10px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>🗑️</span>
              Vider le formulaire
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {rateLimitCooldown !== null && (
              <div style={{ color: 'var(--error)', fontSize: 13, fontWeight: 700 }}>
                ⏳ Rate limit : {rateLimitCooldown}s
              </div>
            )}

            {editingPostId && (
              <button
                type="button"
                onClick={() => { setEditingPostId(null); setEditingPostData(null); }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Annuler l'édition
              </button>
            )}

            <button
              disabled={publishInProgress}
              onClick={async () => {
                const ok = await confirm({
                  title: editingPostId ? 'Mettre à jour' : 'Publier',
                  message: editingPostId ? 'Modifier ce post sur Discord ?' : 'Envoyer ce nouveau post sur Discord ?'
                });
                if (ok) {
                  const res = await publishPost();
                  if (res && res.ok) {
                    showToast('Terminé !', 'success');
                    if (editingPostId) {
                      setEditingPostId(null);
                      setEditingPostData(null);
                    }
                  }
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '12px 32px',
                fontSize: 15,
                fontWeight: 700,
                background: publishInProgress ? 'var(--muted)' : (editingPostId ? '#f59e0b' : '#5865F2'),
                color: 'white',
                minWidth: '220px',
                cursor: publishInProgress ? 'not-allowed' : 'pointer',
                border: 'none',
                borderRadius: 6
              }}
            >
              {publishInProgress ? (
                <span>⏳ Patientez...</span>
              ) : editingPostId ? (
                <>
                  <span style={{ fontSize: 18 }}>✏️</span>
                  <span>Mettre à jour le post</span>
                </>
              ) : (
                <>
                  <img
                    src={DiscordIcon}
                    alt="Discord"
                    style={{ width: 20, height: 20, filter: 'brightness(0) invert(1)' }}
                  />
                  <span>Publier sur Discord</span>
                </>
              )}
            </button>
          </div>
        </div> {/* FIN LIGNE 10 */}

        {/* Overlay global pour fermer les suggestions */}
        {showInstructionSuggestions && (
          <div
            onClick={() => {
              setShowInstructionSuggestions(false);
            }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
          />
        )}

        {/* Modale de sélection des tags */}
        <TagSelectorModal
          isOpen={showTagSelector}
          onClose={() => setShowTagSelector(false)}
          onSelectTag={handleSelectTag}
          selectedTagIds={selectedTagIds}
          position={tagSelectorPosition}
        />

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
}
