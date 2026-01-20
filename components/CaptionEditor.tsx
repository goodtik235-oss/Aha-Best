
import React from 'react';
import { Caption } from '../types.ts';
import { Edit2, PlayCircle, Clock } from 'lucide-react';

interface CaptionEditorProps {
  captions: Caption[];
  currentTime: number;
  onUpdateCaption: (id: string, text: string) => void;
  onSeek: (time: number) => void;
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({ captions, currentTime, onUpdateCaption, onSeek }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 bg-slate-900/50">
        <h2 className="text-lg font-bold flex items-center">
          <Edit2 size={18} className="mr-2 text-indigo-400" />
          Transcript Editor
        </h2>
        <p className="text-xs text-slate-500 mt-1">Refine and perfect your content.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {captions.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-600 text-center px-8">
            <Clock size={32} className="mb-2 opacity-20" />
            <p className="text-xs">No transcription yet. Click "Generate" to start.</p>
          </div>
        ) : (
          captions.map((cap) => {
            const isActive = currentTime >= cap.start && currentTime <= cap.end;
            return (
              <div 
                key={cap.id}
                className={`group p-3 rounded-xl transition-all border ${
                  isActive 
                    ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button 
                    onClick={() => onSeek(cap.start)}
                    className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    <PlayCircle size={12} />
                    <span>{cap.start.toFixed(2)}s - {cap.end.toFixed(2)}s</span>
                  </button>
                </div>
                <textarea
                  value={cap.text}
                  onChange={(e) => onUpdateCaption(cap.id, e.target.value)}
                  rows={2}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-300 resize-none placeholder-slate-700 focus:text-white transition-colors"
                  placeholder="Type caption text..."
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CaptionEditor;
