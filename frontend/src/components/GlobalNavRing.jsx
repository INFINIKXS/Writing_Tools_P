import React, { useState } from 'react';
import { X } from 'lucide-react';
import RadialOrbitalTimeline from './RadialOrbitalTimeline';

export default function GlobalNavRing({ timelineData, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);

  // When clicking a feature, close the ring AND navigate.
  const handleNavigate = (id, toolId) => {
    setIsOpen(false);
    onNavigate(id, toolId);
  };


  return (
    <>
      {/* Mini trigger - 3D Orb */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-8 right-10 z-40 w-16 h-16 rounded-full bg-black/40 backdrop-blur-md border border-[#e6aa22]/30 shadow-[0_0_20px_rgba(212,175,55,0.15)] flex items-center justify-center cursor-pointer group transition-all duration-500 hover:scale-110 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] ${isOpen ? 'opacity-0 pointer-events-none scale-50' : 'opacity-100 scale-100'}`}
        title="Open Navigation"
      >
        <div className="absolute inset-0 rounded-full bg-[#d4af37]/10 blur-md animate-pulse pointer-events-none" />
        <div className="w-8 h-8 rounded-full bg-[radial-gradient(circle_at_35%_25%,_#fff8b0_0%,_#e6aa22_25%,_#d4af37_50%,_#7a5c1a_75%,_#4a3a10_90%,_#000000_100%)] shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.8),_inset_0_0_10px_rgba(212,175,55,0.5),_0_0_15px_rgba(212,175,55,0.4)] border border-[#fff8b0]/40 animate-[spin_6s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite]" />
      </button>

      {/* Expanded full-screen overlay */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      >
        {/* Backdrop blur overlay */}
        <div 
          className="absolute inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-xl"
        />{/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className={`absolute top-8 right-10 z-50 w-16 h-16 flex items-center justify-center rounded-full border border-slate-300 dark:border-white/10 bg-white/50 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:rotate-90 ${isOpen ? 'scale-100 opacity-100 delay-300' : 'scale-50 opacity-0'}`}
        >
          <X size={24} className="text-slate-900 dark:text-white" />
        </button>

        {/* Scaled Container for the timeline animation */}
        <div 
          className={`w-full h-full max-w-7xl flex flex-col items-center justify-center transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right ${
            isOpen ? 'scale-100 translate-y-0' : 'scale-[0.08] -translate-y-1/2 translate-x-1/2'
          }`}
        >
          <div className={`text-center z-10 mt-8 mb-4 transition-all duration-700 delay-200 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Command Hub</h2>
            <p className="text-slate-600 dark:text-neutral-400 font-medium tracking-[0.2em] uppercase text-[10px]">Select a module destination</p>
          </div>
          
          <div className="w-full flex-1 relative flex flex-col items-center justify-center pb-12 overflow-y-auto hidden-scrollbar">
             <RadialOrbitalTimeline timelineData={timelineData} onNavigate={handleNavigate} />
          </div>
        </div>
      </div>
    </>
  );
}
