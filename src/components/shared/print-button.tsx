'use client';

interface PrintButtonProps {
  className?: string;
  label?: string;
}

export function PrintButton({ className = 'px-3 py-1 bg-gray-100 border text-sm rounded ml-auto', label = 'Print' }: PrintButtonProps) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
