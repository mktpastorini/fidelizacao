import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";

async function fetchSuperadminId(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('get-superadmin-id');
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || "Falha ao buscar Superadmin ID.");
  return data.superadmin_id;
}

export function useSuperadminId() {
  const { userRole } = useSettings();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["superadminId"],
    queryFn: fetchSuperadminId,
    // Apenas Superadmin, Admin e Gerente precisam deste ID para configurações globais
    enabled: !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole),
    staleTime: Infinity, // O ID do Superadmin não deve mudar
  });

  return { superadminId: data, isLoadingSuperadminId: isLoading, errorSuperadminId: error };
}