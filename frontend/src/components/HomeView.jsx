import React from 'react';
import RadialOrbitalTimeline from './RadialOrbitalTimeline';
import FeatureStackViewer from './FeatureStackViewer';
import Footer from './Footer';
import { featureTimelineData } from '../data/features';

export default function HomeView({ onNavigate, onOpenCookieModal }) {

  return (
    <div className="overflow-y-auto flex-1 min-h-0 hidden-scrollbar flex flex-col relative h-full bg-slate-50 dark:bg-black items-center pt-1 sm:pt-2 md:pt-3 pb-0 transition-colors duration-300">
      
      {/* Welcome Message */}
      <div className="text-center z-10 flex-none animate-fade-in-up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Welcome back.</h2>
        <p className="text-slate-500 dark:text-neutral-400 font-medium tracking-[0.2em] uppercase text-[9px] sm:text-[10px]">Select a specialized module to begin</p>
      </div>

      {/* Feature Selector Timeline */}
      <RadialOrbitalTimeline timelineData={featureTimelineData} onNavigate={onNavigate} isHome={true} />

      {/* Dynamic Feature Stack Carousel */}
      <FeatureStackViewer features={featureTimelineData} onNavigate={onNavigate} />

      {/* Footer */}
      <Footer onNavigate={onNavigate} onOpenCookieModal={onOpenCookieModal} />
    </div>
  );
}
