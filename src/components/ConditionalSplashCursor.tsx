import { useSettings } from '@/contexts/SettingsContext';
import { SplashCursor } from './SplashCursor';

export function ConditionalSplashCursor() {
  const { settings } = useSettings();

  // Renderiza o efeito apenas se a configuração estiver habilitada (ou se ainda não foi definida, padrão para true)
  if (settings?.splash_cursor_enabled ?? true) {
    return (
      <SplashCursor
        SIM_RESOLUTION={128}
        DYE_RESOLUTION={1440}
        CAPTURE_RESOLUTION={512}
        DENSITY_DISSIPATION={3.5}
        VELOCITY_DISSIPATION={2}
        PRESSURE={0.1}
        PRESSURE_ITERATIONS={20}
        CURL={3}
        SPLAT_RADIUS={0.2}
        SPLAT_FORCE={6000}
        SHADING={true}
        COLOR_UPDATE_SPEED={10}
        BACK_COLOR={{ r: 0.5, g: 0, b: 0 }}
        TRANSPARENT={true}
      />
    );
  }

  return null;
}