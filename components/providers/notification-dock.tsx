'use client';

import { ActivityMonitor } from '@/components/providers/activity-monitor';
import { AutomationMonitor } from '@/components/providers/automation-monitor';

// Canal des alertes persistantes/actionnables (activité disque + automatisation).
// Les confirmations éphémères (succès/échec d'une action) restent sur les toasts sonner.
export function NotificationDock() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-[400px] flex-col gap-3 overflow-y-auto">
      <ActivityMonitor />
      <AutomationMonitor />
    </div>
  );
}
