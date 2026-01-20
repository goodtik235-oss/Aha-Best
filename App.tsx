
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Languages, Download, Wand2, Loader2, AlertTriangle, Film, Mic, Square, Volume2, Sparkles, LayoutPanelLeft } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer.tsx';
import CaptionEditor from './components/CaptionEditor.tsx';
import StatsChart from './components/StatsChart.tsx';
import { Caption, ProcessingStatus, SUPPORTED_LANGUAGES } from './types.ts';
import { extractAudioFromVideo, base64ToWavBlob } from './services/audioUtils.ts';
import { transcribeAudio, translateCaptions, generateSpeech } from './services/geminiService.ts';
import { renderVideoWithCaptions } from './services/videoRenderer.ts';

function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [selectedLang, setSelectedLang] = useState<string>('ur-PK');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renderingProgress, setRenderingProgress] = useState(0);
  const [dubbedAudioBlob, setDubbedAudioBlob] = useState<Blob | null>(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState<string | null>(null);
  const [useDubbing, setUseDubbing] = useState(false);
  const [isDubPreviewPlaying, setIsDubPreviewPlaying] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const processAbortControllerRef = useRef<AbortController | null>(null);
  const dubPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (dubbedAudioUrl) URL.revokeObjectURL(dubbedAudioUrl);
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setCaptions([]);
      setStatus(ProcessingStatus.IDLE);
      setErrorMsg(null);
      setDubbedAudioBlob(null);
      if (dubbedAudioUrl) URL.revokeObjectURL(dubbedAudioUrl);
      setDubbedAudioUrl(null);
      setUseDubbing(false);
    }
  };

  const handleTranscribe = async () => {
    if (!videoFile) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;
    try {
      setStatus(ProcessingStatus.EXTRACTING_AUDIO);
      const audio = await extractAudioFromVideo(videoFile);
      setStatus(ProcessingStatus.TRANSCRIBING);
      const res = await transcribeAudio(audio, controller.signal);
      setCaptions(res);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatus(ProcessingStatus.ERROR);
        setErrorMsg(err.message);
      }
    }
  };

  const handleDub = async () => {
    if (captions.length === 0) return;
    try {
      setStatus(ProcessingStatus.GENERATING_SPEECH);
      const txt = captions.map(c => c.text).join(' ');
      const base64 = await generateSpeech(txt);
      const blob = base64ToWavBlob(base64);
      const url = URL.createObjectURL(blob);
      setDubbedAudioBlob(blob);
      setDubbedAudioUrl(url);
      setUseDubbing(true);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message);
    }
  };

  const handleExport = async () => {
    if (!videoSrc) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;
    try {
      setStatus(ProcessingStatus.RENDERING);
      const blob = await renderVideoWithCaptions(videoSrc, captions, setRenderingProgress, controller.signal, useDubbing ? dubbedAudioBlob : null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "aha_studio_export.webm";
      a.click();
      URL.revokeObjectURL(url);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message);
    }
  };

  const isProcessing = status === ProcessingStatus.EXTRACTING_AUDIO || 
                       status === ProcessingStatus.TRANSCRIBING || 
                       status === ProcessingStatus.TRANSLATING ||
                       status === ProcessingStatus.GENERATING_SPEECH ||
                       status === ProcessingStatus.RENDERING;

  const getProcessingMessage = () => {
    switch (status) {
      case ProcessingStatus.EXTRACTING_AUDIO: return "Deconstructing audio waves...";
      case ProcessingStatus.TRANSCRIBING: return "AHA Intelligence is listening...";
      case ProcessingStatus.TRANSLATING: return "Bridging linguistic gaps...";
      case ProcessingStatus.GENERATING_SPEECH: return "Synthesizing AI voiceover...";
      case ProcessingStatus.RENDERING: return `Compositing visual layers: ${Math.round(renderingProgress * 100)}%`;
      default: return "Processing...";
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 selection:bg-indigo-500/30">
      {dubbedAudioUrl && <audio ref={dubPreviewAudioRef} src={dubbedAudioUrl} onEnded={() => setIsDubPreviewPlaying(false)} className="hidden" />}

      {/* Overlay for processing */}
      {(status !== ProcessingStatus.IDLE && status !== ProcessingStatus.COMPLETED && status !== ProcessingStatus.ERROR) && (
        <div className="fixed inset-0 z-[100] glass flex flex-col items-center justify-center p-12 transition-all">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-indigo-500/30 blur-[100px] animate-pulse rounded-full" />
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter mb-2">AI ENGINE ACTIVE</h2>
          <p className="text-slate-400 text-sm font-medium mb-8">
            {status === ProcessingStatus.RENDERING ? `Rendering Masterpiece: ${Math.round(renderingProgress * 100)}%` : 'Orchestrating digital content...'}
          </p>
          <button onClick={() => processAbortControllerRef.current?.abort()} className="px-6 py-2 border border-white/10 hover:bg-white/5 rounded-full text-xs font-bold transition-all">
            STOP EXECUTION
          </button>
        </div>
      )}

      {/* Navbar */}
      <nav className="h-16 border-b border-white/5 px-8 flex items-center justify-between glass z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tighter">AHA STUDIO</span>
        </div>
        <div className="flex items-center space-x-4">
          <input type="file" ref={videoInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
          <button onClick={() => videoInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-xs font-black transition-all shadow-xl shadow-indigo-500/20">
            <Upload size={14} />
            <span>IMPORT VIDEO</span>
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <VideoPlayer src={videoSrc} captions={captions} onTimeUpdate={setCurrentTime} />
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <button onClick={handleTranscribe} disabled={!videoFile || isProcessing} className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl hover:bg-slate-800 transition-all text-left disabled:opacity-30">
                <Wand2 className="text-indigo-400 mb-4" />
                <h4 className="font-bold text-sm">TRANSCRIBE</h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Speech Recognition</p>
              </button>

              <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl hover:bg-slate-800 transition-all text-left group">
                <Languages className="text-purple-400 mb-4" />
                <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="bg-transparent text-sm font-bold border-none outline-none block w-full">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>)}
                </select>
                <button onClick={() => translateCaptions(captions, selectedLang).then(setCaptions)} disabled={captions.length === 0 || isProcessing} className="text-[10px] text-purple-400 mt-2 font-black group-hover:underline uppercase tracking-widest">Execute translation</button>
              </div>

              <button onClick={handleDub} disabled={captions.length === 0 || isProcessing} className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl hover:bg-slate-800 transition-all text-left disabled:opacity-30">
                <Mic className="text-pink-400 mb-4" />
                <h4 className="font-bold text-sm">AI DUB</h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Voice Synthesis</p>
              </button>

              <button onClick={handleExport} disabled={captions.length === 0 || isProcessing} className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl hover:bg-indigo-600/20 transition-all text-left disabled:opacity-30 group">
                <Film className="text-indigo-400 mb-4" />
                <h4 className="font-bold text-sm text-indigo-400">EXPORT</h4>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold group-hover:text-indigo-300">Finalize Assets</p>
              </button>
            </div>

            {errorMsg && (
              <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-start space-x-4 animate-in zoom-in">
                <AlertTriangle className="text-red-500 shrink-0" />
                <div>
                  <h5 className="font-black text-xs text-red-500 uppercase tracking-widest">Critical Engine Fault</h5>
                  <p className="text-sm text-red-300/80 mt-1">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="mt-12">
               <StatsChart captions={captions} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l border-white/5 glass flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center space-x-3">
            <LayoutPanelLeft size={16} className="text-slate-500" />
            <h3 className="text-sm font-black tracking-tighter">TRANSCRIPT STACK</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <CaptionEditor 
              captions={captions} 
              currentTime={currentTime} 
              onUpdateCaption={(id, text) => setCaptions(c => c.map(item => item.id === id ? {...item, text} : item))} 
              onSeek={(t) => {
                const v = document.querySelector('video');
                if (v) v.currentTime = t;
              }} 
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
