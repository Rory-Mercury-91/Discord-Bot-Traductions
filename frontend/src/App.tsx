import React, {useState, useEffect} from 'react';
import { AppProvider } from './state/appContext';
import { ToastProvider } from './components/ToastProvider';
import PublicationType from './components/PublicationType';
import ContentEditor from './components/ContentEditor';
import TemplatesModal from './components/TemplatesModal';
import TagsModal from './components/TagsModal';
import ConfigModal from './components/ConfigModal';
import InstructionsManagerModal from './components/InstructionsManagerModal';
import TraductorsModal from './components/TraductorsModal';
import HistoryModal from './components/HistoryModal';

export default function App(){
  const [openTemplates, setOpenTemplates] = useState(false);
  const [openTags, setOpenTags] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [openInstructions, setOpenInstructions] = useState(false);
  const [openTraductors, setOpenTraductors] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  
  // Theme management: dark by default
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return (saved === 'light' ? 'light' : 'dark') as 'dark' | 'light';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+H : Ouvrir Historique
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setOpenHistory(true);
      }
      // Ctrl+T : Basculer thème
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppProvider>
      <ToastProvider>
        <div className="app">
          <header className="app-header">
            <h1 style={{textAlign: 'center', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
              <span style={{fontSize: 24, fontFamily: 'Noto Color Emoji, Segoe UI Emoji, Apple Color Emoji'}}>🇫🇷</span>
              Générateur de publication
            </h1>
            <div style={{marginTop: 12}}>
              <h3 style={{margin: 0, marginBottom: 8, fontSize: 14, color: 'var(--muted)'}}>Configurations globale</h3>
              <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
                <button onClick={()=>setOpenTemplates(true)}>📁 Gérer les Templates</button>
                <button onClick={()=>setOpenTags(true)}>🏷️ Gérer les Tags</button>
                <button onClick={()=>setOpenTraductors(true)}>👥 Gérer les Traducteurs</button>
                <button onClick={()=>setOpenInstructions(true)}>📋 Gérer les Instructions</button>
                <button onClick={()=>setOpenHistory(true)}>📋 Historique</button>
                <button onClick={()=>setOpenConfig(true)}>⚙️ Configuration API</button>
                <button 
                  onClick={toggleTheme} 
                  style={{marginLeft: 'auto', fontSize: 20}}
                  title={theme === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit'}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </header>
          <main className="app-grid">
            <section className="editor">
              <PublicationType />
              <ContentEditor />
            </section>
          </main>

          {openTemplates && <TemplatesModal onClose={()=>setOpenTemplates(false)} />}
          {openTags && <TagsModal onClose={()=>setOpenTags(false)} />}
          {openConfig && <ConfigModal onClose={()=>setOpenConfig(false)} />}
          {openInstructions && <InstructionsManagerModal onClose={()=>setOpenInstructions(false)} />}
          {openTraductors && <TraductorsModal onClose={()=>setOpenTraductors(false)} />}
          {openHistory && <HistoryModal onClose={()=>setOpenHistory(false)} />}
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
