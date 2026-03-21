import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TRIAGE_COLORS = { Emergency: '#E74C3C', Clinic: '#E67E22', Selfcare: '#27AE60' };
const COLORS = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#3498DB', '#9B59B6', '#1ABC9C', '#E74C3C', '#2ECC71', '#F39C12'];
const getColor = (label, i) => TRIAGE_COLORS[label] ?? COLORS[i % COLORS.length];

/**
 * Interactive pie chart — hover expands slice + tooltip, click selects/deselects.
 * Props: onSelect(label|null), selected (string|null)
 */
export default function PieChart({
  data, width = 280, height = 280,
  labelKey = 'label', valueKey = 'value',
  onSelect, selected,
}) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, label: '', value: 0, pct: 0 });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width, height) / 2 - 16;
    const hoverR  = radius + 12;
    svg.attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const pie  = d3.pie().value(d => d[valueKey]).sort(null);
    const arc  = d3.arc().cornerRadius(4);
    const lblA = d3.arc().innerRadius(radius * 0.58).outerRadius(radius * 0.58);
    const total = d3.sum(data, d => d[valueKey]);

    // Entry animation
    const paths = g.selectAll('path').data(pie(data)).join('path')
      .attr('fill',   (_, i) => getColor(data[i][labelKey], i))
      .attr('stroke', 'var(--color-surface)').attr('stroke-width', 2)
      .attr('opacity', d => !selected || d.data[labelKey] === selected ? 1 : 0.35)
      .style('cursor', 'pointer')
      .each(function(d) { this._current = d; })
      .attr('d', d => arc.innerRadius(0).outerRadius(
        d.data[labelKey] === selected ? hoverR : radius
      )(d));

    // Animate in
    paths.transition().duration(500).ease(d3.easeCubicOut)
      .attrTween('d', function(d) {
        const interp = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc.innerRadius(0).outerRadius(
          d.data[labelKey] === selected ? hoverR : radius
        )(interp(t));
      });

    paths
      .on('mousemove', (event, d) => {
        setTooltip({
          visible: true, x: event.offsetX, y: event.offsetY,
          label: d.data[labelKey], value: d.data[valueKey],
          pct: Math.round(d.data[valueKey] / total * 100),
        });
        d3.select(event.currentTarget)
          .transition().duration(120)
          .attr('d', arc.innerRadius(0).outerRadius(hoverR)(d));
      })
      .on('mouseleave', (event, d) => {
        setTooltip(t => ({ ...t, visible: false }));
        d3.select(event.currentTarget)
          .transition().duration(120)
          .attr('d', arc.innerRadius(0).outerRadius(
            d.data[labelKey] === selected ? hoverR : radius
          )(d));
      })
      .on('click', (_, d) => {
        onSelect?.(d.data[labelKey] === selected ? null : d.data[labelKey]);
      });

    // Percentage labels
    g.selectAll('.pct').data(pie(data)).join('text').attr('class', 'pct')
      .attr('transform', d => `translate(${lblA.centroid(d)})`)
      .attr('text-anchor', 'middle').attr('font-size', '11px')
      .attr('fill', '#fff').attr('font-weight', 700).attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text(d => d.data[valueKey] / total > 0.06 ? `${Math.round(d.data[valueKey] / total * 100)}%` : '')
      .transition().delay(400).duration(300).attr('opacity', 1);

  }, [data, width, height, labelKey, valueKey, selected]);

  return (
    <div className="flex flex-col items-center text-text-primary">
      <div className="relative">
        <svg ref={svgRef} />
        {tooltip.visible && (
          <div
            className="absolute z-50 pointer-events-none bg-surface border border-border rounded-xl shadow-elevated px-3 py-2 text-xs whitespace-nowrap"
            style={{ left: tooltip.x + 14, top: tooltip.y - 42 }}
          >
            <p className="font-semibold text-text-primary">{tooltip.label}</p>
            <p className="text-text-secondary">{tooltip.value} cases · <span className="font-medium text-text-primary">{tooltip.pct}%</span></p>
          </div>
        )}
      </div>

      {/* Clickable legend */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {data.map((d, i) => {
          const color = getColor(d[labelKey], i);
          const isActive = selected === d[labelKey];
          return (
            <button
              key={d[labelKey]}
              onClick={() => onSelect?.(isActive ? null : d[labelKey])}
              className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-all ${
                selected && !isActive ? 'opacity-40 border-transparent' : 'border-transparent'
              } ${isActive ? 'ring-2' : 'hover:bg-surface-3'}`}
              style={{ '--tw-ring-color': color }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-text-secondary">
                {d[labelKey]} <span className="font-semibold text-text-primary">({d[valueKey]})</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
