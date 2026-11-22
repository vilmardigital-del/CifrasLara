interface SmartCifraLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'lg';
}

export function SmartCifraLogo({ variant = 'light', size = 'lg' }: SmartCifraLogoProps) {
  const strokeColor = variant === 'light' ? '#93C5FD' : '#1D4ED8';
  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const widthClass = size === 'lg' ? 'w-44' : 'w-28';
  const textSize = size === 'lg' ? 'text-4xl' : 'text-xl';

  return (
    <div className="inline-flex flex-col items-center select-none">
      <svg
        viewBox="0 0 180 22"
        className={`${widthClass} h-auto -mb-1`}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 17C44 19 72 5 112 5C138 5 157 10 172 13"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-display font-bold tracking-tight ${textSize} ${textColor} leading-none`}>
        cifrasLara
      </span>
    </div>
  );
}
