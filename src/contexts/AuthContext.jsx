import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Vérifier la session actuelle
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error('Erreur getSession:', error);
          setLoading(false);
          return;
        }

        setUser(session?.user ?? null);

        // Charger le profil en arrière-plan sans bloquer le chargement
        if (session?.user) {
          fetchUserProfile(session.user.email);
        }
      } catch (err) {
        console.error('Erreur auth:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Timeout de sécurité pour éviter un chargement infini (3 secondes)
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth timeout - forcing loading state to false');
        setLoading(false);
      }
    }, 3000);

    getSession();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        // Charger le profil en arrière-plan
        fetchUserProfile(session.user.email);
        // Mettre à jour last_login
        supabase
          .from('authorized_users')
          .update({ last_login: new Date().toISOString() })
          .eq('email', session.user.email);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (email) => {
    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.error('Erreur fetchUserProfile:', error);
        return null;
      }

      if (data) {
        setUserProfile(data);
      }
      return data;
    } catch (err) {
      console.error('Exception fetchUserProfile:', err);
      return null;
    }
  };

  const sendMagicLink = async (email) => {
    // Vérifier si l'email est autorisé
    const { data: authorizedUser, error: checkError } = await supabase
      .from('authorized_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (checkError || !authorizedUser) {
      return { error: { message: 'Cet email n\'est pas autorisé à accéder à l\'application.' } };
    }

    // Envoyer le magic link
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      // Toujours nettoyer l'état local, même en cas d'erreur
      setUser(null);
      setUserProfile(null);
      return { error };
    } catch (err) {
      console.error('Exception signOut:', err);
      // Nettoyer l'état local même en cas d'exception
      setUser(null);
      setUserProfile(null);
      return { error: err };
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'Non connecté' } };

    const { data, error } = await supabase
      .from('authorized_users')
      .update(updates)
      .eq('email', user.email)
      .select()
      .single();

    if (!error && data) {
      setUserProfile(data);
    }

    return { data, error };
  };

  const value = {
    user,
    userProfile,
    loading,
    sendMagicLink,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
