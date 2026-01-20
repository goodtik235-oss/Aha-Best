
export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  EXTRACTING_AUDIO = 'EXTRACTING_AUDIO',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSLATING = 'TRANSLATING',
  GENERATING_SPEECH = 'GENERATING_SPEECH',
  RENDERING = 'RENDERING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ur-PK', name: 'Urdu' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'pt-BR', name: 'Portuguese' }
];
