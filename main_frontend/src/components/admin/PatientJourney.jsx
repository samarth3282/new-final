import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Interactive patient journey linked-list.
 * Click a step node to expand its details below.
 */
export default function PatientJourney({ steps, width = 500, height = 110 }) {
  const svgRef = useRef(null);
  const [activeStep, setActiveStep] = useState(null);

  const nodeR = 22;

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const n = steps.length;
    const pad = 60;
    const totalW = Math.max(width, n * 130);
    svg.attr('width', totalW).attr('height', height);

    const xScale = d3.scalePoint().domain(steps.map(s => s.id)).range([pad, totalW - pad]);
    const cy = height / 2 - 8;
    const g = svg.append('g');

    // Links
    for (let i = 0; i < n - 1; i++) {
      const x1 = xScale(steps[i].id) + nodeR + 4;
      const x2 = xScale(steps[i + 1].id) - nodeR - 4;

      g.append('line')
        .attr('x1', x1).attr('y1', cy).attr('x2', x2).attr('y2', cy)
        .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2)
        .attr('stroke-dasharray', '0')
        .attr('opacity', 0.5);

      // Arrowhead
      g.append('polygon')
        .attr('points', `${x2},${cy - 5} ${x2 + 8},${cy} ${x2},${cy + 5}`)
        .attr('fill', 'var(--color-primary)').attr('opacity', 0.5);
    }

    // Nodes
    const node = g.selectAll('.node').data(steps).join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${xScale(d.id)},${cy})`)
      .style('cursor', 'pointer');

    node.append('circle').attr('class', 'ring')
      .attr('r', nodeR + 5)
      .attr('fill', 'var(--color-primary)')
      .attr('opacity', d => d.id === activeStep?.id ? 0.15 : 0);

    node.append('circle').attr('class', 'bg')
      .attr('r', nodeR)
      .attr('fill', d => d.id === activeStep?.id ? 'var(--color-primary)' : 'var(--color-primary-light)')
      .attr('stroke', 'var(--color-primary)').attr('stroke-width', 2.5);

    node.append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', d => d.id === activeStep?.id ? '#fff' : 'var(--color-primary)')
      .attr('font-size', '11px').attr('font-weight', 700).attr('pointer-events', 'none')
      .text((_, i) => i + 1);

    // Step label below node
    node.append('text')
      .attr('text-anchor', 'middle').attr('y', nodeR + 16)
      .attr('fill', 'currentColor').attr('font-size', '10px').attr('font-weight', 600)
      .attr('pointer-events', 'none')
      .text(d => d.label);

    // Hover effects
    node
      .on('mouseenter', (event, d) => {
        if (d.id !== activeStep?.id) {
          d3.select(event.currentTarget).select('.bg')
            .transition().duration(120).attr('r', nodeR + 4);
          d3.select(event.currentTarget).select('.ring')
            .transition().duration(120).attr('opacity', 0.1);
        }
      })
      .on('mouseleave', (event, d) => {
        d3.select(event.currentTarget).select('.bg')
          .transition().duration(120).attr('r', nodeR);
        if (d.id !== activeStep?.id)
          d3.select(event.currentTarget).select('.ring').transition().duration(120).attr('opacity', 0);
      })
      .on('click', (_, d) => {
        setActiveStep(prev => prev?.id === d.id ? null : d);
      });

  }, [steps, activeStep, width, height]);

  return (
    <div>
      <p className="text-xs text-text-hint mb-3">Click a step to see details</p>
      <div className="overflow-x-auto text-text-secondary">
        <svg ref={svgRef} />
      </div>

      {/* Expanded detail card */}
      {activeStep && (
        <div className="mt-4 p-4 rounded-2xl border border-primary/30 bg-primary/5 transition-all">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
              {steps.findIndex(s => s.id === activeStep.id) + 1}
            </span>
            <div>
              <p className="font-semibold text-text-primary text-sm">{activeStep.label}</p>
              <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">{activeStep.desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
