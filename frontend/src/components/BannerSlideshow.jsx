import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * BannerSlideshow Component
 * A mobile-first banner slideshow with auto-play support
 * 
 * @param {Object} props
 * @param {Array} props.images - Array of { url, link, alt }
 * @param {boolean} props.autoPlay - Whether to auto-advance slides
 * @param {number} props.interval - Time between slides in ms
 * @param {string} props.className - Additional classes
 */
export default function BannerSlideshow({
  images = [],
  autoPlay = true,
  interval = 5000,
  className = "",
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  // Auto-play effect
  useEffect(() => {
    if (!autoPlay || images.length <= 1 || isHovered) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, images.length, isHovered, goToNext]);

  // Don't render if no images
  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const handleImageClick = () => {
    if (currentImage.link) {
      window.open(currentImage.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner Container - Mobile-first with 3:1 aspect ratio */}
      <div className="relative w-full aspect-[3/1] overflow-hidden rounded-xl bg-slate-800/50">
        {/* Image */}
        <img
          src={currentImage.url}
          alt={currentImage.alt || "Banner"}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            currentImage.link ? "cursor-pointer" : ""
          }`}
          onClick={handleImageClick}
        />

        {/* Navigation Arrows - Only show when multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 sm:opacity-100"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 sm:opacity-100"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </>
        )}

        {/* Indicator Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? "bg-white scale-110"
                    : "bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
