import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from '../translations';

interface UserProfile {
  id: string;
  full_name: string;
  phone?: string;
  age?: string;
  gender?: string;
  district?: string;
  trade?: string;
  experience_level?: string;
  skills?: string[];
  education?: string;
  work_preference?: string;
  language_preference?: string;
  onboarding_completed?: boolean;
  role?: 'candidate' | 'employer' | 'admin';
}

interface AuthContextProps {
  user: User | null;
  profile: UserProfile | null;
  language: string | null;
  isLoading: boolean;
  setLanguage: (lang: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: keyof typeof translations['en']) => string;
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  profile: null,
  language: null,
  isLoading: true,
  setLanguage: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
  t: (key) => translations['en'][key],
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [language, _setLanguage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setProfile(data);
        if (data.language_preference) {
          _setLanguage(data.language_preference);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  };

  const setLanguage = async (lang: string) => {
    if (lang === language) return; // Skip if same

    _setLanguage(lang);
    await AsyncStorage.setItem('language_preference', lang);
    
    // Sync to Supabase if logged in
    if (user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            language_preference: lang,
            updated_at: new Date() 
          });
        
        if (error) console.error('Error syncing language to Supabase:', error);
        
        // Also update local profile state
        if (profile) {
          setProfile({ ...profile, language_preference: lang });
        }
      } catch (err) {
        console.error('Failed to update language on server:', err);
      }
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    const newProfile = { ...profile, ...updates, id: user.id } as UserProfile;
    setProfile(newProfile);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          ...newProfile,
          updated_at: new Date(),
        });

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
    } catch (err) {
      console.error('Profile update failed:', err);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const t = (key: keyof typeof translations['en']) => {
    const lang = (language as Language) || 'en';
    return translations[lang][key] || translations['en'][key];
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Load language first
        const storedLang = await AsyncStorage.getItem('language_preference');
        if (mounted && storedLang) _setLanguage(storedLang);

        // 2. Check session
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };


    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      
      // Only update if user actually changed to prevent loops
      if (currentUser?.id !== user?.id) {
        setUser(currentUser);
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      language, 
      isLoading, 
      setLanguage, 
      updateProfile,
      refreshProfile,
      signOut,
      t
    }}>
      {children}
    </AuthContext.Provider>
  );
};
