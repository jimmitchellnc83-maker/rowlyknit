import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

type ModalSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

interface ModalShellProps {
  titleId: string;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  children: ReactNode;
}

export default function ModalShell({
  titleId,
  title,
  subtitle,
  size = 'sm',
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto ${SIZE_CLASSES[size]}`}
      >
        <div className="p-6 border-b border-gray-200">
          <h2
            id={titleId}
            className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} font-bold text-gray-900`}
          >
            {title}
          </h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
