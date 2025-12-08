import React from 'react';

export default function StatCard({ number, label, icon }) {
  return (
    <div className="text-center group">
      <div className="flex items-center justify-center mb-3 text-emerald-400/60 group-hover:text-emerald-400 transition-colors">
        {icon}
      </div>
      <div className="text-4xl md:text-5xl font-black tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-purple-400">
        {number}
      </div>
      <div className="text-sm font-bold tracking-wider text-white/40">
        {label}
      </div>
    </div>
  );
}
