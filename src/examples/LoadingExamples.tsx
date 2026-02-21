import { LoadingScreen } from '@/components/UI/LoadingScreen';
import { useProgress, useScenarioProgress } from '@/hooks/useProgress';

// Example 1: Basic Usage
export function BasicLoadingExample() {
  const { progress, isLoading, message, start, complete, reset } = useProgress();

  const handleStart = () => {
    start('Loading your data...');
    // Simulate loading
    setTimeout(() => complete(), 3000);
  };

  return (
    <div>
      <button onClick={handleStart}>Start Loading</button>
      <LoadingScreen 
        isLoading={isLoading} 
        progress={progress} 
        message={message} 
      />
    </div>
  );
}

// Example 2: Manual Progress Control
export function ManualProgressExample() {
  const { progress, isLoading, message, updateProgress, start, complete, reset } = useProgress({
    autoIncrement: false,
  });

  const handleStart = () => {
    start('Uploading file...');
    
    // Simulate file upload with manual progress updates
    const steps = [
      { progress: 10, message: 'Preparing file...' },
      { progress: 30, message: 'Uploading to server...' },
      { progress: 60, message: 'Processing file...' },
      { progress: 90, message: 'Finalizing...' },
      { progress: 100, message: 'Complete!' },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        updateProgress(step.progress, step.message);
        if (step.progress === 100) {
          setTimeout(complete, 500);
        }
      }, (index + 1) * 800);
    });
  };

  return (
    <div>
      <button onClick={handleStart}>Upload File</button>
      <LoadingScreen 
        isLoading={isLoading} 
        progress={progress} 
        message={message} 
      />
    </div>
  );
}

// Example 3: Predefined Scenario
export function ScenarioLoadingExample() {
  const { progress, isLoading, message, start } = useScenarioProgress('appInitialization');

  return (
    <div>
      <button onClick={start}>Initialize App</button>
      <LoadingScreen 
        isLoading={isLoading} 
        progress={progress} 
        message={message} 
      />
    </div>
  );
}

// Example 4: Multiple Steps Loading
export function MultiStepLoadingExample() {
  const { progress, isLoading, message, updateProgress, start, complete, reset } = useProgress({
    autoIncrement: false,
  });

  const handleMultiStepLoad = async () => {
    start('Initializing...');
    
    try {
      // Step 1: Database connection
      updateProgress(20, 'Connecting to database...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Loading user data
      updateProgress(40, 'Loading user data...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3: Syncing messages
      updateProgress(60, 'Syncing messages...');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Step 4: Loading media
      updateProgress(80, 'Loading media files...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Step 5: Final setup
      updateProgress(95, 'Finalizing setup...');
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Complete
      updateProgress(100, 'Ready!');
      setTimeout(complete, 500);
      
    } catch (error) {
      console.error('Loading failed:', error);
      reset();
    }
  };

  return (
    <div>
      <button onClick={handleMultiStepLoad}>Start Multi-Step Load</button>
      <LoadingScreen 
        isLoading={isLoading} 
        progress={progress} 
        message={message} 
      />
    </div>
  );
}
