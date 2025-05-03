import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * Custom hook for tracking recording time
 * @param {boolean} isRecording - Whether recording is active
 * @returns {Object} Recording time state and formatted time
 */
export function useRecordingTimer(isRecording) {
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);

  // Start or stop the timer based on recording state
  useEffect(() => {
    if (isRecording) {
      // Reset timer when starting recording
      setRecordingTime(0);
      
      // Start the timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      // Clear the timer when stopping recording
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // Cleanup on unmount or when isRecording changes
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Format the time as MM:SS
  const formattedRecordingTime = useMemo(() => {
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [recordingTime]);

  // Function to reset the timer
  const resetTimer = useCallback(() => {
    setRecordingTime(0);
  }, []);

  return {
    recordingTime,
    formattedRecordingTime,
    resetTimer
  };
}