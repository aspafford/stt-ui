import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssemblyAIRealtime } from './useAssemblyAIRealtime';

// Mock AssemblyAI RealtimeTranscriber
vi.mock('assemblyai', () => {
  const mockSendAudio = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockClose = vi.fn().mockResolvedValue(undefined);
  
  const mockEventHandlers = {};
  
  // Mock transcriber instance
  const MockTranscriber = vi.fn().mockImplementation(() => ({
    sendAudio: mockSendAudio,
    connect: mockConnect,
    close: mockClose,
    on: (event, handler) => {
      mockEventHandlers[event] = handler;
    }
  }));
  
  // Export mocks so tests can access them
  MockTranscriber.mockEventHandlers = mockEventHandlers;
  MockTranscriber.mockSendAudio = mockSendAudio;
  MockTranscriber.mockConnect = mockConnect;
  MockTranscriber.mockClose = mockClose;
  
  return {
    RealtimeTranscriber: MockTranscriber
  };
});

// Import the mocked transcriber
import { RealtimeTranscriber } from 'assemblyai';

describe('useAssemblyAIRealtime', () => {
  // Mock fetch API
  let originalFetch;
  
  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'mock-token-12345' })
    });
    
    // Reset all mocks
    vi.resetAllMocks();
    
    // Setup console mocks
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
    
    // Clear mocks
    vi.clearAllMocks();
  });
  
  it('initializes with idle status and empty transcripts', () => {
    const { result } = renderHook(() => useAssemblyAIRealtime(false));
    
    // Check initial state
    expect(result.current.connectionStatus).toBe('idle');
    expect(result.current.tempTranscript).toBe('');
    expect(result.current.partialTranscript).toBe('');
    expect(result.current.sttError).toBe('');
    expect(result.current.connectionReady).toBe(false);
  });
  
  it('automatically connects when isActive is true', async () => {
    // Setup mocks for the response
    const mockToken = 'mock-token-12345';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: mockToken })
    });
    
    // Render hook with active state
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Should change status to connecting
    expect(result.current.connectionStatus).toBe('connecting');
    
    // Simulate successful connection
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Status should now be connected
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.connectionReady).toBe(true);
    
    // Verify token fetch and transcriber initialization
    expect(global.fetch).toHaveBeenCalled();
    expect(RealtimeTranscriber).toHaveBeenCalledWith({
      token: mockToken,
      sample_rate: 16000 // Default value
    });
    expect(RealtimeTranscriber.mockConnect).toHaveBeenCalled();
  });
  
  it('handles final and partial transcripts', async () => {
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Simulate connection open
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Simulate receiving a partial transcript
    act(() => {
      RealtimeTranscriber.mockEventHandlers.transcript({
        message_type: 'PartialTranscript',
        text: 'Hello'
      });
    });
    
    // Should update partialTranscript but not tempTranscript
    expect(result.current.partialTranscript).toBe('Hello');
    expect(result.current.tempTranscript).toBe('');
    
    // Simulate receiving a final transcript
    act(() => {
      RealtimeTranscriber.mockEventHandlers.transcript({
        message_type: 'FinalTranscript',
        text: 'Hello world'
      });
    });
    
    // Should update tempTranscript
    expect(result.current.tempTranscript).toBe('Hello world');
    
    // Simulate receiving another final transcript
    act(() => {
      RealtimeTranscriber.mockEventHandlers.transcript({
        message_type: 'FinalTranscript',
        text: 'How are you?'
      });
    });
    
    // Should append to tempTranscript
    expect(result.current.tempTranscript).toBe('Hello world How are you?');
  });
  
  it('handles connection errors', async () => {
    // Mock fetch to return error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Should set error status
    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.sttError).toContain('Failed to connect');
  });
  
  it('handles error during connection', async () => {
    // Mock connect to throw error
    RealtimeTranscriber.mockConnect.mockRejectedValueOnce(new Error('Connection failed'));
    
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Should set error status
    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.sttError).toContain('Connection error');
  });
  
  it('handles error events from transcriber', async () => {
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Simulate connection open
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Simulate error event
    const errorMessage = 'WebSocket connection lost';
    act(() => {
      RealtimeTranscriber.mockEventHandlers.error({ message: errorMessage });
    });
    
    // Should set error status
    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.sttError).toContain(errorMessage);
  });
  
  it('disconnects when isActive becomes false', async () => {
    // Render hook with props
    const { result, waitForNextUpdate, rerender } = renderHook(
      (props) => useAssemblyAIRealtime(props.isActive),
      { initialProps: { isActive: true } }
    );
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Simulate connection open
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Connection should be ready
    expect(result.current.connectionReady).toBe(true);
    
    // Set isActive to false
    rerender({ isActive: false });
    
    // Should call close
    expect(RealtimeTranscriber.mockClose).toHaveBeenCalled();
    
    // Simulate close event
    act(() => {
      RealtimeTranscriber.mockEventHandlers.close();
    });
    
    // Status should be idle again
    expect(result.current.connectionStatus).toBe('idle');
    expect(result.current.connectionReady).toBe(false);
  });
  
  it('sends audio data when ready', async () => {
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Simulate connection open
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Mock audio data
    const mockAudioData = new ArrayBuffer(1024);
    
    // Send audio data
    act(() => {
      result.current.sendAudio(mockAudioData);
    });
    
    // Should call sendAudio on the transcriber
    expect(RealtimeTranscriber.mockSendAudio).toHaveBeenCalledWith(mockAudioData);
  });
  
  it('clears transcripts when requested', async () => {
    // Render hook
    const { result, waitForNextUpdate } = renderHook(() => useAssemblyAIRealtime(true));
    
    // Wait for async operations
    await waitForNextUpdate();
    
    // Simulate connection open
    act(() => {
      RealtimeTranscriber.mockEventHandlers.open();
    });
    
    // Simulate receiving transcripts
    act(() => {
      RealtimeTranscriber.mockEventHandlers.transcript({
        message_type: 'PartialTranscript',
        text: 'Partial text'
      });
      
      RealtimeTranscriber.mockEventHandlers.transcript({
        message_type: 'FinalTranscript',
        text: 'Final text'
      });
    });
    
    // Transcripts should be set
    expect(result.current.partialTranscript).toBe('Partial text');
    expect(result.current.tempTranscript).toBe('Final text');
    
    // Clear transcripts
    act(() => {
      result.current.clearTranscripts();
    });
    
    // Transcripts should be cleared
    expect(result.current.partialTranscript).toBe('');
    expect(result.current.tempTranscript).toBe('');
  });
});