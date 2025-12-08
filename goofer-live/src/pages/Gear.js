import React from 'react';

export default function GearPage() {
  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              GEAR USED ON STREAM
            </span>
          </h1>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-emerald-400">
              COMPUTERS
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-4">
              <ContentItem
                title="Gaming"
                description="Main PC specs:
								*
								*
								*"
              />
            </p>
            <p className="text-lg text-white/80 leading-relaxed">
              <ContentItem
                title="Second PC"
                description="Main PC specs:
								*
								*
								*"
              />
            </p>
          </div>

          <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-purple-400">
              RACING RIG
            </h2>
            <div className="space-y-4">
              <ContentItem
                title="Chassis"
                description="RIGMETAL Flagship Rig"
              />
              <ContentItem
                title="Monitors"
                description="3 32in 1440p 165hz LG IDS panels"
              />
              <ContentItem title="Lighting" description="Govee Light Setup." />
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-emerald-400">
              AUX ITEMS
            </h2>
            <div>
              <ContentItem title="Exercise" description="GoYouth Treadmil" />
              <ContentItem
                title="Audio"
                description='2 KALI 7" Monitor Speakers'
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentItem({ title, description }) {
  return (
    <div className="border-l-4 border-emerald-500/50 pl-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/70">{description}</p>
    </div>
  );
}
