export const Logo = () => (
  <svg width="200" height="40" viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="y2k" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
    </defs>

    {/* ひらめき（インサイト）のキラキラマーク */}
    <path d="M 16 8 Q 16 18 26 18 Q 16 18 16 28 Q 16 18 6 18 Q 16 18 16 8 Z" fill="url(#y2k)" />
    <circle cx="28" cy="12" r="3" fill="#FDE68A" />

    {/* タイポグラフィ */}
    <text x="38" y="28" fontFamily="'Inter', system-ui, sans-serif" fontSize="22" fill="#FFFFFF">
      <tspan fontWeight="400" fill="rgba(255,255,255,0.7)" letterSpacing="-0.5">minimal</tspan>
      <tspan fontWeight="800" letterSpacing="0">QDA</tspan>
    </text>
  </svg>
);
