import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="space-y-3 border-b bg-muted/20">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="pt-6">
            <Skeleton className="h-80 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
