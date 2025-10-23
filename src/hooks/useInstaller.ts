import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

// Importa o conteúdo do schema.sql como uma string
import schemaSql from '../../supabase/schema.sql?raw';

export function useInstaller() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);

  // 1. Verifica o status da instalação
  const checkInstallationStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Tentativa de ler uma tabela essencial (profiles)
      // Se a tabela não existir, a requisição falhará com um erro RLS/PostgREST,
      // indicando que o esquema não foi aplicado.
      const { data, error } = await supabase.from('profiles').select('id').limit(1);

      if (error && error.code === '42P01') { // 42P01: relation "profiles" does not exist
        setIsInstalled(false);
        console.log("Instalação necessária: Tabela 'profiles' não encontrada.");
      } else if (error) {
        // Outros erros (ex: RLS, conexão) - assumimos que a instalação está OK, mas há um problema de permissão/conexão
        setIsInstalled(true);
        console.warn("Conexão Supabase OK, mas erro ao ler profiles (pode ser RLS):", error.message);
      } else {
        // Sucesso na leitura
        setIsInstalled(true);
        console.log("Instalação verificada: Banco de dados pronto.");
      }
    } catch (e) {
      console.error("Erro de verificação de instalação:", e);
      setIsInstalled(false); // Falha na conexão ou erro grave
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInstallationStatus();
  }, [checkInstallationStatus]);

  // 2. Executa a instalação do esquema
  const runInstallation = useCallback(async (installPassword: string) => {
    setIsInstalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-schema-migration', {
        body: { 
          schema_sql: schemaSql,
          install_password: installPassword,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Falha ao aplicar o esquema.");

      showSuccess(data.message);
      
      // Força a verificação após a migração
      await checkInstallationStatus(); 
      
    } catch (err: any) {
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o servidor de migração.";
      showError(errorMessage);
      setIsInstalled(false);
    } finally {
      setIsInstalling(false);
    }
  }, [checkInstallationStatus]);

  return {
    isInstalled,
    isLoading,
    isInstalling,
    runInstallation,
    checkInstallationStatus,
  };
}