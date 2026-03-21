import { useState } from 'react';

export default function DiseaseCard({ disease, borderColor, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className="card mb-3 border-l-4 transition-all"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-start gap-3">
        <span className="text-text-hint font-display text-lg">#{disease.rank}</span>
        <div className="flex-1">
          <h3 className="font-body font-bold text-lg text-text-primary">{disease.title}</h3>
          <p className={`text-text-secondary text-[15px] leading-relaxed mt-1 ${!expanded ? 'line-clamp-3' : ''}`}>
            {disease.description}
          </p>
          {!expanded && disease.description.length > 150 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-primary text-sm mt-1 hover:underline min-h-[48px]"
            >
              Read more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
