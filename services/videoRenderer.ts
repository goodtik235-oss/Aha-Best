
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
    video.src = videoSrc;
    video.crossOrigin = "anonymous";
    video.muted = true;
    
    await video.play(); // Pre-warm
    video.pause();
    video.currentTime = 0;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject("Could not get canvas context");

    const stream = canvas.captureStream(30);
    
    // Add dubbed audio if available
    if (dubbedAudio) {
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const dubbedAudioBuffer = await dubbedAudio.arrayBuffer();
        const decodedDub = await audioCtx.decodeAudioData(dubbedAudioBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = decodedDub;
        source.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);
        source.start(0);
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.start();

    const duration = video.duration;
    const fps = 30;
    const totalFrames = duration * fps;
    let currentFrame = 0;

    const drawFrame = async () => {
      if (signal.aborted) {
        mediaRecorder.stop();
        return;
      }

      if (video.currentTime >= duration) {
        mediaRecorder.stop();
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
        ctx.font = `${Math.floor(canvas.height * 0.05)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4;
        ctx.strokeText(activeCaption.text, canvas.width / 2, canvas.height * 0.85);
        ctx.fillText(activeCaption.text, canvas.width / 2, canvas.height * 0.85);
      }

      currentFrame++;
      onProgress(currentFrame / totalFrames);
      
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}
