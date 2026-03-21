import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const COLORS = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#3498DB', '#9B59B6'];

export default function DonutChart({ data, width = 240, height = 240, labelKey = 'label', valueKey = 'value' }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.55;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie()
      .value(d => d[valueKey])
      .sort(null);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius - 4)
      .cornerRadius(3);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .join('g');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (_, i) => COLORS[i % COLORS.length])
      .attr('stroke', 'var(--color-surface)')
      .attr('stroke-width', 2);

    // Center total
    const total = d3.sum(data, d => d[valueKey]);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', 'currentColor')
      .attr('font-size', '22px')
      .attr('font-weight', 'bold')
      .text(total);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'currentColor')
      .attr('font-size', '11px')
      .attr('opacity', 0.6)
      .text('Total');

  }, [data, width, height, labelKey, valueKey]);

  return (
    <div className="flex flex-col items-center text-text-primary">
      <svg ref={svgRef} />
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {data.map((d, i) => (
          <div key={d[labelKey]} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {d[labelKey]} ({d[valueKey]})
          </div>
        ))}
      </div>
    </div>
  );
}
