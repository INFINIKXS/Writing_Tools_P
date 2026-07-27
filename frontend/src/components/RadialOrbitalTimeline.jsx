import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap, Grid } from "lucide-react";

export default function RadialOrbitalTimeline({ timelineData, onNavigate, isHome = false }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [viewMode] = useState("orbital");
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [pulseEffect, setPulseEffect] = useState({});
  const [centerOffset] = useState({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  
  const containerRef = useRef(null);
  const orbitRef = useRef(null);
  const nodeRefs = useRef({});

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getResponsiveRadius = () => {
    if (windowWidth < 640) return 140;
    if (windowWidth < 1024) return 190;
    return 240;
  };

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer;

    if (autoRotate && !isHovered && viewMode === "orbital") {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }

    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate, isHovered, viewMode]);

  const centerViewOnNode = (nodeId) => {
    if (viewMode !== "orbital" || !nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index, total) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = getResponsiveRadius();
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.65,
      Math.min(1, 0.65 + 0.35 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId) => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? (currentItem.relatedIds || []) : [];
  };

  const isRelatedToActive = (itemId) => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "completed":
        return "text-slate-900 bg-slate-100 border-slate-300 dark:text-white dark:bg-black dark:border-white";
      case "in-progress":
        return "text-slate-900 bg-amber-100 border-amber-300 dark:text-black dark:bg-white dark:border-black";
      default:
        return "text-slate-700 bg-slate-100 border-slate-300 dark:text-white dark:bg-black/40 dark:border-white/50";
    }
  };

  const handleMouseMove = (e) => {
    if (!orbitRef.current) return;
    const rect = orbitRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.sqrt(
      Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
    );
    const maxRadius = getResponsiveRadius() + 50;

    if (distance <= maxRadius) {
      setIsHovered(true);
    } else {
      setIsHovered(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      className="w-full flex-1 flex flex-col items-center justify-center overflow-visible min-h-[380px] sm:min-h-[460px] md:min-h-[560px] relative mt-1 mb-6 py-0 rounded-xl"
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center min-h-[380px] sm:min-h-[460px] md:min-h-[560px] overflow-visible">
        <div
          className="absolute w-full h-full flex items-center justify-center overflow-visible"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-white/20 to-neutral-500/20 blur-xl animate-pulse pointer-events-none" />
          {!isHome ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (onNavigate) onNavigate('home');
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-md border border-slate-300 dark:border-white/40 shadow-xl dark:shadow-[0_0_40px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center z-10 hover:scale-105 transition-all duration-300 group cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-[radial-gradient(circle_at_35%_25%,_#ffffff_0%,_#d1d5db_25%,_#9ca3af_50%,_#4b5563_75%,_#1f2937_90%,_#000000_100%)] shadow-[inset_-3px_-3px_10px_rgba(0,0,0,0.8),_inset_0_0_15px_rgba(255,255,255,0.5),_0_0_20px_rgba(255,255,255,0.4)] border border-white/50 mb-1 sm:mb-2 transition-transform duration-500 group-hover:rotate-[15deg] group-hover:scale-110" />
              <span className="text-slate-900 dark:text-white text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-bold transition-colors">Home Page</span>
            </button>
          ) : (
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-md border border-slate-300 dark:border-white/40 shadow-xl dark:shadow-[0_0_40px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center z-10 cursor-pointer"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[radial-gradient(circle_at_35%_25%,_#ffffff_0%,_#d1d5db_25%,_#9ca3af_50%,_#4b5563_75%,_#1f2937_90%,_#000000_100%)] shadow-[inset_-4px_-4px_12px_rgba(0,0,0,0.8),_inset_0_0_20px_rgba(255,255,255,0.5),_0_0_30px_rgba(255,255,255,0.4)] border border-white/50" />
            </div>
          )}

          <div 
            style={{
              width: `${getResponsiveRadius() * 2}px`,
              height: `${getResponsiveRadius() * 2}px`
            }}
            className="absolute rounded-full border border-slate-400/80 dark:border-white/30 bg-slate-900/5 dark:bg-black/5 pointer-events-auto cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedItems({});
              setActiveNodeId(null);
              setPulseEffect({});
              setAutoRotate(true);
            }}
          ></div>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;
            const iconSize = windowWidth < 640 ? 18 : windowWidth < 1024 ? 20 : 24;

            const nodeStyle = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute transition-all duration-700 cursor-pointer flex flex-col items-center justify-center group"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div
                  className={`absolute rounded-full -inset-1 ${
                    isPulsing ? "animate-pulse duration-1000" : ""
                  }`}
                  style={{
                    background: `radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)`,
                    width: `${(item.energy || 80) * 0.4 + (windowWidth < 640 ? 40 : 56)}px`,
                    height: `${(item.energy || 80) * 0.4 + (windowWidth < 640 ? 40 : 56)}px`,
                    left: `-${((item.energy || 80) * 0.4) / 2}px`,
                    top: `-${((item.energy || 80) * 0.4) / 2}px`,
                  }}
                ></div>

                <div
                  className={`
                  w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center
                  ${
                    isExpanded
                      ? "bg-slate-900 text-white dark:bg-white dark:text-black"
                      : isRelated
                      ? "bg-slate-200 text-black dark:bg-white/50 dark:text-black"
                      : "bg-slate-900 text-white dark:bg-black/90 dark:text-white"
                  }
                  border-2 
                  ${
                    isExpanded
                      ? "border-slate-900 dark:border-white shadow-[0_0_25px_rgba(0,0,0,0.4)] dark:shadow-[0_0_25px_rgba(255,255,255,0.6)]"
                      : isRelated
                      ? "border-slate-900 dark:border-white animate-pulse"
                      : "border-slate-400 dark:border-white/50 shadow-md shadow-black/40 group-hover:border-slate-900 dark:group-hover:border-white group-hover:scale-110"
                  }
                  transition-all duration-300 transform
                  ${isExpanded ? "scale-150" : ""}
                `}
                >
                  <Icon size={iconSize} />
                </div>

                <div
                  className={`
                  absolute top-[44px] sm:top-[52px] md:top-[62px] whitespace-nowrap
                  text-xs sm:text-xs md:text-sm font-bold tracking-wide
                  transition-all duration-300 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]
                  ${isExpanded ? "text-slate-900 dark:text-white scale-125 font-extrabold" : "text-slate-900 dark:text-white/90 group-hover:text-slate-950 dark:group-hover:text-white"}
                `}
                >
                  {item.title}
                </div>

                {isExpanded && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 sm:w-72 max-h-[320px] sm:max-h-[350px] flex flex-col bg-white/95 dark:bg-black/90 rounded-2xl backdrop-blur-xl border border-slate-200 dark:border-white/30 shadow-2xl overflow-hidden text-left pointer-events-auto z-[300]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-slate-400 dark:bg-white/50 z-10" />
                    
                    {/* Header — Pinned Top */}
                    <div className="p-3.5 pb-2.5 border-b border-slate-100 dark:border-white/5 flex-none bg-white/50 dark:bg-black/50">
                      <div className="flex justify-between items-center">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${getStatusStyles(item.status)}`}>
                          {item.status === "completed"
                            ? "ACTIVE"
                            : item.status === "in-progress"
                            ? "PROCESSING"
                            : "STANDBY"}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-white/50 font-semibold">
                          {item.date}
                        </span>
                      </div>
                      <h3 className="font-bold leading-tight text-slate-900 dark:text-white text-sm mt-2">
                        {item.title}
                      </h3>
                    </div>

                    {/* Scrollable Middle Content */}
                    <div className="p-3.5 overflow-y-auto max-h-[190px] custom-scrollbar text-xs text-slate-600 dark:text-white/80 space-y-3 flex-1">
                      <p className="leading-relaxed text-[11px] sm:text-xs text-slate-700 dark:text-neutral-300">{item.content}</p>

                      {/* Included Tools (5 items) */}
                      {item.subFeatures && item.subFeatures.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-200 dark:border-white/10">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Grid size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                              INCLUDED TOOLS ({item.subFeatures.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.subFeatures.map((sub, idx) => {
                              const label = typeof sub === "string" ? sub : sub.label;
                              const toolId = typeof sub === "string" ? null : sub.toolId;
                              return (
                                <button
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.navId && onNavigate) {
                                      onNavigate(item.navId, toolId);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-800 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-white/15 hover:border-purple-400 dark:hover:border-purple-400 transition-all cursor-pointer text-left"
                                  title={`Launch ${label}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                  <span>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fixed Footer CTA — Pinned at bottom, ALWAYS 100% visible on presentation! */}
                    <div className="p-3 border-t border-slate-200/80 dark:border-white/10 flex-none bg-slate-50/90 dark:bg-neutral-950/90 backdrop-blur-md">
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (item.navId && onNavigate) {
                             onNavigate(item.navId);
                           }
                         }}
                         className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black font-extrabold text-xs rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer"
                      >
                         Launch Feature <ArrowRight size={13} className="ml-2" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
