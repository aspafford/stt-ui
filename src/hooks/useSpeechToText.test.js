import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as React from 'react';
import { useSpeechToText } from './useSpeechToText';

// Mock MediaStream
class MockMediaStream {
  constructor() {
    this.active = true;
    this.id = 'mock-stream-id';
  }
  
  getTracks() {
    return [{ stop: vi.fn() }];
  }
  
  getAudioTracks() {
    return this.getTracks();
  }
}

// Add to global
global.MediaStream = MockMediaStream;

// Mock the dependent hooks
vi.mock('./useMicrophonePermission', () => ({
  useMicrophonePermission: vi.fn()
}));

vi.mock('./useAudioProcessing', () => ({
  useAudioProcessing: vi.fn()
}));

vi.mock('./useAssemblyAIRealtime', () => ({
  useAssemblyAIRealtime: vi.fn()
}));

vi.mock('./useAudioVisualization', () => ({
  useAudioVisualization: vi.fn()
}));

vi.mock('./useRecordingTimer', () => ({
  useRecordingTimer: vi.fn()
}));

// Import the mocked hooks
import { useMicrophonePermission } from './useMicrophonePermission';
import { useAudioProcessing } from './useAudioProcessing';
import { useAssemblyAIRealtime } from './useAssemblyAIRealtime';
import { useAudioVisualization } from './useAudioVisualization';
import { useRecordingTimer } from './useRecordingTimer';

