import React, {useState} from 'react';
import { useApp } from '../state/appContext';
import { useToast } from './ToastProvider';

export default function ConfigModal({onClose}:{onClose?:()=>void}){
  const { 
    apiUrl, setApiUrl, apiKey, setApiKey,
    templates, savedTags, savedInstructions, savedTraductors, allVarsConfig
  } = useApp();
  const { showToast } = useToast();
  const [localUrl, setLocalUrl] = useState(apiUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h3 style={{margin:0}}>Édition des configurations</h3>
          <span style={{fontSize:11, color:'var(--muted)'}}>v1.0.0</span>
        </div>

        <div style={{display:'grid', gap:8}}>
          <label>Endpoint API Publisher</label>
          <input value={localUrl} onChange={e=>setLocalUrl(e.target.value)} placeholder="https://..." />

          <label>Clé API (X-API-KEY)</label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input value={localKey} onChange={e=>setLocalKey(e.target.value)} type={showKey ? 'text' : 'password'} style={{flex:1}} placeholder="Masquée" />
            <button title="Afficher/masquer" onClick={()=>setShowKey(s=>!s)}>{showKey ? '🙈' : '👁️'}</button>
          </div>

          <div style={{marginTop: 12}}>
            <button 
              onClick={async ()=>{
                if(!localUrl){
                  showToast('⚠️ Veuillez configurer l\'URL API', 'warning');
                  return;
                }
                setTesting(true);
                try{
                  const res = await (window as any).electronAPI?.testConnection?.({apiUrl: localUrl, apiKey: localKey});
                  if(res?.ok){
                    showToast('✅ Connexion réussie ! API accessible', 'success');
                  } else {
                    showToast(`❌ Échec de connexion : ${res?.error || 'Erreur inconnue'}`, 'error');
                  }
                }catch(e){
                  showToast(`❌ Erreur de test : ${e}`, 'error');
                }
                setTesting(false);
              }}
              disabled={testing}
              style={{
                width: '100%',
                padding: '10px',
                background: testing ? 'var(--muted)' : 'var(--info)',
                cursor: testing ? 'not-allowed' : 'pointer',
                opacity: testing ? 0.6 : 1
              }}
            >
              {testing ? '⏳ Test en cours...' : '🔌 Tester la connexion'}
            </button>
          </div>

          <div style={{borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12}}>
            <div style={{marginBottom: 8, padding: 8, background: 'rgba(74, 158, 255, 0.1)', borderRadius: 4, fontSize: 13}}>
              <strong>💾 Export/Import complet</strong>
              <div style={{color: 'var(--muted)', fontSize: 12, marginTop: 4}}>
                Inclus : Config API, Templates personnalisés, Tags, Variables personnalisées, Traducteurs, Instructions sauvegardées
              </div>
            </div>
          </div>

          <div style={{display:'flex', gap:8, justifyContent:'space-between'}}>
            <div style={{display:'flex', gap:8}}>
              <button onClick={async ()=>{ 
                try{ 
                  // Export complet : API config + templates + tags + instructions + traducteurs + variables personnalisées
                  const fullConfig = {
                    apiUrl: localUrl,
                    apiKey: localKey,
                    customTemplates: templates,
                    savedTags: savedTags,
                    savedInstructions: savedInstructions,
                    savedTraductors: savedTraductors,
                    customVariables: allVarsConfig
                  };
                  const res = await (window as any).electronAPI?.exportConfigToFile?.(fullConfig); 
                  if(res?.ok) alert('✅ Configuration complète exportée : ' + res.path); 
                  else if(!res?.canceled) alert('❌ Erreur lors de l\'export'); 
                }catch(e){ alert('❌ Erreur export : ' + e); } 
              }}>📤 Exporter</button>
              <button onClick={async ()=>{ 
                try{ 
                  const res = await (window as any).electronAPI?.importConfigFromFile?.(); 
                  if(res?.ok && res.config){ 
                    // Restaurer API config
                    if(res.config.apiUrl) setLocalUrl(res.config.apiUrl); 
                    if(res.config.apiKey) setLocalKey(res.config.apiKey);
                    
                    // Restaurer toutes les données dans localStorage
                    if(res.config.customTemplates) {
                      localStorage.setItem('customTemplates', JSON.stringify(res.config.customTemplates));
                    }
                    if(res.config.savedTags) {
                      localStorage.setItem('savedTags', JSON.stringify(res.config.savedTags));
                    }
                    if(res.config.savedInstructions) {
                      localStorage.setItem('savedInstructions', JSON.stringify(res.config.savedInstructions));
                    }
                    if(res.config.savedTraductors) {
                      localStorage.setItem('savedTraductors', JSON.stringify(res.config.savedTraductors));
                    }
                    if(res.config.customVariables) {
                      localStorage.setItem('customVariables', JSON.stringify(res.config.customVariables));
                    }
                    
                    alert('✅ Configuration complète importée ! Rechargez la page pour appliquer les changements.');
                    // Recharger la page pour appliquer les changements
                    window.location.reload();
                  } else if(!res?.canceled) alert('❌ Erreur lors de l\'import'); 
                }catch(e){ alert('❌ Erreur import : ' + e); } 
              }}>📥 Importer</button>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={onClose}>Annuler</button>
              <button onClick={async ()=>{ setApiUrl(localUrl); setApiKey(localKey); try{ await (window as any).electronAPI?.setPublisherConfig?.({ apiUrl: localUrl, apiKey: localKey }); }catch(e){}; onClose && onClose(); }}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
