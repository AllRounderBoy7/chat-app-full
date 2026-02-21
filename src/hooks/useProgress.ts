import { useState, useEffect, useCallback } from 'react';

interface UseProgressOptions {
  duration?: number;
  steps?: number;
  autoIncrement?: boolean;
}

export function useProgress(options: UseProgressOptions = {}) {
  const { duration = 3000, steps = 100, autoIncrement = true } = options;
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Loading...');

  const start = useCallback((customMessage?: string) => {
    setIsLoading(true);
    setProgress(0);
    setMessage(customMessage || 'Loading...');
  }, []);

  const updateProgress = useCallback((value: number, customMessage?: string) => {
    setProgress(Math.min(100, Math.max(0, value)));
    if (customMessage) {
      setMessage(customMessage);
    }
  }, []);

  const increment = useCallback((amount = 1, customMessage?: string) => {
    setProgress(prev => Math.min(100, prev + amount));
    if (customMessage) {
      setMessage(customMessage);
    }
  }, []);

  const complete = useCallback(() => {
    setProgress(100);
    setMessage('Complete!');
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setMessage('Loading...');
    }, 500);
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setIsLoading(false);
    setMessage('Loading...');
  }, []);

  // Auto increment functionality
  useEffect(() => {
    if (!autoIncrement || !isLoading || progress >= 100) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (100 / steps);
        if (next >= 100) {
          complete();
          return 100;
        }
        return next;
      });
    }, duration / steps);

    return () => clearInterval(interval);
  }, [autoIncrement, isLoading, progress, steps, duration, complete]);

  return {
    progress,
    isLoading,
    message,
    start,
    updateProgress,
    increment,
    complete,
    reset,
  };
}

// Predefined loading scenarios
export const loadingScenarios = {
  appInitialization: {
    duration: 2000,
    steps: 50,
    messages: [
      'Initializing app...',
      'Loading components...',
      'Setting up database...',
      'Almost ready...',
    ]
  },
  dataSync: {
    duration: 3000,
    steps: 75,
    messages: [
      'Syncing data...',
      'Updating messages...',
      'Fetching contacts...',
      'Finalizing sync...',
    ]
  },
  mediaUpload: {
    duration: 5000,
    steps: 100,
    messages: [
      'Preparing media...',
      'Uploading file...',
      'Processing...',
      'Almost done...',
    ]
  }
};

// Hook for predefined scenarios
export function useScenarioProgress(scenario: keyof typeof loadingScenarios) {
  const config = loadingScenarios[scenario];
  const { progress, isLoading, message, start, updateProgress, complete, reset } = useProgress({
    duration: config.duration,
    steps: config.steps,
    autoIncrement: false,
  });

  const startScenario = useCallback(() => {
    start(config.messages[0]);
    
    // Update message at different progress points
    const messagePoints = [25, 50, 75, 90];
    messagePoints.forEach((point, index) => {
      setTimeout(() => {
        if (index < config.messages.length - 1) {
          updateProgress(point, config.messages[index]);
        }
      }, (config.duration * point) / 100);
    });

    // Auto complete
    setTimeout(() => {
      updateProgress(100, config.messages[config.messages.length - 1]);
      setTimeout(complete, 500);
    }, config.duration);
  }, [scenario, start, updateProgress, complete, config]);

  return {
    progress,
    isLoading,
    message,
    start: startScenario,
    reset,
  };
}
