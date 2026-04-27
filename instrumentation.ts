export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  if (process.env.DISABLE_AUTOMATION_DAEMON === 'true') {
    console.log('[AUTOMATION] daemon désactivé par variable d’environnement');
    return;
  }

  setTimeout(() => {
    import('./lib/automation/daemon')
      .then(({ startAutomationDaemon }) => startAutomationDaemon())
      .catch((error) => {
        console.error('[AUTOMATION] impossible de démarrer le daemon:', error);
      });
  }, 1500);
}