import React, { useState, useEffect, useCallback, useRef } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ArrowRight, Play, Pause } from "lucide-react";

export default function FeatureStackViewer({ features, onNavigate }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const sectionRef = useRef(null);
  
  // Native Intersection Observer via useInView hook - works in overflow-y-auto containers automatically
  const isInView = useInView(sectionRef, { once: false, amount: 0.15, margin: "0px 0px -50px 0px" });

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % features.length);
  }, [features.length]);

  // Scroll detection - captured to support scrollable divs
  useEffect(() => {
    let scrollTimeout;
    
    const handleScroll = () => {
      setIsScrolling(true);
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 500); // stopped scrolling after 500ms of no scroll events
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Auto-play timer - paused while scrolling, when not in view, or when manually paused
  useEffect(() => {
    if (isScrolling || !isInView || isManualPaused) return;

    const timer = setInterval(() => {
      handleNext();
    }, 4700); // 4.7 seconds per feature

    return () => clearInterval(timer);
  }, [currentIndex, features.length, handleNext, isScrolling, isInView, isManualPaused]);

  const handleFeatureClick = () => {
    if (onNavigate) {
      onNavigate(features[currentIndex].navId);
    }
  };

  const activeFeature = features[currentIndex];

  return (
    <motion.section 
      ref={sectionRef}
      initial={{ opacity: 0, y: 100 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
      transition={{ duration: 1.8, delay: isInView ? 0.3 : 0, ease: [0.25, 1, 0.5, 1] }}
      className="relative w-full py-24 md:py-32 bg-slate-50 dark:bg-black overflow-visible flex items-center justify-center pb-48 opacity-0 transition-colors duration-300"
    >
      <div className="container max-w-[1220px] w-full px-6 md:px-10 relative z-10 mx-auto">
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-8 w-full items-center"
        >
          
          {/* Left Side: Text Content & Controls */}
          <div className="flex flex-col gap-6 w-full max-w-[500px] mx-auto md:mx-0">
            {/* Active Text Area */}
            <div className="relative h-[250px] w-full justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center border border-black/10 dark:border-white/20 text-slate-900 dark:text-white shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                      <activeFeature.icon size={18} />
                    </div>
                    <span className="text-xs font-bold tracking-widest text-slate-500 dark:text-neutral-400 uppercase">
                      {activeFeature.category}
                    </span>
                  </div>
                  <h2 className="text-slate-900 dark:text-white text-4xl md:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
                    {activeFeature.title}
                  </h2>
                  <p className="text-slate-600 dark:text-neutral-400 text-base md:text-lg leading-relaxed mb-8">
                    {activeFeature.content}
                  </p>
                  
                  <button 
                    onClick={handleFeatureClick}
                    className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm hover:gap-4 transition-all w-fit bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-6 py-3 rounded-full border border-black/10 dark:border-white/10"
                  >
                    Launch Module <ArrowRight size={16} />
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Play/Pause & Indicators Bar */}
            <div className="flex items-center gap-6 z-20">
              <button
                onClick={() => setIsManualPaused(!isManualPaused)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
                aria-label={isManualPaused ? "Play slideshow" : "Pause slideshow"}
                title={isManualPaused ? "Play slideshow" : "Pause slideshow"}
              >
                {isManualPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
              </button>

              {/* Dot Indicators */}
              <div className="flex items-center gap-2">
                {features.map((feature, idx) => (
                  <button
                    key={feature.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                      currentIndex === idx 
                        ? "w-6 bg-white" 
                        : "w-2.5 bg-neutral-600 hover:bg-neutral-400"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Active feature index label */}
              <span className="text-neutral-500 font-mono text-xs select-none">
                {currentIndex + 1} / {features.length}
              </span>
            </div>
          </div>

          {/* Right Side: Card Stack */}
          <div 
            className="relative h-[400px] md:h-[500px] w-full max-w-[400px] md:max-w-[500px] mx-auto cursor-pointer group"
            onClick={handleNext}
          >
            {/* Render all cards, ordered by offset from currentIndex */}
            {features.map((feature, i) => {
              // Calculate how far this card is from the front
              // 0 = front, 1 = right behind, 2 = further behind
              let offset = (i - currentIndex) % features.length;
              if (offset < 0) offset += features.length;

              // Only render the front card and a few behind it for performance
              if (offset > 3) return null;

              const isFront = offset === 0;

              // CSS transforms based on offset
              // offset 0: front
              // offset 1: behind, peeking out left
              // offset 2: further behind, peeking more left
              
              const scale = 1 - offset * 0.1;
              const x = offset * -100; // Increased negative offset because cards are wider now
              const zIndex = 40 - offset * 10;
              const opacity = isFront ? 1 : Math.max(0, 1 - offset * 0.3);
              const blur = isFront ? 0 : offset * 2; // slight blur for depth

              return (
                <motion.div
                  key={feature.id}
                  className="absolute bottom-0 right-0 w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-[32px] overflow-hidden shadow-2xl border border-white/10"
                  animate={{
                    scale,
                    x,
                    zIndex,
                    opacity,
                    filter: `blur(${blur}px) brightness(${isFront ? 1 : 0.6})`,
                  }}
                  transition={{ 
                    duration: 0.6, 
                    ease: [0.23, 1, 0.32, 1] 
                  }}
                  style={{
                    transformOrigin: "center right", // Anchor scaling to the right so it shrinks leftwards
                  }}
                >
                  {/* Card Background Image */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${feature.imageSrc})` }}
                  >
                    {/* Dark gradient overlay so the card isn't completely flat */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                  </div>
                  
                  {/* Front card extra glow/highlight */}
                  {isFront && (
                    <div className="absolute inset-0 rounded-[32px] border border-white/20 shadow-[inset_0_0_40px_rgba(255,255,255,0.1)] pointer-events-none" />
                  )}
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    </motion.section>
  );
}
