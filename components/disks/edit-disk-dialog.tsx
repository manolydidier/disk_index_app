'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { validateDiskFields, type DiskFieldErrors } from '@/lib/disk-validation';

type EditableDisk = {
  id: string;
  code: string;
  name: string;
  rootPath: string;
  description: string | null;
};

type EditDiskForm = {
  code: string;
  name: string;
  rootPath: string;
  description: string;
};

type EditDiskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disk: EditableDisk;
};

function toForm(disk: EditableDisk): EditDiskForm {
  return {
    code: disk.code,
    name: disk.name,
    rootPath: disk.rootPath,
    description: disk.description ?? ''
  };
}

export function EditDiskDialog({ open, onOpenChange, disk }: EditDiskDialogProps) {
  const router = useRouter();

  const [form, setForm] = useState<EditDiskForm>(() => toForm(disk));
  const [fieldErrors, setFieldErrors] = useState<DiskFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(disk));
      setFieldErrors({});
    }
  }, [open, disk]);

  function fieldError(key: keyof DiskFieldErrors) {
    return fieldErrors[key]?.[0];
  }

  function updateField<K extends keyof EditDiskForm>(key: K, value: EditDiskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));

    if (key in fieldErrors) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key as keyof DiskFieldErrors];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateDiskFields(form);

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
      const response = await fetch(`/api/disks/${disk.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          rootPath: form.rootPath.trim(),
          description: form.description.trim() || null
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?:
          | string
          | { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      };

      if (!response.ok) {
        let errorMessage = 'Impossible de modifier le disque.';

        if (typeof payload.error === 'string') {
          errorMessage = payload.error;
        } else if (payload.error?.fieldErrors) {
          setFieldErrors(payload.error.fieldErrors as DiskFieldErrors);
          errorMessage =
            Object.values(payload.error.fieldErrors).flat()[0] ||
            payload.error.formErrors?.[0] ||
            errorMessage;
        }

        throw new Error(errorMessage);
      }

      toast.success('Disque modifié', {
        description: 'Les informations du disque ont été mises à jour.'
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error('Modification impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier le disque.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le disque</DialogTitle>
          <DialogDescription>
            Met à jour les informations de ce disque.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Code disque <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.code}
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
            ) : null}
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
              onChange={(e) => updateField('rootPath', e.target.value)}
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
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Description facultative"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" className="rounded-xl" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
