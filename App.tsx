
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Languages, Download, Wand2, Loader2, AlertTriangle, Film, Mic, Square, Volume2, Settings2 } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import CaptionEditor from './components/CaptionEditor';
import StatsChart from './components/StatsChart';
import { Caption, ProcessingStatus, SUPPORTED_LANGUAGES } from './types';
import { extractAudioFromVideo, base64ToWavBlob } from './services/audioUtils';
import { transcribeAudio, translateCaptions, generateSpeech } from './services/geminiService';
import { renderVideoWithCaptions } from './services/videoRenderer';

function App() {
  // App Logic State
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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (dubbedAudioUrl) URL.revokeObjectURL(dubbedAudioUrl);
    };
  }, [dubbedAudioUrl]);

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
      setRenderingProgress(0);
      setDubbedAudioBlob(null);
      setDubbedAudioUrl(null);
      setUseDubbing(false);
    }
  };

  const handleStopProcessing = () => {
    if (processAbortControllerRef.current) {
      processAbortControllerRef.current.abort();
      processAbortControllerRef.current = null;
    }
    setStatus(ProcessingStatus.IDLE);
    setErrorMsg("Process aborted by user.");
  };

  const handleGenerateCaptions = async () => {
    if (!videoFile) return;
    if (processAbortControllerRef.current) processAbortControllerRef.current.abort();
    const controller = new AbortController();
    processAbortControllerRef.current = controller;

    try {
      setErrorMsg(null);
      setStatus(ProcessingStatus.EXTRACTING_AUDIO);
      const audioBase64 = await extractAudioFromVideo(videoFile);
      if (controller.signal.aborted) return;
      
      setStatus(ProcessingStatus.TRANSCRIBING);
      const generatedCaptions = await transcribeAudio(audioBase64, controller.signal);
      if (controller.signal.aborted) return;
      
      setCaptions(generatedCaptions);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || "An unknown error occurred.");
    }
  };

  const handleTranslate = async () => {
    if (captions.length === 0) return;
    if (processAbortControllerRef.current) processAbortControllerRef.current.abort();
    const controller = new AbortController();
    processAbortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.TRANSLATING);
      const translated = await translateCaptions(
          captions, 
          SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.name || "English",
          controller.signal
      );
      if (controller.signal.aborted) return;
      
      setCaptions(translated);
      setDubbedAudioBlob(null);
      setDubbedAudioUrl(null);
      setUseDubbing(false);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("Translation failed.");
    }
  };

  const handleDubbing = async () => {
    if (captions.length === 0) return;
    if (processAbortControllerRef.current) processAbortControllerRef.current.abort();
    const controller = new AbortController();
    processAbortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.GENERATING_SPEECH);
      setErrorMsg(null);
      
      const fullText = captions.map(c => c.text).join('. ');
      const audioBase64 = await generateSpeech(fullText, controller.signal);
      if (controller.signal.aborted) return;
      
      const blob = base64ToWavBlob(audioBase64, 24000);
      const url = URL.createObjectURL(blob);

      setDubbedAudioBlob(blob);
      setDubbedAudioUrl(url);
      setUseDubbing(true);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("Dubbing failed: " + err.message);
    }
  };

  const toggleDubPreview = () => {
    if (!dubPreviewAudioRef.current) return;
    
    if (isDubPreviewPlaying) {
      dubPreviewAudioRef.current.pause();
      setIsDubPreviewPlaying(false);
    } else {
      dubPreviewAudioRef.current.currentTime = 0;
      dubPreviewAudioRef.current.play();
      setIsDubPreviewPlaying(true);
    }
  };

  const handleExportVideo = async () => {
    if (!videoSrc || captions.length === 0) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.RENDERING);
      setRenderingProgress(0);
      const audioToUse = useDubbing ? dubbedAudioBlob : null;
      const blob = await renderVideoWithCaptions(
        videoSrc, 
        captions, 
        (progress) => setRenderingProgress(progress),
        controller.signal,
        audioToUse
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aha_export_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus(ProcessingStatus.IDLE);
      } else {
        setStatus(ProcessingStatus.ERROR);
        setErrorMsg("Render error: " + err.message);
      }
    } finally {
      setRenderingProgress(0);
      processAbortControllerRef.current = null;
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
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col overflow-hidden relative">
      
      {/* Hidden Audio element for export preview */}
      {dubbedAudioUrl && (
        <audio 
          ref={dubPreviewAudioRef} 
          src={dubbedAudioUrl} 
          onEnded={() => setIsDubPreviewPlaying(false)}
          className="hidden"
        />
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 transition-all animate-in fade-in duration-500">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"></div>
              <div className="w-24 h-24 border-t-4 border-indigo-500 border-solid rounded-full animate-spin relative" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                AI Architect Working
            </h2>
            <p className="text-slate-400 mb-10 text-center max-w-md text-lg h-8">
                {getProcessingMessage()}
            </p>
            
            {status === ProcessingStatus.RENDERING && (
                <div className="w-full max-w-lg bg-slate-800 rounded-full h-1.5 mb-12 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    style={{ width: `${renderingProgress * 100}%` }}
                  />
                </div>
            )}

            <button
              onClick={handleStopProcessing}
              className="px-8 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-full font-bold transition-all flex items-center hover:scale-105 active:scale-95"
            >
              <Square size={16} className="mr-2 fill-current" />
              Cancel Operation
            </button>
        </div>
      )}

      {/* Header */}
      <header className="h-20 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md flex items-center px-8 justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20 transform -rotate-3">
            <span className="font-black text-xl italic tracking-tighter">A</span>
          </div>
          <div>
            <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight">
              AHA STUDIO
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Video Synthesis Engine</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <input type="file" ref={videoInputRef} accept="video/*" onChange={handleFileUpload} className="hidden" />
          <button 
            onClick={() => videoInputRef.current?.click()} 
            className="group flex items-center space-x-2 px-6 py-2.5 bg-white text-slate-950 rounded-full text-sm font-bold transition-all hover:bg-indigo-50 active:scale-95 shadow-lg shadow-white/5"
          >
            <Upload size={16} />
            <span>{videoFile ? 'Switch Project' : 'New Project'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto">
             <VideoPlayer src={videoSrc} captions={captions} onTimeUpdate={setCurrentTime} />

             <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Transcribe */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-800/40 transition-all group">
                  <div className="mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Wand2 size={18} className="text-indigo-400"/>
                    </div>
                    <h3 className="font-bold text-slate-100">Transcribe</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Deep analysis of speech frequencies.</p>
                  </div>
                  <button
                    onClick={handleGenerateCaptions}
                    disabled={!videoFile || isProcessing}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                     Analyze Audio
                  </button>
                </div>

                {/* 2. Translate */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-800/40 transition-all group">
                  <div className="mb-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Languages size={18} className="text-purple-400"/>
                    </div>
                    <h3 className="font-bold text-slate-100">Localize</h3>
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      disabled={isProcessing}
                      className="bg-transparent text-[10px] text-slate-500 outline-none w-full mt-1 border-b border-slate-800 pb-1 focus:border-purple-500 transition-colors"
                    >
                      {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleTranslate}
                    disabled={captions.length === 0 || isProcessing}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 transition-all disabled:opacity-20"
                  >
                    Translate Content
                  </button>
                </div>

                {/* 3. Dubbing */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-800/40 transition-all group">
                   <div className="mb-4">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Mic size={18} className="text-pink-400"/>
                    </div>
                    <h3 className="font-bold text-slate-100">AI Dub</h3>
                    <p className="text-[10px] text-slate-500 mt-1">High-fidelity voice synthesis.</p>
                  </div>
                  <button
                    onClick={handleDubbing}
                    disabled={captions.length === 0 || isProcessing}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/20 transition-all disabled:opacity-20"
                  >
                    Synthesize Voice
                  </button>
                </div>

                {/* 4. Export */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between hover:bg-slate-800/40 transition-all group">
                   <div className="mb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Film size={18} className="text-emerald-400"/>
                    </div>
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-100">Export</h3>
                        {dubbedAudioUrl && (
                            <button
                                onClick={toggleDubPreview}
                                className={`p-1.5 rounded-full transition-all ${isDubPreviewPlaying ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                {isDubPreviewPlaying ? <Square size={10} className="fill-current" /> : <Volume2 size={10} />}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                        <input 
                            type="checkbox" 
                            id="burnDub" 
                            checked={useDubbing} 
                            onChange={(e) => setUseDubbing(e.target.checked)}
                            disabled={!dubbedAudioBlob || isProcessing}
                            className="accent-emerald-500 w-3 h-3"
                        />
                        <label htmlFor="burnDub" className="text-[10px] text-slate-500 cursor-pointer">Burn dubbed audio</label>
                    </div>
                  </div>
                  <button
                    onClick={handleExportVideo}
                    disabled={captions.length === 0 || isProcessing}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-20"
                  >
                    Render Masterpiece
                  </button>
                </div>

             </div>

             {errorMsg && (
               <div className="mt-8 bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-start text-sm animate-in zoom-in duration-300">
                 <AlertTriangle size={20} className="mr-3 mt-0.5 flex-shrink-0" />
                 <div>
                   <p className="font-black uppercase tracking-widest text-[10px] mb-1">Critical Fault</p>
                   <p className="opacity-80 font-medium">{errorMsg}</p>
                 </div>
               </div>
             )}

             <StatsChart captions={captions} />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 flex-shrink-0 bg-slate-900/20 border-l border-slate-800/50 backdrop-blur-sm">
           <CaptionEditor 
             captions={captions} 
             currentTime={currentTime} 
             onUpdateCaption={(id, text) => {
                setCaptions(prev => prev.map(c => c.id === id ? { ...c, text } : c));
             }}
             onSeek={(t) => {
                const video = document.querySelector('video');
                if (video) video.currentTime = t;
             }}
           />
        </aside>

      </main>
    </div>
  );
}

export default App;
