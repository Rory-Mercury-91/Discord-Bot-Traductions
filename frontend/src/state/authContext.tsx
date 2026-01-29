import type { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';

export type Profile = {
  id: string;
  pseudo: string;
  discord_id: string;
  is_master_admin?: boolean;
  created_at?: string;
  updated_at?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { pseudo?: string; discord_id?: string }) => Promise<{ error?: { message: string } }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const sb = getSupabase();

  const fetchProfile = async (userId: string) => {
    if (!sb) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    const p = await fetchProfile(user.id);
    setProfile(p ?? null);
  };

  useEffect(() => {
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchProfile(session.user.id).then((p) => setProfile(p ?? null));
      }
      setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchProfile(session.user.id).then((p) => setProfile(p ?? null));
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [sb]);

  const signUp = async (email: string, password: string) => {
    if (!sb) return { error: { message: 'Supabase non configuré' } };
    const { error } = await sb.auth.signUp({ email, password });
    return { error: error ? { message: error.message } : undefined };
  };

  const signIn = async (email: string, password: string) => {
    if (!sb) return { error: { message: 'Supabase non configuré' } };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error ? { message: error.message } : undefined };
  };

  const signOut = async () => {
    if (sb) await sb.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (data: { pseudo?: string; discord_id?: string }) => {
    if (!sb || !user?.id) return { error: { message: 'Non connecté' } };
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.pseudo !== undefined) row.pseudo = data.pseudo;
    if (data.discord_id !== undefined) row.discord_id = data.discord_id;
    const { error } = await sb.from('profiles').upsert({ id: user.id, ...row }, { onConflict: 'id' });
    if (!error) await refreshProfile();
    return { error: error ? { message: error.message } : undefined };
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
