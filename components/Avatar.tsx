import React from 'react';

interface AvatarProps {
    src?: string;
    seed?: string; // For generating avatars if needed, or determining color
    alt?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    borderColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    seed = '',
    alt = 'Player Avatar',
    className = '',
    size = 'md',
    borderColor = 'border-text-main'
}) => {
    const sizeClasses = {
        sm: 'w-10 h-10 border-2',
        md: 'w-16 h-16 border-[3px]',
        lg: 'w-20 h-20 border-[3px]',
        xl: 'w-24 h-24 border-[3px]',
    };

    // If no src, we could show a fallback or a colored circle
    // design shows specific playful avatars. For now we assume src is passed or we show a placeholder.

    return (
        <div
            className={`
        relative rounded-full bg-gray-100 bg-cover bg-center shadow-sketch-sm
        ${borderColor} 
        ${sizeClasses[size]} 
        ${className}
      `}
            style={{ backgroundImage: src ? `url("${src}")` : undefined }}
            title={alt}
        >
            {!src && (
                <div className="flex items-center justify-center w-full h-full text-text-main/20">
                    <span className="material-symbols-outlined font-bold">person</span>
                </div>
            )}
        </div>
    );
};
