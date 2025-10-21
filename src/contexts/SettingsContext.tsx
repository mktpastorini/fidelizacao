import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserSettings, UserRole } from '@/types/supabase';

type SettingsContextType = {
  settings: UserSettings | null;
  userRole: UserRole | null; // Adicionado userRole
  isLoading: boolean;
  refetch: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null); // Novo estado para a função
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. Buscar configurações
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Erro ao buscar configurações:", settingsError);
      }
      setSettings(settingsData);

      // 2. Buscar perfil (incluindo a função)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Erro ao buscar perfil:", profileError);
      }
      
      // Define a função, com 'garcom' como padrão se não for encontrada
      const role = profileData?.role || 'garcom';
      setUserRole(role as UserRole);

    } else {
        setSettings(null);
        setUserRole(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, userRole, isLoading, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}