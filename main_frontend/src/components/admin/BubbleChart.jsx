import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const COLORS = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#3498DB', '#9B59B6', '#1ABC9C', '#E74C3C'];

/**
 * Interactive bubble chart for district-wise symptom distribution.
 * Hover → scale up + tooltip. Click legend → filter by symptom.
 * Props: onSelect(symptom|null), selected (string|null)
 */
export default function BubbleChart({
  data, width = 500, height = 400,
  onSelect, selected,
}) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, district: '', symptom: '', count: 0 });

  const symptoms = [...new Set(data.map(d => d.symptom))];
  const color = d3.scaleOrdinal().domain(symptoms).range(COLORS);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const filtered = selected ? data.filter(d => d.symptom === selected) : data;

    const root = d3.hierarchy({ children: filtered }).sum(d => d.count);
    const pack = d3.pack().size([width - 20, height - 20]).padding(5);
    pack(root);

    const node = svg.append('g').attr('transform', 'translate(10,10)')
      .selectAll('g').data(root.leaves()).join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    // Shadow circle (for depth effect)
    node.append('circle')
      .attr('r', d => d.r + 3)
      .attr('fill', 'rgba(0,0,0,0.06)')
      .attr('cy', 2)
      .attr('pointer-events', 'none');

    const circles = node.append('circle')
      .attr('r', 0)
      .attr('fill', d => color(d.data.symptom))
      .attr('fill-opacity', 0.78)
      .attr('stroke', d => color(d.data.symptom))
      .attr('stroke-width', 1.5);

    // Entry animation
    circles.transition().duration(500).ease(d3.easeBackOut.overshoot(1.2))
      .attr('r', d => d.r);

    node
      .on('mousemove', (event, d) => {
        setTooltip({
          visible: true, x: event.offsetX, y: event.offsetY,
          district: d.data.district, symptom: d.data.symptom, count: d.data.count,
        });
        d3.select(event.currentTarget).select('circle:nth-child(2)')
          .transition().duration(120)
          .attr('r', d => d.r * 1.18)
          .attr('fill-opacity', 1);
      })
      .on('mouseleave', (event, d) => {
        setTooltip(t => ({ ...t, visible: false }));
        d3.select(event.currentTarget).select('circle:nth-child(2)')
          .transition().duration(120)
          .attr('r', d => d.r)
          .attr('fill-opacity', 0.78);
      })
      .on('click', (_, d) => {
        onSelect?.(d.data.symptom === selected ? null : d.data.symptom);
      });

    // District label
    node.filter(d => d.r > 18).append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.3em')
      .attr('font-size', '9px').attr('fill', '#fff').attr('font-weight', 700)
      .attr('pointer-events', 'none')
      .text(d => d.data.district.slice(0, 9));

    // Symptom label
    node.filter(d => d.r > 18).append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.9em')
      .attr('font-size', '8px').attr('fill', 'rgba(255,255,255,0.85)')
      .attr('pointer-events', 'none')
      .text(d => d.data.symptom.slice(0, 10));

    // Count label for large bubbles
    node.filter(d => d.r > 26).append('text')
      .attr('text-anchor', 'middle').attr('dy', '2.2em')
      .attr('font-size', '9px').attr('fill', 'rgba(255,255,255,0.7)')
      .attr('pointer-events', 'none')
      .text(d => d.data.count);

  }, [data, width, height, selected]);

  return (
    <div className="flex flex-col items-center text-text-secondary">
      <div className="relative overflow-x-auto">
        <svg ref={svgRef} />
        {tooltip.visible && (
          <div
            className="absolute z-50 pointer-events-none bg-surface border border-border rounded-xl shadow-elevated px-3 py-2 text-xs whitespace-nowrap"
            style={{ left: tooltip.x + 14, top: tooltip.y - 52 }}
          >
            <p className="font-semibold text-text-primary">{tooltip.district}</p>
            <p className="text-text-secondary">{tooltip.symptom}</p>
            <p className="text-text-primary font-medium">{tooltip.count} cases</p>
          </div>
        )}
      </div>

      {/* Clickable symptom legend */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {symptoms.map((s, i) => {
          const c = color(s);
          const active = selected === s;
          return (
            <button
              key={s}
              onClick={() => onSelect?.(active ? null : s)}
              className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-all ${
                selected && !active ? 'opacity-35 border-transparent' : 'border-transparent'
              } ${active ? 'ring-2 font-semibold' : 'hover:bg-surface-3'}`}
              style={{ '--tw-ring-color': c }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
