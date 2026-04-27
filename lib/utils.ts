import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(value?: bigint | number | null) {
  if (value === null || value === undefined) return '-';
  const size = typeof value === 'bigint' ? Number(value) : value;
  if (size === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(size) / Math.log(1024));
  const normalized = size / 1024 ** index;

  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)} ${units[index]}`;
}

export function truncateMiddle(value: string, start = 30, end = 20) {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}
