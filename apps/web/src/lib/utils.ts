import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'PPpp')
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getLogLevelColor(level: string) {
  switch (level) {
    case 'info':
      return 'bg-blue-500'
    case 'warn':
      return 'bg-yellow-500'
    case 'error':
      return 'bg-red-500'
    case 'critical':
      return 'bg-red-700'
    default:
      return 'bg-gray-500'
  }
}