describe('useSpeechToText', () => {
  // Create a mock implementation for each hook
  const mockRequestPermission = vi.fn();
  const mockCleanupMicrophone = vi.fn();
  const mockSendAudio = vi.fn();
  const mockClearTranscripts = vi.fn();
  const mockDisconnectAssemblyAI = vi.fn();
  const mockGetAudioContext = vi.fn();
  const mockGetSampleRate = vi.fn();
  const mockResetTimer = vi.fn();
  
  // Setup vi.spyOn for console methods
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Reset mock functions
    mockRequestPermission.mockReset();
    mockCleanupMicrophone.mockReset();
    mockSendAudio.mockReset();
    mockClearTranscripts.mockReset();
    mockDisconnectAssemblyAI.mockReset();
    mockGetAudioContext.mockReset();
    mockGetSampleRate.mockReset();
    mockResetTimer.mockReset();
    
    // Mock useMicrophonePermission
    useMicrophonePermission.mockReturnValue({
      permissionStatus: 'granted',
      permissionError: '',
      mediaStream: new MediaStream(),
      requestPermission: mockRequestPermission,
      cleanup: mockCleanupMicrophone
    });
    
    // Mock useAssemblyAIRealtime
    useAssemblyAIRealtime.mockReturnValue({
      tempTranscript: '',
      partialTranscript: '',
      connectionStatus: 'idle',
      connectionReady: false,
      sttError: '',
      connect: vi.fn(),
      disconnect: mockDisconnectAssemblyAI,
      sendAudio: mockSendAudio,
      clearTranscripts: mockClearTranscripts
    });
    
    // Mock useAudioVisualization
    useAudioVisualization.mockReturnValue({
      audioLevel: 0,
      getAudioContext: mockGetAudioContext
    });
    
    // Mock useAudioProcessing
    useAudioProcessing.mockReturnValue({
      getSampleRate: mockGetSampleRate
    });
    
    // Mock useRecordingTimer
    useRecordingTimer.mockReturnValue({
      formattedRecordingTime: '00:00',
      resetTimer: mockResetTimer
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  
  it('initializes with default state', () => {
    const { result } = renderHook(() => useSpeechToText());
    
    // Check initial state
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.errorMessage).toBe('');
  });
  
  it('starts listening when toggleListening is called and not already listening', async () => {
    const { result } = renderHook(() => useSpeechToText());
    
    await act(async () => {
      await result.current.toggleListening();
    });
    
    // Should set isListening to true
    expect(result.current.isListening).toBe(true);
    
    // Should call necessary functions
    expect(mockClearTranscripts).toHaveBeenCalled();
    expect(mockResetTimer).toHaveBeenCalled();
  });
  
  it('requests permission if not already granted', async () => {
    // Mock permission not granted
    useMicrophonePermission.mockReturnValue({
      permissionStatus: 'prompt',
      permissionError: '',
      mediaStream: null,
      requestPermission: mockRequestPermission.mockResolvedValue(new MediaStream()),
      cleanup: mockCleanupMicrophone
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    await act(async () => {
      await result.current.startListening();
    });
    
    // Should request permission
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
  });
  
  it('does not start listening if permission is denied', async () => {
    // Mock permission denied
    useMicrophonePermission.mockReturnValue({
      permissionStatus: 'prompt',
      permissionError: 'Permission denied',
      mediaStream: null,
      requestPermission: mockRequestPermission.mockResolvedValue(null),
      cleanup: mockCleanupMicrophone
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    await act(async () => {
      const success = await result.current.startListening();
      expect(success).toBe(false);
    });
    
    // Should not set isListening to true
    expect(result.current.isListening).toBe(false);
  });
  
  it('stops listening when toggleListening is called and already listening', async () => {
    // Setup hook in listening state
    const { result } = renderHook(() => useSpeechToText());
    
    await act(async () => {
      await result.current.toggleListening(); // Start listening
    });
    
    expect(result.current.isListening).toBe(true);
    
    // Now stop listening
    act(() => {
      result.current.toggleListening();
    });
    
    // Should set isProcessing to true immediately
    expect(result.current.isProcessing).toBe(true);
    
    // Should not set isListening to false immediately (due to delay)
    expect(result.current.isListening).toBe(true);
    
    // Advance timer to complete first timeout
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    // Now isListening should be false
    expect(result.current.isListening).toBe(false);
    
    // Advance timer to complete second timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // isProcessing should now be false
    expect(result.current.isProcessing).toBe(false);
  });
  
  it('updates transcript when tempTranscript is available after stopping', async () => {
    // Mock tempTranscript with some content
    useAssemblyAIRealtime.mockReturnValue({
      tempTranscript: 'Hello world',
      partialTranscript: '',
      connectionStatus: 'connected',
      connectionReady: true,
      sttError: '',
      connect: vi.fn(),
      disconnect: mockDisconnectAssemblyAI,
      sendAudio: mockSendAudio,
      clearTranscripts: mockClearTranscripts
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    // Start listening
    await act(async () => {
      await result.current.toggleListening();
    });
    
    // Stop listening
    act(() => {
      result.current.toggleListening();
    });
    
    // Advance timer through both delays
    act(() => {
      vi.advanceTimersByTime(1500); // First delay
      vi.advanceTimersByTime(500);  // Second delay
    });
    
    // Transcript should be updated with tempTranscript
    expect(result.current.transcript).toBe('Hello world');
  });
  
  it.skip('appends tempTranscript to existing transcript with proper spacing', async () => {
    // Create a simple mock test
    let initialTranscript = 'Existing transcript';
    let finalTranscript = '';
    
    // Setup mock for useState to track the transcript
    vi.spyOn(React, 'useState').mockImplementation((initial) => {
      // This mock implementation only works for the transcript state
      if (initial === '') {
        return [initialTranscript, (val) => {
          if (typeof val === 'function') {
            finalTranscript = val(initialTranscript);
          } else {
            finalTranscript = val;
          }
        }];
      }
      // For other states, return simple values
      return [initial, vi.fn()];
    });
    
    // Mock useAssemblyAIRealtime to return a tempTranscript
    useAssemblyAIRealtime.mockReturnValue({
      tempTranscript: 'new content',
      partialTranscript: '',
      connectionStatus: 'connected',
      connectionReady: true,
      sttError: '',
      connect: vi.fn(),
      disconnect: mockDisconnectAssemblyAI,
      sendAudio: mockSendAudio,
      clearTranscripts: mockClearTranscripts
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    // First check initial transcript
    expect(result.current.transcript).toBe(initialTranscript);
    
    // Manually call stopListening which should append the tempTranscript
    await act(async () => {
      await result.current.stopListening();
      
      // Advance timer to simulate delay
      vi.advanceTimersByTime(2000);
    });
    
    // The useState mock should have been called with a function that
    // combines existing text with tempTranscript
    expect(finalTranscript).toBe('Existing transcript new content');
  });
  
  it.skip('clears transcript when clearTranscript is called', () => {
    // Setup transcript state tracking
    let transcriptState = 'Test transcript';
    let setTranscriptCalled = false;
    
    // Mock useState for transcript
    vi.spyOn(React, 'useState').mockImplementation((initial) => {
      // This mock implementation only works for the transcript state
      if (initial === '') {
        return [transcriptState, (val) => {
          setTranscriptCalled = true;
          transcriptState = '';
        }];
      }
      // For other states, return simple values
      return [initial, vi.fn()];
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    // Initial state
    expect(result.current.transcript).toBe('Test transcript');
    
    // Call clearTranscript
    act(() => {
      result.current.clearTranscript();
    });
    
    // Verify transcript was cleared
    expect(setTranscriptCalled).toBe(true);
    
    // Should call clearTranscripts on the AssemblyAI hook
    expect(mockClearTranscripts).toHaveBeenCalled();
  });
  
  it('properly combines error messages from different sources', () => {
    // Mock permission error
    useMicrophonePermission.mockReturnValue({
      permissionStatus: 'denied',
      permissionError: 'Microphone permission denied',
      mediaStream: null,
      requestPermission: mockRequestPermission,
      cleanup: mockCleanupMicrophone
    });
    
    const { result } = renderHook(() => useSpeechToText());
    
    // Should have permission error
    expect(result.current.errorMessage).toBe('Microphone permission denied');
    
    // Mock STT error
    useMicrophonePermission.mockReturnValue({
      permissionStatus: 'granted',
      permissionError: '',
      mediaStream: new MediaStream(),
      requestPermission: mockRequestPermission,
      cleanup: mockCleanupMicrophone
    });
    
    useAssemblyAIRealtime.mockReturnValue({
      tempTranscript: '',
      partialTranscript: '',
      connectionStatus: 'error',
      connectionReady: false,
      sttError: 'Failed to connect to AssemblyAI',
      connect: vi.fn(),
      disconnect: mockDisconnectAssemblyAI,
      sendAudio: mockSendAudio,
      clearTranscripts: mockClearTranscripts
    });
    
    // Re-render with new mocks
    const { result: newResult } = renderHook(() => useSpeechToText());
    
    // Should have STT error
    expect(newResult.current.errorMessage).toBe('Failed to connect to AssemblyAI');
  });
  
  it('cleans up resources on unmount', () => {
    const { unmount } = renderHook(() => useSpeechToText());
    
    // Unmount to trigger cleanup
    unmount();
    
    // Should call cleanup functions
    expect(mockDisconnectAssemblyAI).toHaveBeenCalled();
    expect(mockCleanupMicrophone).toHaveBeenCalled();
  });
});