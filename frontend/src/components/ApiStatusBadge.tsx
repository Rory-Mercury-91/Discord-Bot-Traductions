import React, { useState, useEffect } from 'react';
import { useApp } from '../state/appContext';

// Possible states for the publisher connection.
type Status = 'connected' | 'disconnected' | 'checking';

/**
 * ApiStatusBadge displays a simple indicator showing whether the publisher
 * service is reachable on Koyeb.  It polls the `/api/publisher/health`
 * endpoint every 30 seconds (after an initial delay) and updates the
 * coloured badge accordingly.  When clicked, a dropdown reveals more
 * detailed information about the publisher.
 */
export default function ApiStatusBadge() {
  const { apiUrl } = useApp();
  const [status, setStatus] = useState<Status>('checking');
  const [showDetails, setShowDetails] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  /**
   * Compute the base URL from apiUrl.  We remove any `/api` suffix and
   * trailing slash so that endpoints are built relative to the root of
   * the service.  If apiUrl is undefined or malformed, we skip checks.
   */
  const getBaseUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin;
    } catch {
      return url.split('/api')[0] || url.replace(/\/$/, '');
    }
  };

  /**
   * Poll the publisher health endpoint and update the status.  A value
   * of `configured`, `ok` or `status === 'ok'` in the response is
   * considered a successful connection.
   */
  const checkStatus = async () => {
    if (!apiUrl) {
      return;
    }

    const base = getBaseUrl(apiUrl);
    const url = `${base}/api/publisher/health`;
    setStatus('checking');
    setLastCheck(Date.now());

    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          // On définit ici l'User-Agent personnalisé pour identifier ton App
          'User-Agent': 'Tauri-Desktop-App-User'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Vérification flexible du statut selon la réponse de l'API
        const ok = data && (data.configured || data.ok || data.status === 'ok');
        setStatus(ok ? 'connected' : 'disconnected');
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut:", error);
      setStatus('disconnected');
    }
  };

  // Effectuer un test au démarrage puis toutes les 15 minutes
  useEffect(() => {
    checkStatus(); // test immédiat au démarrage
    const interval = setInterval(checkStatus, 900000); // 15 minutes
    return () => {
      clearInterval(interval);
    };
  }, [apiUrl]);

  // Close the dropdown when clicking outside of it.
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

  // Utility to map status to a badge colour.
  const getColor = (st: Status) => {
    switch (st) {
      case 'connected':
        return '#4ade80';
      case 'disconnected':
        return '#ef4444';
      case 'checking':
      default:
        return '#fbbf24';
    }
  };

  // Utility to map status to a label.
  const getText = (st: Status) => {
    switch (st) {
      case 'connected':
        return 'Connecté';
      case 'disconnected':
        return 'Déconnecté';
      case 'checking':
      default:
        return 'Vérification…';
    }
  };

  // The colour and text used for the main badge.
  const mainColor = getColor(status);
  const mainText = status === 'connected'
    ? 'Publisher connecté'
    : status === 'checking'
      ? 'Vérification…'
      : 'Publisher déconnecté';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Badge button */}
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
            animation: status === 'checking' ? 'pulse 2s infinite' : 'none'
          }}
        />
        <span style={{ fontWeight: 500 }}>{mainText}</span>
      </div>

      {/* Dropdown details */}
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
            Statut du publisher
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500 }}>Publisher</span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: mainColor,
                display: 'inline-block',
                marginRight: 4,
                animation: status === 'checking' ? 'pulse 2s infinite' : 'none'
              }}
            />
            <span style={{ fontWeight: 500, color: mainColor }}>
              {getText(status)}
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Dernier test : {lastCheck ? new Date(lastCheck).toLocaleString('fr-FR') : 'Jamais'}
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