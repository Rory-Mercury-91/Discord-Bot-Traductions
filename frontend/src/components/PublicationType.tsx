import React from 'react';
import { useApp } from '../state/appContext';

export default function PublicationType(){
  const { templates, currentTemplateIdx, setCurrentTemplateIdx } = useApp();

  return (
    <div>
      <h4>Types de publication</h4>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        {templates.map((tpl, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentTemplateIdx(idx)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: currentTemplateIdx === idx ? 600 : 400,
              background: currentTemplateIdx === idx ? 'var(--accent)' : 'var(--panel)',
              color: currentTemplateIdx === idx ? 'white' : 'var(--text)',
              border: `1px solid ${currentTemplateIdx === idx ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  );
}
