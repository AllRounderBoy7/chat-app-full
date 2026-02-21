import React, { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface LoadingScreenProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
  onComplete?: () => void;
}

export function LoadingScreen({ 
  isLoading, 
  progress = 0, 
  message = 'Loading...', 
  onComplete 
}: LoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsComplete(false);
      setDisplayProgress(0);
    }
  }, [isLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (displayProgress < progress) {
        setDisplayProgress(prev => Math.min(prev + 1, progress));
      } else if (displayProgress > progress) {
        setDisplayProgress(prev => Math.max(prev - 1, progress));
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [displayProgress, progress]);

  useEffect(() => {
    if (progress === 100 && displayProgress === 100 && !isComplete) {
      setIsComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }
  }, [progress, displayProgress, isComplete, onComplete]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-8 p-8">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 shadow-2xl">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl animate-pulse" />
            </div>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
            <span className="text-white text-lg">✨</span>
          </div>
        </div>

        {/* Percentage Display */}
        <div className="text-center">
          <div className="text-6xl font-bold text-white mb-2 tabular-nums">
            {displayProgress}%
          </div>
          <div className="text-white/80 text-lg font-medium">
            {message}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-80 max-w-full">
          <div className="relative h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-white to-white/80 rounded-full transition-all duration-300 ease-out shadow-lg"
              style={{ width: `${displayProgress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-between mt-4 px-2">
            {[0, 25, 50, 75, 100].map((value) => (
              <div
                key={value}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  displayProgress >= value 
                    ? 'bg-white shadow-lg scale-125' 
                    : 'bg-white/30'
                )}
              />
            ))}
          </div>
        </div>

        {/* Loading States */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                'w-3 h-3 bg-white rounded-full transition-all duration-300',
                isComplete ? 'scale-0' : 'animate-bounce'
              )}
              style={{ animationDelay: `${index * 150}ms` }}
            />
          ))}
        </div>

        {/* Completion Animation */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-white/20 rounded-full animate-ping" />
            <div className="absolute w-24 h-24 bg-white/30 rounded-full animate-ping delay-100" />
            <div className="absolute w-16 h-16 bg-white/40 rounded-full animate-ping delay-200" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/60 text-sm">
          OurDM v3.0.0 • Secure Messaging
        </p>
      </div>
    </div>
  );
}

// Simplified version for quick usage
export function SimpleLoadingScreen({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
      <div className="text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <div className="w-8 h-8 bg-white rounded-xl animate-pulse" />
        </div>
        <div className="text-white text-lg font-medium">Loading...</div>
        <div className="flex justify-center space-x-2 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
