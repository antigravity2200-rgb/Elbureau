import React from 'react';

interface SketchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  fullWidth?: boolean;
  sketchy?: boolean;
}

export const SketchButton: React.FC<SketchButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  sketchy = true,
  className = '',
  ...props
}) => {
  // Base classes with new design system + mobile touch optimization
  const baseClasses = `
    relative group flex items-center justify-center 
    font-display font-black tracking-wide uppercase 
    border-[3px] border-text-main filter 
    transition-all duration-150 ease-in-out
    touch-action-manipulation select-none
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
    active:translate-x-[1px] active:translate-y-[1px] active:shadow-sketch-active
  `;

  // Specific variants based on new colors
  const variants = {
    primary: "bg-primary text-text-main shadow-sketch hover:shadow-sketch-hover hover:-rotate-1",
    secondary: "bg-white dark:bg-white/5 text-text-main dark:text-white shadow-sketch hover:bg-gray-50 hover:shadow-sketch-hover hover:rotate-1",
    danger: "bg-pop-red text-white shadow-sketch hover:shadow-sketch-hover hover:-rotate-1",
    success: "bg-pop-green text-text-main shadow-sketch hover:shadow-sketch-hover hover:rotate-1",
    ghost: "bg-transparent border-transparent shadow-none hover:bg-black/5 dark:hover:bg-white/10 active:none",
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const roundedClass = sketchy ? 'rounded-sketchy' : 'rounded-xl';
  const paddingClass = 'py-3 px-6 md:py-4 md:px-8';

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${widthClass} ${roundedClass} ${paddingClass} ${className}`}
      {...props}
    >
      {/* Optional: Add inner texture or pattern overlay if needed, currently kept simple */}
      {children}
    </button>
  );
};