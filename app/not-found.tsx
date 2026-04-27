export default function NotFound() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <h2 className="text-xl font-semibold">Ressource introuvable</h2>
      <p className="mt-2 text-sm text-muted-foreground">Le disque demandé n'existe pas ou a été supprimé.</p>
    </div>
  );
}
