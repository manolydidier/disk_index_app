'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardDrive, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api-error';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type DiskStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED';

const initialState = {
  code: '',
  name: '',
  rootPath: '',
  description: '',
  status: 'ACTIVE' as DiskStatus
};

export function DiskForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubmitting) return;

    setProgress(12);

    const interval = setInterval(() => {
      setProgress((current) => {
        if (current < 70) return current + 10;
        if (current < 90) return current + 3;
        return current;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isSubmitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInlineError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/disks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          rootPath: form.rootPath.trim(),
          description: form.description.trim(),
          status: form.status
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            payload,
            "Impossible d'ajouter le disque. Vérifie les champs saisis."
          )
        );
      }

      setProgress(100);

      toast.success('Disque ajouté', {
        description: 'Le disque a bien été enregistré.'
      });

      setForm(initialState);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter le disque.";

      setInlineError(message);

      toast.error("Échec de l'ajout", {
        description: message
      });
    } finally {
      window.setTimeout(() => {
        setIsSubmitting(false);
        setProgress(0);
      }, 500);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Ajouter un disque
        </CardTitle>
        <CardDescription>
          Renseigne le disque à indexer. Le code peut être laissé vide pour être
          généré automatiquement.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code disque</Label>
            <Input
              id="code"
              placeholder="Ex. DB0001 ou laisser vide"
              value={form.code}
              onChange={(e) =>
                setForm((current) => ({ ...current, code: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              placeholder="Ex. Disque Archive 1"
              value={form.name}
              onChange={(e) =>
                setForm((current) => ({ ...current, name: e.target.value }))
              }
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rootPath">Chemin racine</Label>
            <Input
              id="rootPath"
              placeholder="Ex. E:\ ou D:\Archives"
              value={form.rootPath}
              onChange={(e) =>
                setForm((current) => ({ ...current, rootPath: e.target.value }))
              }
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Exemple Windows : <span className="font-mono">E:\</span> ou{' '}
              <span className="font-mono">D:\MesArchives</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={4}
              placeholder="Description optionnelle"
              value={form.description}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  description: e.target.value
                }))
              }
              disabled={isSubmitting}
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label>Statut</Label>
            <Select
              value={form.status}
              onValueChange={(value: DiskStatus) =>
                setForm((current) => ({ ...current, status: value }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="INACTIVE">Inactif</SelectItem>
                <SelectItem value="DISCONNECTED">Non connecté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSubmitting ? (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Enregistrement du disque en cours...
              </p>
            </div>
          ) : null}

          {inlineError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {inlineError}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ajout en cours...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter le disque
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}