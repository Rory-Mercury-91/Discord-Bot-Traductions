import React, {useState} from 'react';
import { useApp } from '../state/appContext';
import { useToast } from './ToastProvider';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';

export default function ConfigModal({onClose}:{onClose?:()=>void}){
  const { 
    apiUrl,
    templates, savedTags, savedInstructions, savedTraductors, allVarsConfig
  } = useApp();
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [debugMode, setDebugMode] = useState(() => {
    try {
      return localStorage.getItem('debugMode') === 'true';
    } catch {
      return false;
    }
  });
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();

  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    localStorage.setItem('debugMode', String(newMode));
    if (newMode) {
      showToast('Mode debug activé - Les requêtes seront enregistrées', 'info');
      addDebugLog('🔧 Mode debug activé');
    } else {
      showToast('Mode debug désactivé', 'info');
    }
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const exportLogs = () => {
    const logsText = debugLogs.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Logs exportés', 'success');
  };

  const clearLogs = () => {
    setDebugLogs([]);
    showToast('Logs effacés', 'info');
  };

  return (
    <div className="modal">
      <div className="panel" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h3 style={{margin:0}}>Édition des configurations</h3>
          <span style={{fontSize:11, color:'var(--muted)'}}>v1.0.0</span>
        </div>

        <div style={{display:'grid', gap:8}}>
          <div style={{
            padding: 12,
            background: 'rgba(74, 158, 255, 0.1)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            borderRadius: 6,
            fontSize: 13
          }}>
            <div style={{fontWeight: 600, marginBottom: 4}}>🌐 API Publisher Locale</div>
            <div style={{color: 'var(--muted)', fontSize: 12}}>
              URL: <code style={{
                background: 'var(--bg-secondary)',
                padding: '2px 6px',
                borderRadius: 3,
                fontFamily: 'monospace'
              }}>{apiUrl}</code>
            </div>
            <div style={{color: 'var(--muted)', fontSize: 11, marginTop: 4}}>
              L'API démarre automatiquement au lancement de l'application
            </div>
          </div>

          <div style={{marginTop: 8}}>
            <button 
              onClick={async ()=>{
                setTesting(true);
                try{
                  const res = await (window as any).electronAPI?.testConnection?.();
                  if(res?.ok){
                    showToast('Connexion réussie ! API accessible', 'success');
                  } else {
                    showToast(`Échec : ${res?.error || 'API locale non accessible'}`, 'error');
                  }
                }catch(e){
                  showToast('Erreur : API locale non accessible', 'error');
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
              {testing ? '⏳ Test en cours...' : '🔌 Tester la connexion à l\'API locale'}
            </button>
          </div>

          {/* Debug Mode Section */}
          <div style={{borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12}}>
            <div style={{marginBottom: 12}}>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none'}}>
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={toggleDebugMode}
                  style={{cursor: 'pointer'}}
                />
                <span style={{fontWeight: 600}}>🐛 Mode Debug</span>
              </label>
              <div style={{fontSize: 12, color: 'var(--muted)', marginTop: 4, marginLeft: 28}}>
                Enregistre toutes les requêtes/réponses API pour le débogage
              </div>
            </div>

            {debugMode && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                  <span style={{fontSize: 13, fontWeight: 600}}>
                    📋 Logs de débogage ({debugLogs.length})
                  </span>
                  <div style={{display: 'flex', gap: 4}}>
                    <button
                      onClick={exportLogs}
                      disabled={debugLogs.length === 0}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        opacity: debugLogs.length === 0 ? 0.5 : 1,
                        cursor: debugLogs.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      💾 Exporter
                    </button>
                    <button
                      onClick={clearLogs}
                      disabled={debugLogs.length === 0}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        opacity: debugLogs.length === 0 ? 0.5 : 1,
                        cursor: debugLogs.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      🗑️ Effacer
                    </button>
                  </div>
                </div>

                <div style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  background: 'var(--bg-main)',
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}>
                  {debugLogs.length === 0 ? (
                    <div style={{color: 'var(--muted)', textAlign: 'center', padding: 20}}>
                      Aucun log pour le moment. Effectuez une action pour voir les logs.
                    </div>
                  ) : (
                    debugLogs.map((log, idx) => (
                      <div key={idx} style={{marginBottom: 4, color: 'var(--text-main)'}}>
                        {log}
                      </div>
                    ))
                  )}
                </div>

                <div style={{
                  marginTop: 8,
                  padding: 8,
                  background: 'rgba(74, 158, 255, 0.1)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: 'var(--muted)'
                }}>
                  💡 Les logs sont également enregistrés dans le fichier <code style={{
                    background: 'var(--bg-main)',
                    padding: '2px 4px',
                    borderRadius: 2
                  }}>errors.log</code> à la racine du projet
                </div>
              </div>
            )}
          </div>

          <div style={{borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12}}>
            <div style={{marginBottom: 8, padding: 8, background: 'rgba(74, 158, 255, 0.1)', borderRadius: 4, fontSize: 13}}>
              <strong>💾 Export/Import complet</strong>
              <div style={{color: 'var(--muted)', fontSize: 12, marginTop: 4}}>
                Inclus : Config API, Templates personnalisés, Tags, Variables personnalisées, Traducteurs, Instructions sauvegardées
              </div>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'space-between'}}>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <button 
                onClick={async ()=>{
                  if(!confirm('⚠️ ATTENTION : Cette action va supprimer TOUTES vos données (config, templates, tags, traducteurs, instructions, historique, images). Cette action est irréversible. Continuer ?')) return;
                  try{
                    // Clear all localStorage
                    localStorage.clear();
                    // Delete all images via IPC
                    const images = await (window as any).electronAPI?.listImages?.();
                    if(images?.ok && images.files){
                      for(const file of images.files){
                        await (window as any).electronAPI?.deleteImage?.(file);
                      }
                    }
                    showToast('Application réinitialisée ! Rechargement...', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                  }catch(e){
                    showToast('Erreur lors de la réinitialisation', 'error');
                  }
                }}
                style={{background:'var(--danger)', color:'white'}}
              >
                🔄 Réinitialiser l'application
              </button>
              <button onClick={async ()=>{ 
                try{ 
                  // Export complet : templates + tags + instructions + traducteurs + variables personnalisées
                  const fullConfig = {
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
                    window.location.reload();
                  } else if(!res?.canceled) {
                    alert('❌ Erreur lors de l\'import');
                  }
                }catch(e){ 
                  alert('❌ Erreur import : ' + e); 
                } 
              }}>📥 Importer</button>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={onClose}>🚪 Fermer</button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
