import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const COLORS = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#3498DB', '#9B59B6', '#1ABC9C', '#E74C3C'];

/**
 * Interactive chord diagram.
 * Hover arc  → fades unrelated ribbons, tooltip shows group total.
 * Hover ribbon → tooltip shows pair + co-occurrence count.
 */
export default function ChordDiagram({ data, width = 400, height = 400 }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
    const outerR = Math.min(width, height) / 2 - 44;
    const innerR = outerR - 18;

    const labelsSet = new Set();
    data.forEach(d => { labelsSet.add(d.source); labelsSet.add(d.target); });
    const labels = [...labelsSet];
    const n = labels.length;
    const idx = new Map(labels.map((l, i) => [l, i]));

    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    data.forEach(d => {
      const si = idx.get(d.source), ti = idx.get(d.target);
      if (si !== undefined && ti !== undefined) {
        matrix[si][ti] += d.value;
        matrix[ti][si] += d.value;
      }
    });

    const chord   = d3.chord().padAngle(0.06).sortSubgroups(d3.descending)(matrix);
    const arc     = d3.arc().innerRadius(innerR).outerRadius(outerR);
    const ribbon  = d3.ribbon().radius(innerR - 1);

    // Ribbons — drawn first (below arcs)
    const ribbons = g.append('g').attr('class', 'ribbons')
      .selectAll('path').data(chord).join('path')
      .attr('d', ribbon)
      .attr('fill', d => COLORS[d.source.index % COLORS.length])
      .attr('fill-opacity', 0.55)
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        setTooltip({
          visible: true, x: event.offsetX, y: event.offsetY,
          text: `${labels[d.source.index]} ↔ ${labels[d.target.index]}: ${d.source.value} co-occurrences`,
        });
        d3.select(event.currentTarget).attr('fill-opacity', 0.85);
      })
      .on('mouseleave', (event) => {
        setTooltip(t => ({ ...t, visible: false }));
        d3.select(event.currentTarget).attr('fill-opacity', 0.55);
      });

    // Arcs
    const arcPaths = g.append('g').attr('class', 'arcs')
      .selectAll('path').data(chord.groups).join('path')
      .attr('d', arc)
      .attr('fill', d => COLORS[d.index % COLORS.length])
      .attr('stroke', 'var(--color-surface)').attr('stroke-width', 1.5)
      .style('cursor', 'pointer');

    arcPaths
      .on('mousemove', (event, d) => {
        const groupTotal = d3.sum(matrix[d.index]);
        setTooltip({
          visible: true, x: event.offsetX, y: event.offsetY,
          text: `${labels[d.index]}: ${groupTotal} total co-occurrences`,
        });
        // Fade unrelated ribbons
        ribbons.attr('fill-opacity', r =>
          r.source.index === d.index || r.target.index === d.index ? 0.85 : 0.05
        );
        // Shrink unrelated arcs
        arcPaths.attr('opacity', a => a.index === d.index ? 1 : 0.45);
      })
      .on('mouseleave', () => {
        setTooltip(t => ({ ...t, visible: false }));
        ribbons.attr('fill-opacity', 0.55);
        arcPaths.attr('opacity', 1);
      });

    // Arc tick marks
    g.append('g').selectAll('text').data(chord.groups).join('text')
      .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .attr('transform', d =>
        `rotate(${(d.angle * 180 / Math.PI) - 90}) translate(${outerR + 10})${
          d.angle > Math.PI ? ' rotate(180)' : ''
        }`)
      .attr('text-anchor', d => d.angle > Math.PI ? 'end' : null)
      .attr('font-size', '10px').attr('fill', 'currentColor').attr('pointer-events', 'none')
      .text(d => labels[d.index]);

  }, [data, width, height]);

  return (
    <div className="relative overflow-x-auto text-text-secondary flex justify-center">
      <svg ref={svgRef} />
      {tooltip.visible && (
        <div
          className="absolute z-50 pointer-events-none bg-surface border border-border rounded-xl shadow-elevated px-3 py-2 text-xs max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y - 44 }}
        >
          <p className="text-text-primary font-medium">{tooltip.text}</p>
        </div>
      )}
    </div>
  );
}
