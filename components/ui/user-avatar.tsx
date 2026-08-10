import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function getInitials(name?: string | null, email?: string | null) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  const trimmedEmail = email?.trim();
  return trimmedEmail ? trimmedEmail.slice(0, 2).toUpperCase() : '?';
}

// Deterministic pick from the chart palette so a given user always gets the
// same color — a lightweight stand-in for a real avatar since there's no
// photo upload in the User model.
function getChartColorIndex(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 5;
  }
  return (Math.abs(hash) % 5) + 1;
}

export function UserAvatar({
  name,
  email,
  className
}: {
  name?: string | null;
  email?: string | null;
  className?: string;
}) {
  const initials = getInitials(name, email);
  const colorIndex = getChartColorIndex(name?.trim() || email?.trim() || '?');

  return (
    <Avatar className={cn('h-9 w-9', className)}>
      <AvatarFallback
        style={{
          backgroundColor: `hsl(var(--chart-${colorIndex}) / 0.15)`,
          color: `hsl(var(--chart-${colorIndex}))`
        }}
        className="text-xs font-semibold"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
