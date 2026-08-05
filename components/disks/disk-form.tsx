'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { validateDiskFields, type DiskFieldErrors } from '@/lib/disk-validation';

type DiskStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED';

type ConnectedDiskOption = {
  rootPath: string;
  name: string;
  isRemovable: boolean;
};

type CreateDiskPayload = {
  code?: string;
  name: string;
  rootPath: string;
  description?: string | null;
  status?: DiskStatus;
};

type FieldErrors = DiskFieldErrors;

export function DiskForm() {
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connectedDisks, setConnectedDisks] = useState<ConnectedDiskOption[]>([]);
  const [selectedRootPath, setSelectedRootPath] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState<CreateDiskPayload>({
    code: '',
    name: '',
    rootPath: '',
    description: '',
    status: 'ACTIVE'
  });

  function fieldError(key: keyof FieldErrors) {
    return fieldErrors[key]?.[0];
  }

  function validate(): FieldErrors {
    return validateDiskFields(form);
  }

  async function loadConnectedDisks() {
    setLoadingDevices(true);

    try {
      const response = await fetch('/api/system/disks', {
        cache: 'no-store'
      });

      const payload = (await response.json().catch(() => [])) as
        | ConnectedDiskOption[]
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          !Array.isArray(payload) && payload.error
            ? payload.error
            : 'Impossible de charger les disques connectés.'
        );
      }

      const disks = Array.isArray(payload) ? payload : [];
      setConnectedDisks(disks);

      if (disks.length === 0) {
        toast.info('Aucun disque détecté', {
          description:
            'Tu peux toujours saisir un chemin racine manuellement.'
        });
      }
    } catch (error) {
      toast.error('Chargement impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer les disques connectés.'
      });
    } finally {
      setLoadingDevices(false);
    }
  }

  useEffect(() => {
    void loadConnectedDisks();
  }, []);

  const selectedDisk = useMemo(
    () =>
      connectedDisks.find((disk) => disk.rootPath === selectedRootPath) ?? null,
    [connectedDisks, selectedRootPath]
  );

  function updateField<K extends keyof CreateDiskPayload>(
    key: K,
    value: CreateDiskPayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));

    if (key in fieldErrors) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key as keyof FieldErrors];
        return next;
      });
    }
  }

  function handleSelectDisk(rootPath: string) {
    setSelectedRootPath(rootPath);

    const disk = connectedDisks.find((item) => item.rootPath === rootPath);

    setForm((current) => ({
      ...current,
      rootPath,
      name:
        current.name.trim().length > 0
          ? current.name
          : disk?.name || current.name
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      toast.error('Formulaire incomplet', {
        description: 'Corrige les champs indiqués en rouge.'
      });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/disks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: form.code?.trim() || undefined,
          name: form.name.trim(),
          rootPath: form.rootPath.trim(),
          description: form.description?.trim() || null,
          status: form.status
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?:
          | string
          | { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      };

      if (!response.ok) {
        let errorMessage = 'Impossible de créer le disque.';

        if (typeof payload.error === 'string') {
          errorMessage = payload.error;
        } else if (payload.error?.fieldErrors) {
          setFieldErrors(payload.error.fieldErrors as FieldErrors);
          errorMessage =
            Object.values(payload.error.fieldErrors).flat()[0] ||
            payload.error.formErrors?.[0] ||
            errorMessage;
        }

        throw new Error(errorMessage);
      }

      toast.success('Disque ajouté', {
        description: 'Le disque a été enregistré avec succès.'
      });

      setForm({
        code: '',
        name: '',
        rootPath: '',
        description: '',
        status: 'ACTIVE'
      });
      setSelectedRootPath('');

      window.location.reload();
    } catch (error) {
      toast.error('Création impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de créer le disque.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Ajouter un disque
        </CardTitle>
        <CardDescription>
          Choisis un disque connecté ou saisis un chemin manuellement.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Disques détectés</label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadConnectedDisks()}
                disabled={loadingDevices}
              >
                {loadingDevices ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualiser
              </Button>
            </div>

            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedRootPath}
              onChange={(e) => handleSelectDisk(e.target.value)}
            >
              <option value="">Sélectionner un disque connecté</option>
              {connectedDisks.map((disk) => (
                <option key={disk.rootPath} value={disk.rootPath}>
                  {disk.rootPath} — {disk.name}
                  {disk.isRemovable ? ' (amovible)' : ''}
                </option>
              ))}
            </select>

            {selectedDisk ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span>
                    Disque sélectionné : <strong>{selectedDisk.name}</strong>
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Code disque</label>
            <Input
              value={form.code ?? ''}
              onChange={(e) => updateField('code', e.target.value)}
              placeholder="Exemple : DB0004"
              aria-invalid={Boolean(fieldError('code'))}
              className={
                fieldError('code')
                  ? 'border-destructive focus-visible:ring-destructive'
                  : undefined
              }
            />
            {fieldError('code') ? (
              <p className="text-xs text-destructive">{fieldError('code')}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Laisse vide pour générer automatiquement le code.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nom <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Exemple : Disque Archive"
              aria-invalid={Boolean(fieldError('name'))}
              className={
                fieldError('name')
                  ? 'border-destructive focus-visible:ring-destructive'
                  : undefined
              }
            />
            {fieldError('name') ? (
              <p className="text-xs text-destructive">{fieldError('name')}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Chemin racine <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.rootPath}
              onChange={(e) => {
                setSelectedRootPath('');
                updateField('rootPath', e.target.value);
              }}
              placeholder="Exemple : F:\"
              aria-invalid={Boolean(fieldError('rootPath'))}
              className={
                fieldError('rootPath')
                  ? 'border-destructive focus-visible:ring-destructive'
                  : undefined
              }
            />
            {fieldError('rootPath') ? (
              <p className="text-xs text-destructive">
                {fieldError('rootPath')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ce champ est rempli automatiquement si tu sélectionnes un
                disque.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Description facultative"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) =>
                updateField('status', e.target.value as DiskStatus)
              }
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="DISCONNECTED">Non connecté</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {submitting ? 'Ajout...' : 'Ajouter le disque'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}