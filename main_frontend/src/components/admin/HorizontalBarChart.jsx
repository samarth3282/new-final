import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Interactive horizontal bar chart.
 * Props: onSelect(label|null), selected (string|null)
 */
export default function HorizontalBarChart({
  data, width = 400, height = 300,
  labelKey = 'symptom', valueKey = 'count',
  onSelect, selected,
}) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, label: '', value: 0 });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 50, bottom: 20, left: 110 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(data.map(d => d[labelKey])).range([0, h]).padding(0.3);
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d[valueKey]) * 1.15]).range([0, w]);
    const maxVal = d3.max(data, d => d[valueKey]);

    // Grid lines
    g.selectAll('.grid').data(x.ticks(5)).join('line')
      .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', h)
      .attr('stroke', 'currentColor').attr('stroke-opacity', 0.07);

    // Background rows for readability
    g.selectAll('.row-bg').data(data).join('rect')
      .attr('x', -margin.left).attr('width', w + margin.left + margin.right)
      .attr('y', d => y(d[labelKey])).attr('height', y.bandwidth() + y.step() * y.paddingInner())
      .attr('fill', (_, i) => i % 2 === 0 ? 'currentColor' : 'transparent')
      .attr('fill-opacity', 0.02).attr('pointer-events', 'none');

    // Bars — start at width 0, animate in
    const bars = g.selectAll('.bar').data(data).join('rect').attr('class', 'bar')
      .attr('y', d => y(d[labelKey])).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0)
      .attr('rx', 5)
      .attr('fill', d => {
        if (!selected) return 'var(--color-primary)';
        return d[labelKey] === selected ? 'var(--color-primary)' : 'var(--color-primary)';
      })
      .attr('opacity', d => !selected || d[labelKey] === selected ? 0.85 : 0.25)
      .style('cursor', 'pointer');

    bars.transition().duration(600).ease(d3.easeCubicOut)
      .attr('width', d => x(d[valueKey]));

    // Intensity stripe (darker end cap)
    g.selectAll('.stripe').data(data).join('rect').attr('class', 'stripe')
      .attr('y', d => y(d[labelKey])).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0).attr('rx', 5)
      .attr('fill', 'var(--color-primary-dark)').attr('opacity', 0)
      .attr('pointer-events', 'none')
      .transition().duration(600).ease(d3.easeCubicOut)
      .attr('x', d => Math.max(0, x(d[valueKey]) - 8))
      .attr('width', 8).attr('opacity', d => !selected || d[labelKey] === selected ? 0.3 : 0);

    // Value labels
    const valLabels = g.selectAll('.val').data(data).join('text').attr('class', 'val')
      .attr('x', 4).attr('y', d => y(d[labelKey]) + y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('font-size', '11px').attr('font-weight', 600)
      .attr('fill', 'currentColor')
      .attr('opacity', d => !selected || d[labelKey] === selected ? 1 : 0.3)
      .text(d => d[valueKey]);

    valLabels.transition().duration(600).ease(d3.easeCubicOut)
      .attr('x', d => x(d[valueKey]) + 6);

    // Relative % bar at far right
    g.selectAll('.pct-label').data(data).join('text').attr('class', 'pct-label')
      .attr('x', w + 4).attr('y', d => y(d[labelKey]) + y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', 'currentColor').attr('opacity', 0.45)
      .text(d => `${Math.round(d[valueKey] / maxVal * 100)}%`);

    // Hover overlay areas
    g.selectAll('.hover-area').data(data).join('rect').attr('class', 'hover-area')
      .attr('x', -margin.left).attr('y', d => y(d[labelKey]) - y.step() * y.paddingInner() / 2)
      .attr('width', w + margin.left + margin.right)
      .attr('height', y.step())
      .attr('fill', 'transparent').style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        setTooltip({ visible: true, x: event.offsetX, y: event.offsetY, label: d[labelKey], value: d[valueKey] });
        g.selectAll('.bar').filter(b => b[labelKey] === d[labelKey])
          .transition().duration(100).attr('opacity', 1).attr('rx', 6);
      })
      .on('mouseleave', (_, d) => {
        setTooltip(t => ({ ...t, visible: false }));
        g.selectAll('.bar').transition().duration(100)
          .attr('opacity', b => !selected || b[labelKey] === selected ? 0.85 : 0.25).attr('rx', 5);
      })
      .on('click', (_, d) => {
        onSelect?.(d[labelKey] === selected ? null : d[labelKey]);
      });

    // Y axis
    g.append('g').call(d3.axisLeft(y).tickSize(0))
      .select('.domain').remove();
    svg.selectAll('.tick text')
      .attr('fill', 'currentColor').attr('font-size', '11px').attr('dx', '-4');

  }, [data, width, height, labelKey, valueKey, selected]);

  return (
    <div className="relative overflow-x-auto text-text-secondary">
      <svg ref={svgRef} />
      {tooltip.visible && (
        <div
          className="absolute z-50 pointer-events-none bg-surface border border-border rounded-xl shadow-elevated px-3 py-2 text-xs whitespace-nowrap"
          style={{ left: tooltip.x + 14, top: tooltip.y - 44 }}
        >
          <p className="font-semibold text-text-primary">{tooltip.label}</p>
          <p className="text-text-secondary">{tooltip.value} reported cases</p>
        </div>
      )}
    </div>
  );
}
