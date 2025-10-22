import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserSettings, UserRole } from '@/types/supabase';

type SettingsContextType = {
  settings: UserSettings | null;
  userRole: UserRole | null;
  isLoading: boolean;
  refetch: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Função para buscar as configurações globais de fallback (Superadmin/Admin)
async function fetchGlobalSettings(supabaseClient: any): Promise<Partial<UserSettings>> {
  // 1. Encontra o ID de um Superadmin ou Admin
  const { data: adminProfile, error: adminProfileError } = await supabaseClient
    .from('profiles')
    .select('id')
    .in('role', ['superadmin', 'admin'])
    .limit(1)
    .maybeSingle(); // Usar maybeSingle

  if (adminProfileError || !adminProfile) {
    console.warn("Nenhum Superadmin/Admin encontrado para configurações globais.");
    return {};
  }

  // 2. Busca as configurações desse Admin
  const { data: adminSettings, error: adminSettingsError } = await supabaseClient
    .from('user_settings')
    .select('webhook_url, chegada_template_id, pagamento_template_id, aniversario_template_id, aniversario_horario, auto_add_item_enabled, default_produto_id, establishment_is_closed, daily_report_phone_number, auto_close_enabled, auto_close_time, menu_style, compreface_url, compreface_api_key, login_video_url')
    .eq('id', adminProfile.id)
    .maybeSingle(); // Usar maybeSingle
    
  if (adminSettingsError && adminSettingsError.code !== 'PGRST116') {
    console.error("Erro ao buscar configurações globais do Admin:", adminSettingsError);
    return {};
  }
  
  return adminSettings || {};
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 1. Buscar configurações globais de fallback
      const globalSettings = await fetchGlobalSettings(supabase);

      // 2. Buscar configurações pessoais do usuário logado
      const { data: personalSettingsData, error: personalSettingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Usar maybeSingle
      
      if (personalSettingsError && personalSettingsError.code !== 'PGRST116') {
        console.error("Erro ao buscar configurações pessoais:", personalSettingsError);
      }
      
      // 3. Buscar perfil (incluindo a função)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(); // Usar maybeSingle

      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Erro ao buscar perfil:", profileError);
      }
      
      const role = profileData?.role || 'garcom';
      setUserRole(role as UserRole);

      // 4. Mesclar: Global (fallback) + Pessoal (sobrescreve)
      
      const finalSettings: UserSettings = {
        // Herda todas as configurações globais
        ...globalSettings,
        // Sobrescreve com dados pessoais (ID, API Key, Câmera)
        id: user.id,
        api_key: personalSettingsData?.api_key || null,
        preferred_camera_device_id: personalSettingsData?.preferred_camera_device_id || null,
        
        // Garante que o menu_style seja herdado do global se o usuário não for admin/superadmin
        menu_style: (role === 'superadmin' || role === 'admin') 
          ? (personalSettingsData?.menu_style || globalSettings.menu_style || 'sidebar')
          : (globalSettings.menu_style || 'sidebar'),
          
        // Garante que o login_video_url seja herdado do global
        login_video_url: globalSettings.login_video_url || null,
        
        // Mantém os campos obrigatórios do tipo UserSettings
        webhook_url: globalSettings.webhook_url || null,
        chegada_template_id: globalSettings.chegada_template_id || null,
        pagamento_template_id: globalSettings.pagamento_template_id || null,
        
        // Campos opcionais
        aniversario_template_id: globalSettings.aniversario_template_id || null,
        aniversario_horario: globalSettings.aniversario_horario || null,
        auto_add_item_enabled: globalSettings.auto_add_item_enabled || false,
        default_produto_id: globalSettings.default_produto_id || null,
        establishment_is_closed: globalSettings.establishment_is_closed || false,
        daily_report_phone_number: globalSettings.daily_report_phone_number || null,
        auto_close_enabled: globalSettings.auto_close_enabled || false,
        auto_close_time: globalSettings.auto_close_time || null,
        compreface_url: globalSettings.compreface_url || null,
        compreface_api_key: globalSettings.compreface_api_key || null,
      } as UserSettings;


      setSettings(finalSettings);

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