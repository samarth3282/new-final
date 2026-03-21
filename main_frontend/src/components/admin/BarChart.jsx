import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function BarChart({ data, width = 320, height = 200, xKey = 'label', yKey = 'value', color = '#C0392B' }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d[xKey]))
      .range([0, w])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[yKey]) * 1.1])
      .range([h, 0]);

    // Grid
    g.append('g')
      .selectAll('line')
      .data(y.ticks(5))
      .join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.1);

    // Bars
    g.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('x', d => x(d[xKey]))
      .attr('y', d => y(d[yKey]))
      .attr('width', x.bandwidth())
      .attr('height', d => h - y(d[yKey]))
      .attr('rx', 4)
      .attr('fill', color)
      .attr('opacity', 0.85);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select('.domain').remove();

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(0))
      .select('.domain').remove();

    svg.selectAll('text')
      .attr('fill', 'currentColor')
      .attr('font-size', '10px');

  }, [data, width, height, xKey, yKey, color]);

  return (
    <div className="overflow-x-auto text-text-secondary">
      <svg ref={svgRef} />
    </div>
  );
}
