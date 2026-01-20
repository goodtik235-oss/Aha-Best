
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Caption } from '../types.ts';
import { Activity } from 'lucide-react';

interface StatsChartProps {
  captions: Caption[];
}

const StatsChart: React.FC<StatsChartProps> = ({ captions }) => {
  if (captions.length === 0) return null;

  // Calculate words per segment
  const data = captions.map((c, i) => ({
    segment: `Seg ${i + 1}`,
    words: c.text.split(' ').filter(Boolean).length,
    duration: c.end - c.start
  }));

  const avgWords = data.reduce((acc, curr) => acc + curr.words, 0) / data.length;

  return (
    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold flex items-center">
            <Activity size={16} className="mr-2 text-indigo-400" />
            Content Density Map
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">Average: {avgWords.toFixed(1)} words/segment</p>
        </div>
      </div>
      
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="segment" hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }}
              itemStyle={{ color: '#818cf8' }}
            />
            <Bar dataKey="words" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.words > avgWords * 1.5 ? '#f43f5e' : '#6366f1'} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;
