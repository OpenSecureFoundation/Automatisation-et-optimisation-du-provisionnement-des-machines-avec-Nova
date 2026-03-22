import React from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { Card, CardBody } from '../ui';
import { CHART_SURFACE_STYLE, PREMIUM_CHART_SX } from './chartTheme';

export function UsageChart({ data = [], dataKeys = [], title = 'Utilisation', height = 260 }) {
  if (!dataKeys.length) dataKeys = [{ key: 'value', color: '#667eea', name: 'Valeur' }];
  const xLabels = data.map((point, idx) => point?.name || `${idx + 1}`);
  const series = dataKeys.map(({ key, color, name }) => ({
    data: data.map((point) => {
      const value = Number(point?.[key]);
      return Number.isFinite(value) ? value : null;
    }),
    label: name || key,
    color: color || '#667eea',
    curve: 'monotoneX',
    showMark: false
  }));
  return (
    <Card shadow="none" style={{ border: '1px solid #e2e8f0' }}>
      <CardBody className="usage-chart-container" style={{ width: '100%', height }}>
      {title && <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{title}</h3>}
      <div style={CHART_SURFACE_STYLE}>
        <LineChart
          xAxis={[{ scaleType: 'point', data: xLabels }]}
          series={series}
          height={height - 30}
          margin={{ top: 16, right: 20, left: 20, bottom: 24 }}
          grid={{ vertical: false, horizontal: true }}
          sx={PREMIUM_CHART_SX}
        />
      </div>
      </CardBody>
    </Card>
  );
}

export function BarUsageChart({ data = [], dataKey = 'value', name = 'Valeur', color = '#667eea', title, height = 200 }) {
  const chartData = data.map((point, idx) => ({
    label: point?.name || `${idx + 1}`,
    [dataKey]: Number.isFinite(Number(point?.[dataKey])) ? Number(point?.[dataKey]) : 0
  }));
  return (
    <Card shadow="none" style={{ border: '1px solid #e2e8f0' }}>
      <CardBody className="bar-usage-chart" style={{ width: '100%', height }}>
      {title && <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{title}</h3>}
      <div style={CHART_SURFACE_STYLE}>
        <BarChart
          dataset={chartData}
          xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
          series={[{ dataKey, label: name, color }]}
          yAxis={[{}]}
          height={height - 30}
          margin={{ top: 16, right: 20, left: 20, bottom: 24 }}
          grid={{ horizontal: true }}
          sx={PREMIUM_CHART_SX}
        />
      </div>
      </CardBody>
    </Card>
  );
}
