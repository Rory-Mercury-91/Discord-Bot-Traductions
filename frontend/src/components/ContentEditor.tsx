import React, {useState, useMemo, useRef, DragEvent, useEffect} from 'react';
import { useApp } from '../state/appContext';
import { useToast } from './ToastProvider';
import { useConfirm } from '../hooks/useConfirm';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ConfirmModal from './ConfirmModal';
import ImageThumbnail from './ImageThumbnail';
import DiscordIcon from '../assets/discord-icon.svg';

export default function ContentEditor(){
  const { allVarsConfig, inputs, setInput, preview,
    postTitle, setPostTitle, postTags, setPostTags, publishPost, publishInProgress, lastPublishResult,
    savedTags, savedTraductors, savedInstructions, templates, currentTemplateIdx,
    uploadedImages, addImages, removeImage, setMainImage, editingPostId, setEditingPostId } = useApp();
  
  const { showToast } = useToast();
  const { confirm, confirmState, closeConfirm } = useConfirm();

  // Vérifier si le template actuel permet la publication (my/partner uniquement)
  const currentTemplate = templates[currentTemplateIdx];
  const canPublish = currentTemplate?.type === 'my' || currentTemplate?.type === 'partner';
  const isEditMode = editingPostId !== null;

  // Fonction pour réinitialiser tous les champs
  const resetAllFields = async () => {
    const ok = await confirm({
      title: 'Réinitialiser tous les champs',
      message: 'Voulez-vous vraiment vider tous les champs (variables, tags, images) ? Cette action est irréversible.',
      confirmText: 'Réinitialiser',
      type: 'danger'
    });
    
    if (!ok) return;

    // Reset toutes les variables
    allVarsConfig.forEach(v => setInput(v.name, ''));
    // Reset instruction
    setInput('instruction', '');
    // Reset titre et tags
    setPostTitle('');
    setPostTags('');
    // Reset images (supprimer toutes)
    while(uploadedImages.length > 0) {
      removeImage(0);
    }
    // Reset query states
    setTraductorSearchQuery('');
    setInstructionSearchQuery('');
    
    showToast('Tous les champs ont été réinitialisés', 'success');
  };
  
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [traductorSearchQuery, setTraductorSearchQuery] = useState<string>('');
  const [showTraductorSuggestions, setShowTraductorSuggestions] = useState(false);
  const [instructionSearchQuery, setInstructionSearchQuery] = useState<string>('');
  const [showInstructionSuggestions, setShowInstructionSuggestions] = useState(false);
  const imageInputRef = useRef<HTMLInputElement|null>(null);
  const overviewRef = useRef<HTMLTextAreaElement|null>(null);
  
  // Undo/Redo pour le textarea Synopsis
  const { recordState, undo, redo, reset: resetUndoRedo } = useUndoRedo();
  
  // Enregistrer l'état initial
  useEffect(() => {
    recordState(inputs['overview'] || '');
  }, []);
  
  // Gérer Ctrl+Z et Ctrl+Y dans le textarea Synopsis
  const handleOverviewKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      const prevState = undo();
      if (prevState !== null) {
        setInput('overview', prevState);
      }
    } else if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      const nextState = redo();
      if (nextState !== null) {
        setInput('overview', nextState);
      }
    }
  };
  
  // Enregistrer l'état à chaque changement du Synopsis (avec debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      recordState(inputs['overview'] || '');
    }, 500);
    return () => clearTimeout(timer);
  }, [inputs['overview']]);

  // Filtrer les variables selon le template actuel
  const currentTemplateId = templates[currentTemplateIdx]?.id || templates[currentTemplateIdx]?.name;
  const visibleVars = useMemo(() => {
    return allVarsConfig.filter(v => {
      // Si la variable n'a pas de templates spécifiés, elle est visible partout
      if(!v.templates || v.templates.length === 0) return true;
      // Sinon, vérifier si le template actuel est dans la liste
      return v.templates.includes(currentTemplateId);
    });
  }, [allVarsConfig, currentTemplateId]);

  // Filtrer les tags selon le template actuel
  const visibleTags = useMemo(() => {
    return savedTags.filter(t => {
      // Si le tag n'a pas de template spécifié, il est visible partout
      if(!t.template) return true;
      // Sinon, vérifier si le template actuel correspond
      return t.template === currentTemplateId;
    });
  }, [savedTags, currentTemplateId]);

  // Filtrer les tags selon la recherche
  const filteredTags = useMemo(() => {
    if(!tagSearchQuery.trim()) return visibleTags;
    const query = tagSearchQuery.toLowerCase();
    return visibleTags.filter(t => 
      t.name.toLowerCase().includes(query) || 
      (t.id && t.id.toLowerCase().includes(query))
    );
  }, [visibleTags, tagSearchQuery]);

  // Filtrer les traducteurs selon la recherche
  const filteredTraductors = useMemo(() => {
    if(!traductorSearchQuery.trim()) return savedTraductors;
    const query = traductorSearchQuery.toLowerCase();
    return savedTraductors.filter(t => t.toLowerCase().includes(query));
  }, [savedTraductors, traductorSearchQuery]);

  // Filtrer les instructions selon la recherche
  const filteredInstructions = useMemo(() => {
    if(!instructionSearchQuery.trim()) return Object.keys(savedInstructions);
    const query = instructionSearchQuery.toLowerCase();
    return Object.keys(savedInstructions).filter(name => name.toLowerCase().includes(query));
  }, [savedInstructions, instructionSearchQuery]);

  // État pour l'overlay de drag & drop
  const [isDragging, setIsDragging] = useState(false);

  function onImageDrop(e: DragEvent){
    e.preventDefault();
    setIsDragging(false);
    if(e.dataTransfer?.files) addImages(e.dataTransfer.files);
  }
  function onDragOver(e: DragEvent){ 
    e.preventDefault();
    e.stopPropagation();
  }
  function onDragEnter(e: DragEvent){
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }
  function onDragLeave(e: DragEvent){
    e.preventDefault();
    e.stopPropagation();
    // Vérifier que c'est bien la sortie du conteneur principal
    if(e.currentTarget === e.target){
      setIsDragging(false);
    }
  }

  return (
    <div 
      onDrop={onImageDrop} 
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      style={{position: 'relative'}}
    >
      {/* Overlay drag & drop */}
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(79, 70, 229, 0.15)',
          border: '3px dashed rgba(79, 70, 229, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'none',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            textAlign: 'center',
            background: 'rgba(79, 70, 229, 0.9)',
            padding: '24px 48px',
            borderRadius: 12,
            color: 'white'
          }}>
            <div style={{fontSize: 20, fontWeight: 600, marginBottom: 8}}>
              Déposez vos images ici
            </div>
            <div style={{fontSize: 13, opacity: 0.9}}>
              Les images seront ajoutées automatiquement
            </div>
          </div>
        </div>
      )}

      {/* Badge mode édition */}
      {isEditMode && (
        <div style={{
          background: 'rgba(125, 211, 252, 0.15)',
          border: '1px solid var(--accent)',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{fontWeight: 600, color: 'var(--accent)', marginBottom: 4}}>
              ✏️ Mode édition
            </div>
            <div style={{fontSize: 12, color: 'var(--muted)'}}>
              Vous modifiez un post existant. Les modifications seront envoyées à Discord.
            </div>
          </div>
          <button
            onClick={() => {
              setEditingPostId(null);
              showToast('Mode édition annulé', 'info');
            }}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            ❌ Annuler
          </button>
        </div>
      )}

      <h4>📝 Contenu du post Discord</h4>
      <div style={{display:'grid', gap:12}}>
        {/* Titre, Tags et Image - Sur la même ligne */}
        <div style={{display:'grid', gridTemplateColumns: '2fr 2fr auto', gap:12, alignItems:'end'}}>
          {/* Titre */}
          <div>
            <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Titre du post</label>
            <input 
              placeholder="Titre (optionnel)" 
              value={postTitle} 
              onChange={e=>setPostTitle(e.target.value)}
              style={{
                width:'100%',
                border: postTitle.trim() === '' ? '2px solid var(--error)' : undefined,
                outline: postTitle.trim() === '' ? 'none' : undefined
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Tags</label>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <select 
                value={selectedTagId} 
                onChange={e=>setSelectedTagId(e.target.value)}
                style={{flex:1, color: selectedTagId ? 'inherit' : 'var(--placeholder)'}}
              >
                <option value="">— Sélectionner un tag —</option>
                {visibleTags.map((t, idx)=>(<option key={idx} value={t.id || t.name}>{t.name} ({t.id})</option>))}
              </select>
              <button onClick={()=>{
                if(!selectedTagId) return;
                const currentTags = postTags ? postTags.split(',').map(s=>s.trim()).filter(Boolean) : [];
                if(!currentTags.includes(selectedTagId)){
                  setPostTags([...currentTags, selectedTagId].join(','));
                }
                setSelectedTagId('');
              }}>➕</button>
            </div>
          </div>

          {/* Image */}
          <div>
            <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Image</label>
            <button onClick={()=>imageInputRef.current?.click()}>🖼️ Parcourir</button>
            <input 
              ref={imageInputRef} 
              type="file" 
              accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,.ico,.tiff,.tif" 
              style={{display:'none'}} 
              multiple 
              onChange={(e)=>{ if(e.target.files) addImages(e.target.files); }} 
            />
          </div>
        </div>

        {/* Première ligne : Tags actifs */}
        {postTags && postTags.trim() && (
          <div style={{padding:8, background:'rgba(74, 158, 255, 0.05)', borderRadius:4, border:'1px solid rgba(74, 158, 255, 0.2)'}}>
            <div style={{fontSize:12, color:'#4a9eff', marginBottom:6, fontWeight:'bold'}}>Tags actifs :</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {postTags.split(',').map(s=>s.trim()).filter(Boolean).map((tagId, idx) => {
                const tag = savedTags.find(t => (t.id || t.name) === tagId);
                return (
                  <div key={idx} style={{
                    display:'flex', 
                    alignItems:'center', 
                    gap:6, 
                    background:'rgba(74, 158, 255, 0.2)', 
                    border:'1px solid #4a9eff',
                    borderRadius:4, 
                    padding:'4px 8px',
                    fontSize:13
                  }}>
                    <span>{tag?.name || tagId}</span>
                    <button 
                      onClick={()=>{
                        const currentTags = postTags.split(',').map(s=>s.trim()).filter(Boolean);
                        const newTags = currentTags.filter(t => t !== tagId);
                        setPostTags(newTags.join(','));
                      }}
                      style={{
                        background:'transparent', 
                        border:'none', 
                        color:'#ff6b6b', 
                        cursor:'pointer',
                        padding:'0 2px',
                        fontSize:14
                      }}
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Deuxième ligne : Vignettes des images */}
        {uploadedImages.length > 0 && (
          <div style={{padding:8, background:'rgba(255,255,255,0.02)', borderRadius:4, border:'1px solid var(--border)'}}>
            <div style={{fontSize:12, color:'var(--muted)', marginBottom:6, fontWeight:'bold'}}>Images :</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {uploadedImages.map((img, idx)=> (
                <ImageThumbnail
                  key={img.id}
                  imagePath={img.path}
                  isMain={img.isMain}
                  onSetMain={() => setMainImage(idx)}
                  onCopyName={async () => {
                    await navigator.clipboard.writeText(img.path);
                    showToast('Nom copié dans le presse-papier', 'success');
                  }}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: 'Supprimer l\'image',
                      message: 'Voulez-vous vraiment supprimer cette image ?',
                      confirmText: 'Supprimer',
                      type: 'danger'
                    });
                    if(ok) {
                      removeImage(idx);
                      showToast('Image supprimée', 'success');
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Variables par défaut en grille 2 colonnes */}
        <div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
            {/* Ligne 1 : Name_game | traductor */}
            <div>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Nom du jeu</label>
              <input value={inputs['Name_game'] || ''} onChange={e=>setInput('Name_game', e.target.value)} style={{width:'100%'}} placeholder="Lost Solace" />
            </div>
            <div style={{position:'relative'}}>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Traducteur</label>
              <input 
                type="text"
                placeholder="Rechercher un traducteur..."
                value={traductorSearchQuery || inputs['traductor'] || ''}
                onChange={e => {
                  setTraductorSearchQuery(e.target.value);
                  setInput('traductor', e.target.value);
                  setShowTraductorSuggestions(true);
                }}
                onFocus={() => setShowTraductorSuggestions(true)}
                style={{width:'100%'}}
              />
              {/* Suggestions traducteurs */}
              {showTraductorSuggestions && filteredTraductors.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background:'var(--panel)', 
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                  {filteredTraductors.map((t, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setInput('traductor', t);
                        setTraductorSearchQuery(t);
                        setShowTraductorSuggestions(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: idx < filteredTraductors.length - 1 ? '1px solid #333' : 'none',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(74, 158, 255, 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{fontWeight: 500}}>{t}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ligne 2 : Game_version | Game_link */}
            <div>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Version du jeu</label>
              <input value={inputs['Game_version'] || ''} onChange={e=>setInput('Game_version', e.target.value)} style={{width:'100%'}} placeholder="v0.1" />
            </div>
            <div>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Lien du jeu</label>
              <input value={inputs['Game_link'] || ''} onChange={e=>setInput('Game_link', e.target.value)} style={{width:'100%'}} placeholder="https://..." />
            </div>

            {/* Ligne 3 : Translate_version | Translate_link */}
            <div>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Version de la traduction</label>
              <input value={inputs['Translate_version'] || ''} onChange={e=>setInput('Translate_version', e.target.value)} style={{width:'100%'}} placeholder="v0.1" />
            </div>
            <div>
              <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>Lien de la traduction</label>
              <input value={inputs['Translate_link'] || ''} onChange={e=>setInput('Translate_link', e.target.value)} style={{width:'100%'}} placeholder="https://..." />
            </div>

            {/* Variables personnalisées (2 par ligne) */}
            {visibleVars.filter(v => !['Name_game', 'Game_version', 'Translate_version', 'Game_link', 'Translate_link', 'traductor', 'overview'].includes(v.name)).map((v, idx) => (
              <div key={v.name} style={v.fullWidth ? {gridColumn: '1 / -1'} : {}}>
                <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>{v.label}</label>
                {v.type === 'textarea' ? (
                  <textarea value={inputs[v.name] || ''} onChange={e=>setInput(v.name, e.target.value)} rows={3} style={{width:'100%'}} placeholder={v.placeholder} spellCheck={true} lang="fr-FR" />
                ) : (
                  <input value={inputs[v.name] || ''} onChange={e=>setInput(v.name, e.target.value)} style={{width:'100%'}} placeholder={v.placeholder} />
                )}
              </div>
            ))}
          </div>

          {/* Overview en pleine largeur */}
          <div style={{marginBottom:12}}>
            <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>
              Synopsis
              <span style={{fontSize:10, marginLeft:8, opacity:0.5}}>Ctrl+Z / Ctrl+Y pour annuler/refaire</span>
            </label>
            <textarea 
              ref={overviewRef}
              value={inputs['overview'] || ''} 
              onChange={e=>setInput('overview', e.target.value)}
              onKeyDown={handleOverviewKeyDown}
              rows={6} 
              style={{width:'100%'}} 
              placeholder="Synopsis du jeu..." 
              spellCheck={true}
              lang="fr-FR"
            />
          </div>

          {/* Champ de recherche pour les instructions */}
          <div style={{marginBottom:12}}>
            <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>
              Instruction (optionnelle) 
              <span style={{fontSize:11, marginLeft:8, opacity:0.6}}>
                💡 Variable : [instruction]
              </span>
            </label>
            <div style={{position:'relative'}}>
              <input 
                type="text"
                placeholder="Rechercher une instruction..."
                value={instructionSearchQuery || inputs['instruction'] || ''}
                onChange={e => {
                  setInstructionSearchQuery(e.target.value);
                  setInput('instruction', e.target.value);
                  setShowInstructionSuggestions(true);
                }}
                onFocus={() => setShowInstructionSuggestions(true)}
                style={{width:'100%'}}
              />
              
              {/* Liste des suggestions d'instructions */}
              {showInstructionSuggestions && filteredInstructions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                  {filteredInstructions.map((name, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setInput('instruction', savedInstructions[name]);
                        setInstructionSearchQuery(name);
                        setShowInstructionSuggestions(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: idx < filteredInstructions.length - 1 ? '1px solid #333' : 'none',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(74, 158, 255, 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{fontWeight: 500}}>{name}</div>
                      <div style={{fontSize: 11, color: 'var(--muted)', marginTop: 2}}>
                        {savedInstructions[name].substring(0, 60)}{savedInstructions[name].length > 60 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bouton Publier - aligné à droite */}
        <div style={{marginTop: 24, display:'flex', justifyContent:'flex-end', alignItems:'center', gap:12}}>
          {lastPublishResult && <div style={{color: lastPublishResult.startsWith('❌') || lastPublishResult.startsWith('Erreur') ? 'var(--error)' : 'var(--success)', fontSize:14}}>{lastPublishResult}</div>}
          {!canPublish && (
            <div style={{color: 'var(--muted)', fontSize:14, fontStyle:'italic'}}>
              📋 Ce template est réservé à la copie. Seuls "Mes traductions" et "Traductions partenaire" peuvent être publiés.
            </div>
          )}
          <button 
            onClick={async ()=>{
              if(publishInProgress || !canPublish) return;
              
              const confirmMessage = isEditMode 
                ? 'Voulez-vous mettre à jour ce post sur Discord ?' 
                : 'Voulez-vous publier ce post sur l\'API Publisher ?';
              
              const ok = await confirm({
                title: isEditMode ? 'Mettre à jour sur Discord' : 'Publier sur Discord',
                message: confirmMessage,
                confirmText: isEditMode ? 'Mettre à jour' : 'Publier',
                type: 'info'
              });
              if(!ok) return;
              
              const res = await publishPost();
              if(res.ok) {
                  showToast(isEditMode ? 'Mise à jour réussie !' : 'Publication réussie !', 'success', 5000);
                  if(isEditMode) setEditingPostId(null); // Exit edit mode
                } else {
                  showToast('Erreur: ' + (res.error || 'inconnue'), 'error', 5000);
                }
            }}
            style={{
              padding:'12px 24px',
              fontSize:16,
              fontWeight:600,
              background: (publishInProgress || !canPublish) ? 'var(--muted)' : '#5865F2',
              color: '#ffffff',
              cursor: (publishInProgress || !canPublish) ? 'not-allowed' : 'pointer',
              opacity: !canPublish ? 0.5 : 1
            }}
            disabled={publishInProgress || !canPublish}
            title={!canPublish ? 'Seuls les templates "Mes traductions" et "Traductions partenaire" peuvent être publiés' : ''}
          >
            {publishInProgress 
              ? (isEditMode ? '⏳ Mise à jour en cours...' : '⏳ Publication en cours...') 
              : (isEditMode ? '✏️ Mettre à jour' : (
                <span style={{display:'flex', alignItems:'center', gap:8}}>
                  <img src={DiscordIcon} alt="Discord" style={{width:20, height:20, filter: 'brightness(0) invert(1)'}} />
                  Publier sur Discord
                </span>
              ))}
          </button>
        </div>
      </div>
      
      {/* Overlay pour fermer les suggestions */}
      {(showTagSuggestions || showTraductorSuggestions || showInstructionSuggestions) && (
        <div 
          onClick={() => {
            setShowTagSuggestions(false);
            setShowTraductorSuggestions(false);
            setShowInstructionSuggestions(false);
          }} 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
      
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
