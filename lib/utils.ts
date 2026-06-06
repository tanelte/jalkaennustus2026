import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui canonical class-name helper.
 * Merges Tailwind classes while resolving conflicts (last-wins per utility).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
