import React, {useState, useRef} from 'react';
import { useApp } from '../state/appContext';
import { useToast } from './ToastProvider';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from './ConfirmModal';

export default function TemplatesModal({onClose}:{onClose?:()=>void}){
  const { templates, addTemplate, updateTemplate, deleteTemplate, allVarsConfig, addVarConfig, updateVarConfig, deleteVarConfig } = useApp();
  const { showToast } = useToast();
  const { confirm, confirmState, closeConfirm } = useConfirm();
  const [editingIdx, setEditingIdx] = useState<number|null>(null);
  const [form, setForm] = useState({name:'', content:''});
  const [showVarsSection, setShowVarsSection] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string|null>(null);
  const [editingVarIdx, setEditingVarIdx] = useState<number|null>(null);
  const [varForm, setVarForm] = useState({name:'', label:'', type:'text' as 'text' | 'textarea' | 'select', templates: [] as string[]});
  const contentRef = useRef<HTMLTextAreaElement>(null);

  function startEdit(idx:number){
    setEditingIdx(idx);
    const t = templates[idx];
    setForm({name:t.name, content:t.content});
  }

  function cancelEdit(){
    setEditingIdx(null);
    setForm({name:'', content:''});
    setShowVarsSection(false);
    cancelVarEdit();
  }

  function saveTemplate(){
    if(!form.name.trim()){
      showToast('Le nom est requis', 'warning');
      return;
    }
    
    const payload = {
      id: form.name.toLowerCase().replace(/\s+/g,'_'),
      name: form.name,
      type: 'Autres',
      content: form.content
    };
    
    if(editingIdx !== null){
      updateTemplate(editingIdx, payload);
    } else {
      addTemplate(payload);
    }
    
    cancelEdit();
    showToast(editingIdx !== null ? 'Template modifié' : 'Template ajouté', 'success');
  }

  async function handleDelete(idx:number){
    const ok = await confirm({
      title: 'Supprimer le template',
      message: 'Voulez-vous vraiment supprimer ce template ?',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    if(!ok) return;
    deleteTemplate(idx);
    if(editingIdx===idx) cancelEdit();
    showToast('Template supprimé', 'success');
  }

  async function copyVarToClipboard(varName: string){
    const textToCopy = `[${varName}]`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedVar(varName);
      setTimeout(() => setCopiedVar(null), 2000);
      showToast('Variable copiée', 'success', 2000);
    } catch(e) {
      showToast('Erreur lors de la copie', 'error');
    }
  }

  // Variables section
  function startVarEdit(idx: number){
    const v = allVarsConfig[idx];
    setVarForm({
      name: v.name,
      label: v.label,
      type: v.type || 'text',
      templates: v.templates || []
    });
    setEditingVarIdx(idx);
  }

  function cancelVarEdit(){
    setVarForm({name:'', label:'', type:'text', templates:[]});
    setEditingVarIdx(null);
  }

  function saveVar(){
    if(!varForm.name.trim() || !varForm.label.trim()){
      showToast('Le nom et le label sont requis', 'warning');
      return;
    }

    const existingIdx = allVarsConfig.findIndex((v, i) => v.name === varForm.name && i !== editingVarIdx);
    if(existingIdx !== -1){
      showToast('Une variable avec ce nom existe déjà', 'warning');
      return;
    }

    const varConfig = {
      name: varForm.name,
      label: varForm.label,
      type: varForm.type,
      templates: varForm.templates.length > 0 ? varForm.templates : undefined,
      isCustom: true
    };

    if(editingVarIdx !== null){
      updateVarConfig(editingVarIdx, varConfig);
    } else {
      addVarConfig(varConfig);
    }

    cancelVarEdit();
    showToast(editingVarIdx !== null ? 'Variable modifiée' : 'Variable ajoutée', 'success');
  }

  async function handleDeleteVar(idx:number){
    const ok = await confirm({
      title: 'Supprimer la variable',
      message: 'Voulez-vous vraiment supprimer cette variable ?',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    if(!ok) return;
    deleteVarConfig(idx);
    if(editingVarIdx===idx) cancelVarEdit();
    showToast('Variable supprimée', 'success');
  }

  function toggleVarTemplate(templateId: string){
    setVarForm(prev => {
      const templates = prev.templates.includes(templateId)
        ? prev.templates.filter(id => id !== templateId)
        : [...prev.templates, templateId];
      return {...prev, templates};
    });
  }

  // Export single template to file
  async function exportTemplate(idx: number){
    const t = templates[idx];
    try {
      const res = await (window as any).electronAPI?.exportTemplateToFile?.(t);
      if(res?.ok) {
        showToast(`Template exporté : ${res.path}`, 'success');
      } else if(!res?.canceled) {
        showToast('Erreur lors de l\'export', 'error');
      }
    } catch(e) {
      showToast('Erreur lors de l\'export', 'error');
    }
  }

  // Import template from file
  async function importTemplate(){
    try {
      const res = await (window as any).electronAPI?.importTemplateFromFile?.();
      
      if(res?.canceled) return;
      
      if(!res?.ok || !res?.template){
        showToast('Erreur lors de l\'import', 'error');
        return;
      }
      
      const parsed = res.template;
      
      // Validate template structure
      if(!parsed.name || !parsed.content){
        showToast('Format de template invalide (nom et contenu requis)', 'error');
        return;
      }

      // Check if template with same name exists
      const existingIdx = templates.findIndex(t => t.name === parsed.name);
      if(existingIdx !== -1){
        const ok = await confirm({
          title: 'Template existant',
          message: `Un template avec le nom "${parsed.name}" existe déjà. Voulez-vous le remplacer ?`,
          confirmText: 'Remplacer',
          type: 'warning'
        });
        
        if(!ok) return;
        
        // Update existing template
        updateTemplate(existingIdx, {
          id: parsed.id || parsed.name.toLowerCase().replace(/\s+/g,'_'),
          name: parsed.name,
          type: parsed.type || 'Autres',
          content: parsed.content
        });
        showToast('Template remplacé', 'success');
      } else {
        // Add new template
        addTemplate({
          id: parsed.id || parsed.name.toLowerCase().replace(/\s+/g,'_'),
          name: parsed.name,
          type: parsed.type || 'Autres',
          content: parsed.content
        });
        showToast('Template importé', 'success');
      }
    } catch(e) {
      showToast('Erreur lors de l\'import : format JSON invalide', 'error');
    }
  }

  // Get current template ID for filtering variables
  const currentTemplateId = editingIdx !== null ? templates[editingIdx]?.id : null;
  const visibleVars = currentTemplateId 
    ? allVarsConfig.filter(v => !v.templates || v.templates.length === 0 || v.templates.includes(currentTemplateId))
    : allVarsConfig;
  const customVars = allVarsConfig.map((v, idx) => ({v, idx})).filter(({v}) => v.isCustom);

  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={e=>e.stopPropagation()} style={{maxWidth: 900, width: '95%', maxHeight: '90vh', overflowY: 'auto'}}>
        <h3>📄 Gestion des templates & variables</h3>

        <div style={{display:'grid', gap:16}}>
          {/* Liste des templates existants */}
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
              <h4 style={{margin: 0}}>Templates sauvegardés ({templates.length})</h4>
              <button 
                onClick={importTemplate}
                style={{
                  fontSize: 13,
                  padding: '6px 12px',
                  background: 'var(--info)',
                  cursor: 'pointer'
                }}
                title="Importer un template depuis un fichier JSON"
              >
                📥 Importer
              </button>
            </div>
            {templates.length === 0 ? (
              <div style={{color:'var(--muted)', fontStyle:'italic', padding: 12, textAlign:'center'}}>
                Aucun template sauvegardé. Utilisez le formulaire ci-dessous pour en ajouter.
              </div>
            ) : (
              <div style={{display:'grid', gap:8}}>
                {templates.map((t, idx) => (
                  <div key={idx} style={{
                    display:'grid', 
                    gridTemplateColumns: editingIdx === idx ? '1fr' : '1fr auto auto auto',
                    gap:8, 
                    alignItems:'center', 
                    borderBottom:'1px solid var(--border)', 
                    padding:'8px 0',
                    background: editingIdx === idx ? 'rgba(255,255,255,0.05)' : 'transparent'
                  }}>
                    {editingIdx === idx ? (
                      <div style={{display:'grid', gap:8}}>
                        <div style={{color:'var(--muted)', fontSize:12}}>✏️ Mode édition</div>
                        <div>
                          <strong>{t.name}</strong>
                          <div style={{color:'var(--muted)', fontSize:12}}>
                            Type : {t.type || 'Autres'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div>
                            <strong>{t.name}</strong>
                          </div>
                          <div style={{color:'var(--muted)', fontSize:12}}>
                            Type : {t.type || 'Autres'}
                          </div>
                        </div>
                        <button 
                          onClick={() => exportTemplate(idx)} 
                          title="Exporter ce template en fichier JSON"
                          style={{fontSize:12, padding:'4px 8px'}}
                        >
                          📤
                        </button>
                        <button onClick={() => startEdit(idx)} title="Éditer">✏️</button>
                        <button onClick={() => handleDelete(idx)} title="Supprimer">🗑️</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulaire d'ajout/édition */}
          <div style={{borderTop: '2px solid var(--border)', paddingTop: 16}}>
            <h4>{editingIdx !== null ? '✏️ Modifier le template' : '➕ Ajouter un template'}</h4>
            <div style={{display:'grid', gap:12}}>
              <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:8}}>
                <div>
                  <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>
                    Nom du template *
                  </label>
                  <input 
                    placeholder="ex: Mon template" 
                    value={form.name} 
                    onChange={e=>setForm({...form, name:e.target.value})}
                    style={{width:'100%'}}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>
                    Type
                  </label>
                  <input 
                    value={editingIdx !== null ? (templates[editingIdx]?.type || 'Autres') : 'Autres (par défaut)'}
                    readOnly
                    style={{
                      width:'100%',
                      backgroundColor: '#1a1a1a',
                      color: '#888',
                      fontStyle: 'italic',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:13, color:'var(--muted)', marginBottom:4}}>
                  Contenu
                </label>
                <textarea 
                  ref={contentRef}
                  placeholder="Contenu du template..." 
                  value={form.content} 
                  onChange={e=>setForm({...form, content:e.target.value})}
                  rows={8}
                  style={{width:'100%', fontFamily:'monospace', resize:'vertical'}}
                />
              </div>

              {/* Variables disponibles - Badges cliquables */}
              {editingIdx !== null && (
                <div style={{
                  padding: 12,
                  backgroundColor: 'rgba(74, 158, 255, 0.1)',
                  border: '1px solid rgba(74, 158, 255, 0.3)',
                  borderRadius: 4
                }}>
                  <div style={{fontSize: 13, color: '#4a9eff', marginBottom: 8, fontWeight: 'bold'}}>
                    💡 Variables disponibles (clic pour copier) :
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    maxHeight: 120,
                    overflowY: 'auto'
                  }}>
                    {visibleVars.length === 0 ? (
                      <span style={{color:'var(--muted)', fontSize:12, fontStyle:'italic'}}>
                        Aucune variable disponible pour ce template
                      </span>
                    ) : (
                      visibleVars.map((v, idx) => (
                        <span
                          key={idx}
                          onClick={() => copyVarToClipboard(v.name)}
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            backgroundColor: copiedVar === v.name ? '#4ade80' : '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: copiedVar === v.name ? '#000' : '#fff',
                            fontFamily: 'monospace'
                          }}
                          title={`${v.label} - Cliquer pour copier [${v.name}]`}
                        >
                          {copiedVar === v.name ? '✓ ' : ''}[{v.name}]
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Section Variables personnalisées - Repliable */}
              {editingIdx !== null && (
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => setShowVarsSection(!showVarsSection)}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>🔧 Gérer les variables personnalisées ({customVars.length})</span>
                    <span style={{fontSize: 12}}>{showVarsSection ? '▼' : '▶'}</span>
                  </button>

                  {showVarsSection && (
                    <div style={{padding: 12, backgroundColor: 'rgba(0,0,0,0.2)'}}>
                      {/* Liste des variables custom */}
                      {customVars.length > 0 && (
                        <div style={{marginBottom: 12}}>
                          <div style={{fontSize: 12, color:'var(--muted)', marginBottom: 8}}>
                            Variables existantes :
                          </div>
                          <div style={{display:'grid', gap:6}}>
                            {customVars.map(({v, idx}) => (
                              <div key={idx} style={{
                                display:'grid',
                                gridTemplateColumns: editingVarIdx === idx ? '1fr' : '1fr auto auto',
                                gap:6,
                                alignItems:'center',
                                padding: '6px 8px',
                                background: editingVarIdx === idx ? 'rgba(74, 158, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                                borderRadius: 3,
                                border: '1px solid #444'
                              }}>
                                {editingVarIdx === idx ? (
                                  <div style={{fontSize: 12, color: '#4a9eff'}}>✏️ Mode édition</div>
                                ) : (
                                  <>
                                    <div>
                                      <strong style={{fontSize:13}}>[{v.name}]</strong>
                                      <div style={{color:'var(--muted)', fontSize:11}}>
                                        {v.label} • {v.templates && v.templates.length > 0 
                                          ? `${v.templates.length} template(s)` 
                                          : 'Tous templates'}
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => startVarEdit(idx)}
                                      style={{fontSize:11, padding:'2px 6px'}}
                                      title="Éditer"
                                    >
                                      ✏️
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteVar(idx)}
                                      style={{fontSize:11, padding:'2px 6px'}}
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
                        <h5 style={{margin: '0 0 8px 0', fontSize: 13}}>
                          {editingVarIdx !== null ? '✏️ Modifier la variable' : '➕ Ajouter une variable'}
                        </h5>
                        <div style={{display:'grid', gap:8}}>
                          <div style={{display:'grid', gridTemplateColumns: '1fr 1fr 1fr', gap:8}}>
                            <div>
                              <label style={{display:'block', fontSize:11, color:'var(--muted)', marginBottom:2}}>
                                Nom *
                              </label>
                              <input
                                placeholder="ex: ma_var"
                                value={varForm.name}
                                onChange={e=>setVarForm({...varForm, name:e.target.value})}
                                style={{width:'100%', fontSize:12, padding:6}}
                              />
                            </div>
                            <div>
                              <label style={{display:'block', fontSize:11, color:'var(--muted)', marginBottom:2}}>
                                Label *
                              </label>
                              <input
                                placeholder="ex: Ma variable"
                                value={varForm.label}
                                onChange={e=>setVarForm({...varForm, label:e.target.value})}
                                style={{width:'100%', fontSize:12, padding:6}}
                              />
                            </div>
                            <div>
                              <label style={{display:'block', fontSize:11, color:'var(--muted)', marginBottom:2}}>
                                Type
                              </label>
                              <select
                                value={varForm.type}
                                onChange={e=>setVarForm({...varForm, type:e.target.value as any})}
                                style={{width:'100%', fontSize:12, padding:6, background:'#1a1a1a', color:'white', border:'1px solid #444'}}
                              >
                                <option value="text">Texte</option>
                                <option value="textarea">Textarea</option>
                                <option value="select">Select</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label style={{display:'block', fontSize:11, color:'var(--muted)', marginBottom:4}}>
                              Templates associés (vide = tous) :
                            </label>
                            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                              {templates.map(t => (
                                <label key={t.id} style={{display:'flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer'}}>
                                  <input
                                    type="checkbox"
                                    checked={varForm.templates.includes(t.id || t.name)}
                                    onChange={() => toggleVarTemplate(t.id || t.name)}
                                  />
                                  {t.name}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div style={{display:'flex', gap:6, justifyContent:'flex-end', marginTop:4}}>
                            {editingVarIdx !== null && (
                              <button onClick={cancelVarEdit} style={{fontSize:12, padding:'4px 10px'}}>
                                Annuler
                              </button>
                            )}
                            <button onClick={saveVar} style={{fontSize:12, padding:'4px 10px'}}>
                              {editingVarIdx !== null ? '✅ Enregistrer' : '➕ Ajouter'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:8}}>
                {editingIdx !== null && (
                  <button onClick={cancelEdit}>Annuler</button>
                )}
                <button onClick={saveTemplate}>
                  {editingIdx !== null ? '✅ Enregistrer' : '➕ Ajouter'}
                </button>
                <button onClick={onClose}>Fermer</button>
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
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
