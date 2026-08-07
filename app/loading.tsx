import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border px-6 py-24 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement...
    </div>
  );
}
