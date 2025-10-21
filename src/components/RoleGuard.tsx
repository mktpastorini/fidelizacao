import React, { ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Navigate } from 'react-router-dom';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

type AllowedRole = 'superadmin' | 'admin' | 'gerente' | 'balcao' | 'garcom' | 'cozinha';

type RoleGuardProps = {
  allowedRoles: AllowedRole[];
  children: ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { userRole, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (!userRole) {
    // Se não houver função (deve ser tratado pelo AuthLayout, mas como fallback)
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  // Se o usuário não tiver a função permitida, exibe uma mensagem de erro
  return (
    <div className="p-8">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Sua função atual ({userRole}) não tem permissão para acessar esta página.
        </AlertDescription>
      </Alert>
    </div>
  );
}