import { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalScrollLock } from '../hooks/useModalScrollLock';

interface HelpCenterModalProps {
  onClose?: () => void;
}

type HelpSection = 'tags' | 'templates' | 'instructions' | 'history' | 'stats' | 'config' | 'shortcuts';

export default function HelpCenterModal({ onClose }: HelpCenterModalProps) {
  useEscapeKey(() => onClose?.(), true);
  useModalScrollLock();

  const [activeSection, setActiveSection] = useState<HelpSection>('tags');

  const sections = [
    { id: 'tags', icon: '🏷️', label: 'Tags' },
    { id: 'templates', icon: '📄', label: 'Templates' },
    { id: 'instructions', icon: '📋', label: 'Instructions' },
    { id: 'history', icon: '🕒', label: 'Historique' },
    { id: 'stats', icon: '📊', label: 'Statistiques' },
    { id: 'config', icon: '⚙️', label: 'Configuration' },
    { id: 'shortcuts', icon: '⌨️', label: 'Raccourcis' }
  ];

  return (
    <div className="modal">
      <div className="panel" onClick={e => e.stopPropagation()} style={{
        maxWidth: 1200,
        width: '95%',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        paddingBottom: 80 // espace pour le footer
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 16,
          borderBottom: '2px solid var(--border)'
        }}>
          <h3 style={{ margin: 0 }}>❓ Centre d'aide</h3>
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

        {/* Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: 20,
          flex: 1,
          minHeight: 0,
          marginTop: 16
        }}>
          {/* Navigation */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderRight: '1px solid var(--border)',
            paddingRight: 12
          }}>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as HelpSection)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: activeSection === section.id ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: activeSection === section.id ? 'white' : 'var(--text)',
                  fontSize: 14,
                  fontWeight: activeSection === section.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{
            overflowY: 'auto',
            paddingRight: 8
          }} className="styled-scrollbar">
            {activeSection === 'tags' && <TagsHelp />}
            {activeSection === 'templates' && <UnderConstruction section="Templates" />}
            {activeSection === 'instructions' && <UnderConstruction section="Instructions" />}
            {activeSection === 'history' && <UnderConstruction section="Historique" />}
            {activeSection === 'stats' && <UnderConstruction section="Statistiques" />}
            {activeSection === 'config' && <UnderConstruction section="Configuration" />}
            {activeSection === 'shortcuts' && <ShortcutsHelp />}
          </div>
        </div>
        {/* Footer avec bouton Fermer */}
        <div style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          background: 'var(--panel)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '16px 32px',
          zIndex: 10
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            Fermer le centre d'aide
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AIDE TAGS
// ============================================
function TagsHelp() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Introduction */}
      <section>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 18, color: 'var(--accent)' }}>
          🏷️ Qu'est-ce qu'un tag ?
        </h4>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>
          Les tags sont des étiquettes Discord que vous pouvez ajouter à vos publications.
          Ils permettent de catégoriser vos traductions (statut, type, traducteur, etc.).
        </p>
      </section>

      {/* Ouvrir la fenêtre */}
      <section style={{
        background: 'rgba(74, 158, 255, 0.1)',
        border: '1px solid rgba(74, 158, 255, 0.3)',
        borderRadius: 8,
        padding: 16
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#4a9eff' }}>
          📂 Ouvrir la gestion des tags
        </h4>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: 14,
          lineHeight: 1.6
        }}>
          <span>Pour accéder à la fenêtre de gestion des tags, cliquez sur ce bouton :</span>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'var(--panel)',
            border: '2px solid var(--accent)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'not-allowed',
            boxShadow: '0 4px 12px rgba(74, 158, 255, 0.3)',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: 18 }}>🏷️</span>
            <span>Gérer les tags</span>
          </div>
        </div>
      </section>

      {/* Onglets */}
      <section>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--accent)' }}>
          📑 Les deux onglets
        </h4>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{
            padding: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>📚</span>
              <strong style={{ color: '#4a9eff' }}>Mes traductions</strong>
            </div>
            <p style={{ fontSize: 13, margin: '0 0 10px 0', color: 'var(--muted)' }}>
              Vos tags personnels pour vos propres traductions. Vous pouvez créer des tags génériques et des tags traducteurs.
            </p>
            {/* Note importante pour Discord */}
            <div style={{
              fontSize: 12,
              padding: '8px 10px',
              background: 'rgba(74, 158, 255, 0.1)',
              borderRadius: 4,
              borderLeft: '3px solid #4a9eff',
              color: '#bddbff'
            }}>
              <strong>⚠️ Important :</strong> Les tags doivent d'abord exister sur <strong>Discord</strong>. C'est ce qui permet à l'application de récupérer leur ID unique.
            </div>
          </div>

          <div style={{
            padding: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🌟</span>
              <strong style={{ color: '#4a9eff' }}>Traductions Rory</strong>
            </div>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--muted)' }}>
              Tags réservés au développeur. Seuls les tags génériques sont disponibles (pas de tags traducteurs car vous publiez seul).
            </p>
          </div>
        </div>
      </section>

      {/* Créer un tag */}
      <section style={{
        background: 'rgba(74, 222, 128, 0.1)',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        borderRadius: 8,
        padding: 16
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#4ade80' }}>
          ➕ Créer un nouveau tag
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'start'
        }}>
          {/* Colonne GAUCHE : Étapes textuelles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                1️⃣ Cliquez sur "Ajouter un tag"
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: '#4a9eff',
                color: 'white',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'not-allowed',
                boxShadow: '0 2px 8px rgba(74, 158, 255, 0.4)'
              }}>
                <span>➕</span>
                <span>Ajouter un tag</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                3️⃣ Validez la création
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: '#4a9eff',
                color: 'white',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'not-allowed'
              }}>
                <span>➕</span>
                <span>Ajouter</span>
              </div>
            </div>
          </div>

          {/* Colonne DROITE : Visuel du formulaire */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              2️⃣ Remplissez le formulaire
            </div>
            <div style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              fontSize: 13
            }}>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--muted)', fontSize: 12 }}>Nom du tag *</strong>
                <div style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--muted)',
                  fontStyle: 'italic'
                }}>
                  ex: ✅ Terminé
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--muted)', fontSize: 12 }}>ID Discord *</strong>
                <div style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--muted)',
                  fontStyle: 'italic'
                }}>
                  ex: 1234567890
                </div>
              </div>
            </div>

            {/* Note sur la checkbox Traducteur */}
            <div style={{
              marginTop: 12,
              padding: 10,
              background: 'rgba(74, 158, 255, 0.1)',
              border: '1px solid rgba(74, 158, 255, 0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)'
            }}>
              📌 <strong>Note :</strong> Dans l'onglet "Mes traductions", vous pouvez cocher <strong>"👤 Traducteur"</strong> pour classer un tag comme traducteur. Cette option n'est pas disponible dans "Traductions Rory".
            </div>
          </div>
        </div>

        {/* Astuce en pleine largeur en dessous */}
        <div style={{
          marginTop: 20,
          padding: 12,
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--text)'
        }}>
          💡 <strong>Astuce :</strong> L'ID Discord se trouve dans les paramètres du tag sur Discord.
          Il est automatiquement associé au salon correspondant.
        </div>
      </section>

      {/* Gestion des tags (Modification & Suppression) */}
      <section style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--accent)' }}>
          ⚙️ Modifier ou Supprimer un tag
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'center'
        }}>
          {/* Gauche : Le Visuel unique */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              <div>
                <strong style={{ color: '#4a9eff', display: 'block', fontSize: 13 }}>✅ Terminé</strong>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>ID: 1234567890</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ padding: '4px 8px', background: 'rgba(74, 158, 255, 0.2)', border: '1px solid rgba(74, 158, 255, 0.4)', borderRadius: 4 }}>✏️</div>
                <div style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 4 }}>🗑️</div>
              </div>
            </div>
          </div>

          {/* Droite : Les explications groupées */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>Modifier :</span> Cliquez sur <strong>✏️</strong>, ajustez les infos et validez avec <strong>"✅ Enregistrer"</strong>.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Supprimer :</span> Cliquez sur <strong>🗑️</strong>. Une confirmation sera demandée.
            </div>
          </div>
        </div>

        {/* Note d'avertissement en bas */}
        <div style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderLeft: '3px solid #ef4444',
          borderRadius: '0 4px 4px 0',
          fontSize: 12,
          color: 'var(--text)'
        }}>
          <strong>⚠️ Attention :</strong> La suppression est définitive et irréversible.
        </div>
      </section>

      {/* Utiliser un tag */}
      <section style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 8,
        padding: 16
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#8b5cf6' }}>
          🎯 Utiliser un tag dans une publication
        </h4>

        <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
          Une fois vos tags créés, vous pouvez les ajouter à vos publications :
        </div>

        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          <li>Dans l'éditeur de contenu, trouvez le champ <strong>"Tags"</strong></li>
          <li>Cliquez dans le champ de recherche</li>
          <li>Sélectionnez un ou plusieurs tags dans la liste</li>
          <li>Les tags apparaîtront sous forme de badges bleus</li>
          <li>Cliquez sur <strong>✕</strong> pour retirer un tag</li>
        </ol>

        <div style={{
          marginTop: 16,
          padding: 12,
          background: 'rgba(74, 158, 255, 0.1)',
          border: '1px solid rgba(74, 158, 255, 0.3)',
          borderRadius: 6,
          fontSize: 12
        }}>
          💡 <strong>Conseil :</strong> Créez des tags pour organiser vos traductions par statut
          (Terminé, En cours, Abandonné), type (Automatique, Manuelle), ou traducteur.
        </div>
      </section>

      {/* Copier l'ID d'un tag */}
      <section>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--accent)' }}>
          📋 Copier l'ID d'un tag
        </h4>

        <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
          Pour copier rapidement l'ID d'un tag, cliquez sur le <strong>nom du tag</strong> (en bleu).
          L'ID sera copié dans votre presse-papier et une notification apparaîtra.
        </div>

        <div style={{
          padding: 12,
          background: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid rgba(74, 222, 128, 0.3)',
          borderRadius: 6,
          fontSize: 13
        }}>
          ✅ <strong>Pratique :</strong> Utile pour partager l'ID avec d'autres utilisateurs ou
          pour le noter ailleurs.
        </div>
      </section>
    </div>
  );
}

