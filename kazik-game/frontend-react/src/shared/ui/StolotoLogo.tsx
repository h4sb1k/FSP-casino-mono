export function StolotoLogo({ className = '' }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 290 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: '32px', width: 'auto', display: 'block', overflow: 'visible' }}
    >
      <defs>
        <mask id="c-cutout">
          <rect width="100%" height="100%" fill="white" />
          <path d="M 82 12 A 10 10 0 0 0 82 28" stroke="black" strokeWidth="13" strokeLinecap="round" fill="none" />
        </mask>
      </defs>

      {/* 4 Balls */}
      <circle cx="20" cy="20" r="14" fill="#FFCC00" />
      <circle cx="36" cy="20" r="14" fill="#E3000F" style={{ mixBlendMode: 'multiply' }} />
      <circle cx="52" cy="20" r="14" fill="#00B350" style={{ mixBlendMode: 'multiply' }} />
      <circle cx="68" cy="20" r="14" fill="#00A0E4" style={{ mixBlendMode: 'multiply' }} mask="url(#c-cutout)" />
      
      <g stroke="#0F1E32" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* С */}
        <path d="M 82 12 A 10 10 0 0 0 82 28" />
        {/* Т */}
        <path d="M 98 10 L 114 10 M 106 10 L 106 30" />
        {/* О */}
        <circle cx="139" cy="20" r="10" />
        {/* Л */}
        <path d="M 164 30 L 172 10 L 180 30" />
        {/* О */}
        <circle cx="205" cy="20" r="10" />
        {/* Т */}
        <path d="M 230 10 L 246 10 M 238 10 L 238 30" />
        {/* О */}
        <circle cx="271" cy="20" r="10" />
      </g>
    </svg>
  )
}
