import { vi } from 'vitest';

// Create mock functions for all hook functions and states
const mockUseSpeechToText = vi.fn().mockReturnValue({
  // State
  isListening: false,
  isProcessing: false,
  permissionStatus: 'idle',
  connectionStatus: 'idle',
  audioLevel: 0,
  transcript: '',
  tempTranscript: '',
  partialTranscript: '',
  formattedRecordingTime: '00:00',
  errorMessage: '',
  
  // Functions
  startListening: vi.fn().mockResolvedValue(true),
  stopListening: vi.fn(),
  toggleListening: vi.fn(),
  clearTranscript: vi.fn(),
  
  // Raw access to inner functions
  sendAudio: vi.fn(),
  getAudioContext: vi.fn(),
  getSampleRate: vi.fn().mockReturnValue(16000)
});

// Export the mock hooks
export const useSpeechToText = mockUseSpeechToText;

// We don't need to mock the individual hooks since they're not
// used directly in the VoiceInput component, but we'll define
// them anyway for completeness
export const useMicrophonePermission = vi.fn();
export const useAudioVisualization = vi.fn();
export const useRecordingTimer = vi.fn();
export const useAudioProcessing = vi.fn();
export const useAssemblyAIRealtime = vi.fn();