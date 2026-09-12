import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  subtitle,
}) => {
  const sizeMap = {
    sm: { img: 'w-7 h-7', text: 'text-base', sub: 'text-[10px]' },
    md: { img: 'w-10 h-10', text: 'text-xl', sub: 'text-xs' },
    lg: { img: 'w-14 h-14', text: 'text-2xl', sub: 'text-sm' },
    xl: { img: 'w-20 h-20', text: 'text-4xl', sub: 'text-base' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-1.5 sm:gap-3 select-none min-w-0 ${className}`}>
      <div
        className={`${currentSize.img} relative rounded-2xl overflow-hidden flex items-center justify-center p-0.5 bg-gradient-to-tr from-rose-600 via-pink-600 to-rose-400 shadow-md shadow-rose-600/25 shrink-0`}
      >
        <img
          src="/logo.png"
          alt="Lovemeetly Logo"
          className="w-full h-full object-cover rounded-[14px]"
          onError={(e) => {
            // Fallback to SVG if image loading has issues
            (e.target as HTMLImageElement).src = '/logo.svg';
          }}
        />
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className={`font-bold ${currentSize.text} text-stone-100 tracking-tight font-serif whitespace-nowrap`}>
              Lovemeet<span className="text-rose-500 font-sans font-extrabold">ly</span>
            </span>
            <span className="hidden min-[380px]:inline text-[9px] uppercase font-semibold px-2 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-full tracking-wider whitespace-nowrap">
              Global
            </span>
          </div>
          {subtitle && (
            <p className={`${currentSize.sub} text-stone-400 leading-tight`}>{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
};
