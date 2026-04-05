import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatShortDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function maskAccountNumber(account: string): string {
  if (account.length <= 4) return account;
  return '••••' + account.slice(-4);
}

export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'APPROVED':
    case 'ACTIVE':
    case 'CREDITED':
    case 'PAID':
      return 'pill-success';
    case 'PENDING':
    case 'SUBMITTED':
    case 'PROCESSING':
      return 'pill-warning';
    case 'FAILED':
    case 'REJECTED':
    case 'REVERSED':
      return 'pill-danger';
    default:
      return 'pill-neutral';
  }
}
