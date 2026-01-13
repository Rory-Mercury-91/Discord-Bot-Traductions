import React, { useState, useEffect } from 'react';
import { useApp } from '../state/appContext';

type ApiStatus = 'connected' | 'disconnected' | 'checking';

interface RateLimitInfo {
  remaining: number | null;
  limit: number | null;
  reset_in_seconds: number | null;
}

export default function ApiStatusBadge() {
  const { apiUrl } = useApp();
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const checkStatus = async () => {
    if (!apiUrl) {
      setStatus('disconnected');
      return;
    }

    try {
      setStatus('checking');
      const response = await fetch(`${apiUrl.replace('/api/forum-post', '')}/api/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus('connected');
        
        // Update rate limit info if available
        if (data.rate_limit) {
          setRateLimit(data.rate_limit);
        }
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      setStatus('disconnected');
    }
  };

  // Check status on mount and when apiUrl changes
  useEffect(() => {
    checkStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, [apiUrl]);

  const getBadgeColor = () => {
    switch (status) {
      case 'connected': return '#4ade80'; // green-400
      case 'disconnected': return '#ef4444'; // red-500
      case 'checking': return '#fbbf24'; // yellow-400
    }
  };

  const getBadgeText = () => {
    switch (status) {
      case 'connected': return 'Connecté';
      case 'disconnected': return 'Déconnecté';
      case 'checking': return 'Vérification...';
    }
  };

  const shouldWarnRateLimit = () => {
    if (!rateLimit || rateLimit.remaining === null) return false;
    return rateLimit.remaining < 5;
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 4,
          background: 'var(--bg-secondary)',
          border: `1px solid ${getBadgeColor()}`,
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
            background: getBadgeColor(),
            display: 'inline-block',
            animation: status === 'checking' ? 'pulse 2s infinite' : 'none'
          }}
        />
        <span style={{ fontWeight: 500 }}>{getBadgeText()}</span>
        {shouldWarnRateLimit() && (
          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️</span>
        )}
      </div>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            padding: 12,
            background: 'var(--bg-modal)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 250,
            zIndex: 1000,
            fontSize: 13
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Statut de l'API Discord
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>État:</span>
              <span style={{ fontWeight: 500, color: getBadgeColor() }}>
                {getBadgeText()}
              </span>
            </div>

            {status === 'connected' && rateLimit && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>
                    Rate Limiting
                  </div>
                </div>

                {rateLimit.remaining !== null && rateLimit.limit !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Requêtes:</span>
                    <span style={{ 
                      fontWeight: 500,
                      color: shouldWarnRateLimit() ? '#ef4444' : 'inherit'
                    }}>
                      {rateLimit.remaining} / {rateLimit.limit}
                    </span>
                  </div>
                )}

                {rateLimit.reset_in_seconds !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Reset dans:</span>
                    <span style={{ fontWeight: 500 }}>
                      {Math.floor(rateLimit.reset_in_seconds / 60)}m {rateLimit.reset_in_seconds % 60}s
                    </span>
                  </div>
                )}

                {shouldWarnRateLimit() && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderLeft: '3px solid #ef4444',
                      borderRadius: 4,
                      fontSize: 12
                    }}
                  >
                    ⚠️ Limite proche ! Ralentissez les publications.
                  </div>
                )}
              </>
            )}

            {status === 'disconnected' && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '3px solid #ef4444',
                  borderRadius: 4,
                  fontSize: 12
                }}
              >
                ⚠️ Impossible de joindre l'API. Vérifiez la configuration.
              </div>
            )}
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
