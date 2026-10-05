import React, { useEffect } from 'react';

export default function GrainOverlay() {
  const canvasRef = React.useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Read back once (toDataURL): a CPU canvas skips the GPU readback.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = 200;
    canvas.height = 200;

    function generateNoise() {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    }

    generateNoise();

    const dataURL = canvas.toDataURL();
    const overlay = document.getElementById('grain-overlay');
    if (overlay) {
      overlay.style.backgroundImage = `url(${dataURL})`;
    }
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* The drift is a class, so prefers-reduced-motion switches it off (DESIGN.md: Grain Overlay). */}
      <div
        id="grain-overlay"
        className="fixed inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay motion-safe:animate-[grain_8s_steps(10)_infinite]"
        style={{ backgroundSize: '200px 200px' }}
      />
    </>
  );
}
