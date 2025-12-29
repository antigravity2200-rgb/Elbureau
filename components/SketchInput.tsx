import React from 'react';

interface SketchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const SketchInput: React.FC<SketchInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full text-start">
      {label && (
        <label className="font-sketch text-xl font-bold ml-1 text-ink">
          {label}
        </label>
      )}
      <input 
        className={`
          w-full bg-white border-3 border-ink rounded-lg p-3 font-sans text-lg text-ink
          placeholder:text-gray-400
          focus:outline-none focus:ring-4 focus:ring-pop-yellow/50 focus:border-ink
          shadow-sketch-sm transition-all
          ${className}
        `}
        {...props}
      />
    </div>
  );
};