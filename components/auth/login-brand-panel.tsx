import { Files, HardDrive, PieChart, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: HardDrive,
    title: 'Multi-disques',
    description: 'Serveur ou agents utilisateurs, tout au même endroit.'
  },
  {
    icon: PieChart,
    title: "Analyse d'espace",
    description: 'Répartition par type de fichier, en un coup d’œil.'
  },
  {
    icon: Files,
    title: 'Doublons',
    description: 'Retrouve et nettoie les fichiers en double.'
  },
  {
    icon: ShieldCheck,
    title: 'Accès par rôle',
    description: 'Chaque utilisateur ne voit que ses disques autorisés.'
  }
];

export function LoginBrandPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground',
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <div className="rounded-2xl bg-white/15 p-2.5">
          <HardDrive className="h-6 w-6" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold">Disk Indexer</p>
          <p className="text-xs text-primary-foreground/70">Gestion et indexation de disques</p>
        </div>
      </div>

      <div className="relative">
        <h2 className="text-2xl font-semibold leading-snug">
          Tous tes disques, indexés et surveillés en continu.
        </h2>

        <ul className="mt-8 space-y-5">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-white/15 p-1.5">
                <feature.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-sm text-primary-foreground/70">{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-primary-foreground/60">
        Automatisation, alertes et export inclus.
      </p>
    </div>
  );
}
