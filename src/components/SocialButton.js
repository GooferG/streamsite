import React from 'react';

export default function SocialButton({ icon, label, color, href }) {
  const colors = {
    purple:
      'bg-purple-gamba/10 border-purple-gamba/30 text-purple-bright hover:bg-purple-gamba/20 hover:border-purple-gamba/60 hover:text-purple-300',
    red: 'bg-red-destructive/10 border-red-destructive/30 text-red-destructive hover:bg-red-destructive/20 hover:border-red-destructive/60 hover:text-red-destructive',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/60 hover:text-blue-300',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`px-6 py-3 border rounded-lg backdrop-blur-sm transition-all duration-300 flex items-center gap-2 ${colors[color]}`}
    >
      {icon}
      <span className="font-bold text-sm tracking-wider">{label}</span>
    </a>
  );
}
