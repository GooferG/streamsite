import React from 'react';

export default function SocialButton({ icon, label, color, href }) {
  const colors = {
    purple:
      'hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-400',
    red: 'hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400',
    blue: 'hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-400',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`px-6 py-3 border border-white/10 rounded-lg backdrop-blur-sm transition-all duration-300 flex items-center gap-2 ${colors[color]}`}
    >
      {icon}
      <span className="font-bold text-sm tracking-wider">{label}</span>
    </a>
  );
}
