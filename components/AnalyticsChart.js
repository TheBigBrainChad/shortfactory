'use client';

import { useEffect, useRef } from 'react';

export default function AnalyticsChart({ type, data, labels, width = 700, height = 300, colors, title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#141720';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 30, right: 30, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (type === 'line') {
      drawLineChart(ctx, data, labels, colors, padding, chartW, chartH, width, height);
    } else if (type === 'bar') {
      drawBarChart(ctx, data, labels, colors, padding, chartW, chartH, width, height);
    } else if (type === 'donut') {
      drawDonutChart(ctx, data, labels, colors, width, height);
    }

    if (title) {
      ctx.fillStyle = '#e8eaf0';
      ctx.font = '500 13px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title, padding.left, 18);
    }

  }, [data, labels, type, width, height, colors, title]);

  return <canvas ref={canvasRef} className="chart-canvas" />;
}

function drawLineChart(ctx, data, labels, colors, pad, cW, cH, w, h) {
  const max = Math.max(...data) * 1.1 || 1;
  const min = 0;

  ctx.strokeStyle = '#2a3148';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (i / 4) * cH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = '#5c6177';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(min + (max - min) * (i / 4)).toLocaleString(), pad.left - 8, y + 4);
  }

  const lineColor = (colors && colors[0]) || '#00f0ff';
  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  gradient.addColorStop(0, lineColor + '40');
  gradient.addColorStop(1, lineColor + '05');

  const points = data.map((val, i) => ({
    x: pad.left + (i / (data.length - 1)) * cW,
    y: pad.top + cH - ((val - min) / (max - min)) * cH
  }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].x, points[points.length - 1].y);

  ctx.save();
  ctx.lineTo(points[points.length - 1].x, pad.top + cH);
  ctx.lineTo(points[0].x, pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const labelStep = Math.max(1, Math.floor(labels.length / 8));
  ctx.fillStyle = '#5c6177';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    if (i % labelStep === 0) {
      const x = pad.left + (i / (data.length - 1)) * cW;
      ctx.fillText(label, x, h - 10);
    }
  });
}

function drawBarChart(ctx, data, labels, colors, pad, cW, cH, w, h) {
  const max = Math.max(...data) * 1.1 || 1;
  const barWidth = Math.min(40, cW / data.length * 0.7);
  const gap = cW / data.length;

  ctx.strokeStyle = '#2a3148';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (i / 4) * cH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  data.forEach((val, i) => {
    const barH = (val / max) * cH;
    const x = pad.left + i * gap + (gap - barWidth) / 2;
    const y = pad.top + cH - barH;
    const color = (colors && colors[i % colors.length]) || '#00f0ff';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
    ctx.fill();

    if (labels && labels[i] && i % Math.max(1, Math.floor(labels.length / 10)) === 0) {
      ctx.fillStyle = '#5c6177';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barWidth / 2, h - 10);
    }
  });
}

function drawDonutChart(ctx, data, labels, colors, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 40;
  const innerRadius = radius * 0.6;
  const total = data.reduce((a, b) => a + b, 0) || 1;

  let startAngle = -Math.PI / 2;

  data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    const color = (colors && colors[i % colors.length]) || '#00f0ff';

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (labels && labels[i] && sliceAngle > 0.3) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius + 20;
      ctx.fillStyle = '#e8eaf0';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
      ctx.fillText(labels[i], cx + Math.cos(midAngle) * labelR, cy + Math.sin(midAngle) * labelR);
    }

    startAngle += sliceAngle;
  });

  ctx.fillStyle = '#141720';
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8eaf0';
  ctx.font = 'bold 18px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total.toLocaleString(), cx, cy - 8);
  ctx.fillStyle = '#5c6177';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillText('total', cx, cy + 10);
}