// ============================================
// AIDE RACCOURCIS CLAVIER
// ============================================
function ShortcutsHelp() {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: 'Ctrl + H', description: 'Ouvrir l\'historique des publications' },
        { keys: 'Ctrl + T', description: 'Basculer entre thème clair/sombre' },
      ]
    },
    {
      category: 'Édition',
      items: [
        { keys: 'Ctrl + Z', description: 'Annuler (Undo) dans le champ Synopsis' },
        { keys: 'Ctrl + Y', description: 'Refaire (Redo) dans le champ Synopsis' },
        { keys: 'Ctrl + S', description: 'Sauvegarder le template (modale Templates)' },
      ]
    },
    {
      category: 'Interface',
      items: [
        { keys: 'Échap', description: 'Fermer la modale active' },
      ]
    }
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h4 style={{ margin: '0 0 12px 0', fontSize: 18, color: 'var(--accent)' }}>
          ⌨️ Raccourcis clavier
        </h4>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>
          Utilisez ces raccourcis pour naviguer plus rapidement dans l'application.
        </p>
      </section>

      {shortcuts.map((section, idx) => (
        <section key={idx}>
          <h5 style={{
            margin: '0 0 12px 0',
            fontSize: 15,
            color: '#4a9eff',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 8
          }}>
            {section.category}
          </h5>
          <div style={{ display: 'grid', gap: 8 }}>
            {section.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 1fr',
                  gap: 16,
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6
                }}
              >
                <kbd style={{
                  display: 'inline-block',
                  padding: '6px 10px',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {item.keys}
                </kbd>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>
                  {item.description}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div style={{
        padding: 12,
        background: 'rgba(74, 158, 255, 0.1)',
        border: '1px solid rgba(74, 158, 255, 0.3)',
        borderRadius: 6,
        fontSize: 13,
        color: 'var(--text)'
      }}>
        💡 <strong>Astuce :</strong> D'autres raccourcis seront ajoutés au fur et à mesure
        des mises à jour de l'application.
      </div>
    </div>
  );
}

// ============================================
// EN CONSTRUCTION
// ============================================
function UnderConstruction({ section }: { section: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 20,
      padding: 40,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 64 }}>🚧</div>
      <h4 style={{ margin: 0, fontSize: 20, color: 'var(--accent)' }}>
        Section en construction
      </h4>
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 400 }}>
        L'aide pour la section <strong>{section}</strong> sera bientôt disponible.
        Revenez plus tard pour découvrir le guide complet !
      </p>
      <div style={{
        marginTop: 20,
        padding: 12,
        background: 'rgba(74, 158, 255, 0.1)',
        border: '1px solid rgba(74, 158, 255, 0.3)',
        borderRadius: 6,
        fontSize: 13
      }}>
        💡 En attendant, n'hésitez pas à explorer les autres sections disponibles.
      </div>
    </div>
  );
}
