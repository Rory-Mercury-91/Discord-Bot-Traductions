import React, { useState, useEffect } from 'react';
import { useApp } from '../state/appContext';


type BotStatus = 'connected' | 'disconnected' | 'checking';

interface BotInfo {
  name: string;
  url: string;
  status: BotStatus;
}

// Endpoint definitions will be constructed dynamically from the configured API
// base URL.  Bots run on Koyeb and expose `/api/status` for Discord bots and
// `/api/publisher/health` for the publisher.

export default function ApiStatusBadge() {
  const { apiUrl } = useApp();
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const checkStatus = async () => {
    if (!apiUrl) {
      return;
    }
    // Build endpoints from the API base URL, trimming any trailing slash
    const normalized = apiUrl.replace(/\/$/, '');
    const endpoints = [
      { name: 'Bots', url: `${normalized}/api/status` },
      { name: 'Publisher', url: `${normalized}/api/publisher/health` }
    ];
    // Initialise status as checking
    setBots(endpoints.map(b => ({ ...b, status: 'checking' as BotStatus })));
    const results: BotInfo[] = await Promise.all(
      endpoints.map(async (bot) => {
        try {
          const response = await fetch(bot.url, { method: 'GET' });
          if (response.ok) {
            const data = await response.json();
            if (bot.name === 'Bots') {
              const connected = data && data.bots && data.bots.server1 && data.bots.server2;
              return { ...bot, status: connected ? 'connected' : 'disconnected' };
            }
            if (bot.name === 'Publisher') {
              return { ...bot, status: data && data.configured ? 'connected' : 'disconnected' };
            }
          }
          return { ...bot, status: 'disconnected' };
        } catch {
          return { ...bot, status: 'disconnected' };
        }
      })
    );
    setBots(results);
  };

  // Check status on mount and whenever the API URL changes.  We wait a few
  // seconds before the first check and then poll every 30 seconds.
  useEffect(() => {
    const timer = setTimeout(() => {
      checkStatus();
    }, 3000);
    const interval = setInterval(checkStatus, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [apiUrl]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    };

    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetails]);


  const getBadgeColor = (status: BotStatus) => {
    switch (status) {
      case 'connected': return '#4ade80'; // green-400
      case 'disconnected': return '#ef4444'; // red-500
      case 'checking': return '#fbbf24'; // yellow-400
    }
  };

  const getBadgeText = (status: BotStatus) => {
    switch (status) {
      case 'connected': return 'Connecté';
      case 'disconnected': return 'Déconnecté';
      case 'checking': return 'Vérification...';
    }
  };

  // Fonction de warning rate limit désactivée (plus de rateLimit dans la version multi-bots)

  // Affichage badge principal : si tous connectés, vert, sinon rouge ou jaune si en vérification
  const allConnected = bots.every(b => b.status === 'connected');
  const anyChecking = bots.some(b => b.status === 'checking');
  const mainColor = allConnected ? '#4ade80' : anyChecking ? '#fbbf24' : '#ef4444';
  const mainText = allConnected ? 'Tous connectés' : anyChecking ? 'Vérification...' : 'Un ou plusieurs bots déconnectés';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 4,
          background: 'var(--bg-secondary)',
          border: `1px solid ${mainColor}`,
          cursor: 'pointer',
          fontSize: 12,
          userSelect: 'none'
        }}
        title="Cliquer pour voir les détails"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: mainColor,
            display: 'inline-block',
            animation: anyChecking ? 'pulse 2s infinite' : 'none'
          }}
        />
        <span style={{ fontWeight: 500 }}>{mainText}</span>
      </div>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            padding: 12,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 250,
            zIndex: 1000,
            fontSize: 13,
            backdropFilter: 'blur(10px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Statut des bots Discord
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {bots.map(bot => (
              <div key={bot.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{bot.name}</span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: getBadgeColor(bot.status),
                    display: 'inline-block',
                    marginRight: 4,
                    animation: bot.status === 'checking' ? 'pulse 2s infinite' : 'none'
                  }}
                />
                <span style={{ fontWeight: 500, color: getBadgeColor(bot.status) }}>{getBadgeText(bot.status)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={checkStatus}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '6px 12px',
              fontSize: 12
            }}
          >
            🔄 Actualiser
          </button>
          <button
            onClick={() => setShowDetails(false)}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '6px 12px',
              fontSize: 12,
              background: 'transparent',
              border: '1px solid var(--border)'
            }}
          >
            Fermer
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
