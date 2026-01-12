import React, {useState} from 'react';
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
              <h3 style={{margin: 0, marginBottom: 8, fontSize: 14, color: '#ccc'}}>Configurations globale</h3>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <button onClick={()=>setOpenHistory(true)}>📋 Historique</button>
                <button onClick={()=>setOpenTemplates(true)}>📁 Gérer les Templates</button>
                <button onClick={()=>setOpenTags(true)}>🏷️ Gérer les Tags</button>
                <button onClick={()=>setOpenTraductors(true)}>👥 Gérer les Traducteurs</button>
                <button onClick={()=>setOpenInstructions(true)}>📋 Gérer les Instructions</button>
                <button onClick={()=>setOpenConfig(true)}>⚙️ Configuration API</button>
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
