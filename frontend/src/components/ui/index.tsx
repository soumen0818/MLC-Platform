import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const getStyle = () => {
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
      case 'REFUNDED':
        return 'pill-danger';
      default:
        return 'pill-neutral';
    }
  };

  return (
    <span className={cn('pill', getStyle(), className)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'md', className, fullScreen }: LoadingSpinnerProps) {
  const sizeMap = { sm: 16, md: 24, lg: 40 };
  const s = sizeMap[size];

  const spinner = (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-3">
          {spinner}
          <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return spinner;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-[var(--color-text-muted)] mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card p-6 w-full max-w-md mx-4 animate-fade-in" style={{ boxShadow: 'var(--shadow-modal)' }}>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </button>
          <button
            className={cn('btn', variant === 'danger' ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <LoadingSpinner size="sm" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
