import React from 'react';

interface SketchCardProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  rotation?: string;
  noPadding?: boolean;
  padding?: string;
  variant?: 'default' | 'sketchy';
}

export const SketchCard: React.FC<SketchCardProps> = ({
  children,
  className = '',
  color = 'bg-white dark:bg-white/10',
  rotation = '', // Default no rotation unless specified
  noPadding = false,
  padding,
  variant = 'default'
}) => {

  const radiusClass = variant === 'sketchy' ? 'rounded-sketchy' : 'rounded-2xl';
  const paddingClass = noPadding ? '' : (padding || 'p-6');

  return (
    <div
      className={`
        relative border-[3px] border-text-main dark:border-white/20 shadow-sketch transition-all duration-300
        ${color} 
        ${radiusClass}
        ${rotation}
        ${paddingClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
};