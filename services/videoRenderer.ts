
import { Caption } from "../types";

/**
 * Renders video with captions to a blob using Canvas and MediaRecorder
 */
export async function renderVideoWithCaptions(
  videoSrc: string,
  captions: Caption[],
  onProgress: (progress: number) => void,
  signal: AbortSignal,
  dubbedAudio?: Blob | null
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const video = document.createElement('video');
    
    // Crucial: Only set crossOrigin if it's not a blob URL
    if (!videoSrc.startsWith('blob:')) {
      video.crossOrigin = "anonymous";
    }
    
    video.src = videoSrc;
    video.muted = true;
    video.playsInline = true;

    // Wait for the video to be ready to seek
    try {
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error("Video failed to load in renderer. The format may not be supported."));
        video.load();
      });
    } catch (err) {
      return reject(err);
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject("Could not get canvas context");

    const stream = canvas.captureStream(30);
    
    // Add dubbed audio if available
    if (dubbedAudio) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const dubbedAudioBuffer = await dubbedAudio.arrayBuffer();
        const decodedDub = await audioCtx.decodeAudioData(dubbedAudioBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = decodedDub;
        source.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);
        source.start(0);
      } catch (err) {
        console.warn("Audio processing failed for render", err);
      }
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.start();

    const duration = video.duration;
    const fps = 30;
    const totalFrames = Math.floor(duration * fps);
    let currentFrame = 0;

    const drawFrame = async () => {
      if (signal.aborted) {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        return;
      }

      if (currentFrame >= totalFrames) {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        return;
      }

      // Sync video to desired time
      video.currentTime = currentFrame / fps;
      
      // Wait for seek
      await new Promise(r => video.onseeked = r);

      // Draw video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw captions
      const time = video.currentTime;
      const activeCaption = captions.find(c => time >= c.start && time <= c.end);
      
      if (activeCaption) {
        const fontSize = Math.floor(canvas.height * 0.05);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const padding = fontSize * 0.5;
        const x = canvas.width / 2;
        const y = canvas.height * 0.9;

        // Text background/shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 15;
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'black';
        ctx.strokeText(activeCaption.text, x, y);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.fillText(activeCaption.text, x, y);
      }

      currentFrame++;
      onProgress(Math.min(1, currentFrame / totalFrames));
      
      // Use requestAnimationFrame for smoother capture pacing
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}
