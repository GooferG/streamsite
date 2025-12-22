import { useState } from 'react';
import { Monitor, Keyboard, Mouse, Headphones, Mic, Camera, Cpu, Zap } from 'lucide-react';

export default function GearInteractive() {
  const [hoveredItem, setHoveredItem] = useState(null);

  // Gear data with specs
  const gearData = {
    monitor: {
      name: 'Main Monitor',
      brand: 'ASUS ROG Swift',
      model: 'PG279QM',
      specs: ['27" IPS', '240Hz', '1440p', 'G-SYNC'],
      price: '$699',
      icon: <Monitor size={24} />,
    },
    keyboard: {
      name: 'Gaming Keyboard',
      brand: 'Ducky',
      model: 'One 3 TKL',
      specs: ['Cherry MX Brown', 'RGB', 'TKL Layout'],
      price: '$139',
      icon: <Keyboard size={24} />,
    },
    mouse: {
      name: 'Gaming Mouse',
      brand: 'Logitech',
      model: 'G Pro X Superlight',
      specs: ['25K Sensor', 'Wireless', '63g Weight'],
      price: '$159',
      icon: <Mouse size={24} />,
    },
    headphones: {
      name: 'Headphones',
      brand: 'Audio-Technica',
      model: 'ATH-M50x',
      specs: ['Studio Quality', 'Closed-Back', '45mm Drivers'],
      price: '$149',
      icon: <Headphones size={24} />,
    },
    microphone: {
      name: 'Microphone',
      brand: 'Shure',
      model: 'SM7B',
      specs: ['XLR', 'Cardioid', 'Broadcast Quality'],
      price: '$399',
      icon: <Mic size={24} />,
    },
    camera: {
      name: 'Camera',
      brand: 'Sony',
      model: 'A7 III',
      specs: ['Full Frame', '24.2MP', '4K Video'],
      price: '$1,998',
      icon: <Camera size={24} />,
    },
    pc: {
      name: 'Gaming PC',
      brand: 'Custom Build',
      model: 'RTX 4090 Build',
      specs: ['RTX 4090', 'i9-13900K', '64GB RAM', '2TB NVMe'],
      price: '$4,500',
      icon: <Cpu size={24} />,
    },
  };

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              INTERACTIVE SETUP
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Hover over any item in the setup to see detailed specs
          </p>
        </header>

        {/* Interactive Desk Setup */}
        <div className="relative max-w-5xl mx-auto">
          {/* Info Card - Appears on hover */}
          {hoveredItem && (
            <div className="absolute top-4 right-4 z-20 w-80 p-6 bg-gradient-to-br from-zinc-900/95 to-emerald-950/95 border-2 border-emerald-500/50 rounded-xl backdrop-blur-xl shadow-2xl animate-fade-in">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400">
                  {gearData[hoveredItem].icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">
                    {gearData[hoveredItem].name}
                  </p>
                  <h3 className="text-xl font-black text-white">
                    {gearData[hoveredItem].brand}
                  </h3>
                  <p className="text-sm text-white/60">{gearData[hoveredItem].model}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {gearData[hoveredItem].specs.map((spec, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Zap size={12} className="text-purple-400" />
                    <span className="text-sm text-white/80">{spec}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
                  {gearData[hoveredItem].price}
                </p>
              </div>
            </div>
          )}

          {/* Desk Setup Container */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-gradient-to-br from-zinc-900/50 to-purple-900/50 backdrop-blur-sm">
            {/* Placeholder Image - Replace with your actual desk setup photo */}
            <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
              <p className="text-white/40 text-lg font-bold">
                [Your Desk Setup Photo Here]
              </p>
            </div>

            {/* SVG Overlay with Interactive Hotspots */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1920 1080"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Monitor Hotspot - Center top */}
              <rect
                x="660"
                y="100"
                width="600"
                height="400"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'monitor'
                    ? 'opacity-100 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-emerald-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('monitor')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* Keyboard Hotspot - Center bottom */}
              <rect
                x="660"
                y="720"
                width="600"
                height="180"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'keyboard'
                    ? 'opacity-100 text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-purple-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('keyboard')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* Mouse Hotspot - Bottom right */}
              <circle
                cx="1350"
                cy="820"
                r="80"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'mouse'
                    ? 'opacity-100 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-emerald-400/50'
                }`}
                onMouseEnter={() => setHoveredItem('mouse')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* Headphones Hotspot - Top left */}
              <rect
                x="100"
                y="150"
                width="200"
                height="250"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'headphones'
                    ? 'opacity-100 text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-purple-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('headphones')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* Microphone Hotspot - Left side */}
              <rect
                x="100"
                y="500"
                width="180"
                height="350"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'microphone'
                    ? 'opacity-100 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-emerald-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('microphone')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* Camera Hotspot - Top right */}
              <rect
                x="1400"
                y="200"
                width="300"
                height="200"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'camera'
                    ? 'opacity-100 text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-purple-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('camera')}
                onMouseLeave={() => setHoveredItem(null)}
              />

              {/* PC Hotspot - Bottom left */}
              <rect
                x="1550"
                y="600"
                width="280"
                height="400"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className={`pointer-events-auto cursor-pointer transition-all duration-300 ${
                  hoveredItem === 'pc'
                    ? 'opacity-100 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                    : 'opacity-0 hover:opacity-60 text-emerald-400/50'
                }`}
                rx="12"
                onMouseEnter={() => setHoveredItem('pc')}
                onMouseLeave={() => setHoveredItem(null)}
              />
            </svg>
          </div>

          {/* Instruction */}
          <div className="mt-6 text-center">
            <p className="text-white/40 text-sm">
              {hoveredItem ? (
                <span className="text-emerald-400 font-bold">
                  Viewing: {gearData[hoveredItem].name}
                </span>
              ) : (
                'Hover over the setup to explore the gear'
              )}
            </p>
          </div>
        </div>

        {/* Quick Reference Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Object.entries(gearData).map(([key, item]) => (
            <button
              key={key}
              onMouseEnter={() => setHoveredItem(key)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`p-4 rounded-xl transition-all duration-300 ${
                hoveredItem === key
                  ? 'bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border-2 border-emerald-500/50 scale-105'
                  : 'bg-white/5 border border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`text-white/60 ${hoveredItem === key ? 'text-emerald-400' : ''}`}>
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-white/60 text-center">
                  {item.name}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Instructions Card */}
        <div className="max-w-3xl mx-auto p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
          <h3 className="text-xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            How to Update with Your Setup
          </h3>
          <ol className="space-y-3 text-white/70">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">1.</span>
              <span>Take a high-quality photo of your desk setup (16:9 ratio recommended)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>Replace the placeholder image in the code with your photo</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>Adjust the SVG hotspot coordinates (x, y, width, height) to match your gear positions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">4.</span>
              <span>Update the gearData object with your actual gear specs and prices</span>
            </li>
          </ol>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
