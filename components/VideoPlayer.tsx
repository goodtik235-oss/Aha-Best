
import React, { useRef, useEffect, useState } from 'react';
import { Caption } from '../types.ts';
import { Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  src: string | null;
  captions: Caption[];
  onTimeUpdate: (time: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, captions, onTimeUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoadError(false);

    const handleTimeUpdate = () => {
      if (!video) return;
      const time = video.currentTime;
      onTimeUpdate(time);
      if (video.duration) {
        setProgress((time / video.duration) * 100);
      }
      
      const current = captions.find(c => time >= c.start && time <= c.end);
      setActiveCaption(current ? current.text : null);
    };

    const handleError = () => {
      setLoadError(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, [captions, onTimeUpdate, src]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  if (!src) {
    return (
      <div className="aspect-video w-full bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
          <Play size={32} className="ml-1 opacity-20" />
        </div>
        <p className="text-sm font-medium">Upload a video to start the magic</p>
      </div>
    );
  }

  return (
    <div className="relative group w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
      {loadError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <div className="text-red-500 mb-4 bg-red-500/10 p-3 rounded-full">
            <VolumeX size={24} />
          </div>
          <p className="text-slate-300 font-bold">Unsupported Video Format</p>
          <p className="text-slate-500 text-xs mt-1">This browser cannot play this file. Try an MP4 or WebM.</p>
        </div>
      ) : (
        <video
          key={src} // Force complete re-mount when src changes
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />
      )}
      
      {/* Caption Overlay */}
      {activeCaption && !loadError && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-lg text-lg md:text-xl font-medium text-center border border-white/10 shadow-lg max-w-full truncate">
            {activeCaption}
          </div>
        </div>
      )}

      {/* Custom Controls */}
      {!loadError && (
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div 
            className="w-full bg-white/20 h-1.5 rounded-full mb-4 cursor-pointer overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (videoRef.current) {
                videoRef.current.currentTime = percent * videoRef.current.duration;
              }
            }}
          >
            <div 
              className="h-full bg-indigo-500 transition-all duration-100" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button 
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }} 
                className="hover:text-indigo-400 transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <span className="text-xs font-mono">
                {videoRef.current ? Math.floor(videoRef.current.currentTime) : 0}s / {videoRef.current ? Math.floor(videoRef.current.duration) : 0}s
              </span>
            </div>
            <button 
              onClick={() => videoRef.current?.requestFullscreen()}
              className="hover:text-indigo-400 transition-colors"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
