import { useRef } from 'react';
import HospitalCard from './HospitalCard';

export default function HospitalCarousel({ hospitals, onBookAmbulance }) {
  const scrollRef = useRef(null);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hospitals.map((h) => (
          <HospitalCard key={h.id} hospital={h} onBookAmbulance={onBookAmbulance} />
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-2">
        {hospitals.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              scrollRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }}
            className="w-2 h-2 rounded-full bg-border hover:bg-primary transition-colors"
            aria-label={`Go to hospital ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
