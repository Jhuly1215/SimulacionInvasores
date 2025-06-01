import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
  message?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message = 'Loading...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center py-6 ${className}`}>
      <Loader2 size={24} className="text-primary-600 animate-spin" />
      <p className="mt-2 text-sm text-gray-600">{message}</p>
    </div>
  );
};