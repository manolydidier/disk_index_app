'use client';

import { ScanSettings } from '@/lib/scan-settings';
import { Input } from '@/components/ui/input';

type ScanSettingsFormProps = {
  value: ScanSettings;
  onChange: (next: ScanSettings) => void;
  disabled?: boolean;
};

export function ScanSettingsForm({
  value,
  onChange,
  disabled = false
}: ScanSettingsFormProps) {
  function update<K extends keyof ScanSettings>(
    key: K,
    fieldValue: ScanSettings[K]
  ) {
    onChange({
      ...value,
      [key]: fieldValue
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type de scan</label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={value.scanType}
            onChange={(e) => update('scanType', e.target.value as ScanSettings['scanType'])}
            disabled={disabled}
          >
            <option value="DIFFERENTIAL">Différentiel</option>
            <option value="FULL">Complet</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Niveau maximum</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={value.maxDepth}
            onChange={(e) =>
              update('maxDepth', Math.max(1, Number.parseInt(e.target.value || '1', 10)))
            }
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            checked={value.excludeHidden}
            onChange={(e) => update('excludeHidden', e.target.checked)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium">Exclure les fichiers cachés</p>
            <p className="text-xs text-muted-foreground">
              Ignore les éléments cachés pendant le scan.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            checked={value.skipSystemFolders}
            onChange={(e) => update('skipSystemFolders', e.target.checked)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium">Ignorer les dossiers système</p>
            <p className="text-xs text-muted-foreground">
              Évite les dossiers protégés comme $RECYCLE.BIN ou System Volume Information.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            checked={value.followSymlinks}
            onChange={(e) => update('followSymlinks', e.target.checked)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium">Suivre les liens symboliques</p>
            <p className="text-xs text-muted-foreground">
              À laisser désactivé dans la plupart des cas.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            checked={value.saveActivity}
            onChange={(e) => update('saveActivity', e.target.checked)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium">Enregistrer les activités</p>
            <p className="text-xs text-muted-foreground">
              Conserve les changements détectés dans l’historique.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}