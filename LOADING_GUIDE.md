# Loading Screen with Percentage Progress - Usage Guide

## Overview

Your Ourdm web app now includes a beautiful loading screen with percentage progress indicators. The loading system provides real-time feedback during app initialization and other async operations.

## Features

- **🎨 Beautiful Design**: Modern gradient backgrounds with glassmorphism effects
- **📊 Percentage Display**: Real-time progress percentage with smooth animations
- **📱 Mobile Optimized**: Touch-friendly interface with safe area support
- **🔄 Multiple Scenarios**: Support for different loading scenarios
- **⚡ Performance**: Optimized animations and smooth transitions

## Components

### 1. LoadingScreen Component
```tsx
import { LoadingScreen } from '@/components/UI/LoadingScreen';

<LoadingScreen 
  isLoading={isLoading}
  progress={progress} 
  message="Loading your data..."
  onComplete={() => console.log('Loading complete!')}
/>
```

### 2. useProgress Hook
```tsx
import { useProgress } from '@/hooks/useProgress';

const { 
  progress, 
  isLoading, 
  message, 
  updateProgress, 
  complete, 
  reset 
} = useProgress({
  duration: 3000,
  steps: 50,
  autoIncrement: false,
});
```

### 3. Predefined Scenarios
```tsx
import { useScenarioProgress } from '@/hooks/useProgress';

const { progress, isLoading, message, start } = useScenarioProgress('appInitialization');
```

## Usage Examples

### Basic Loading
```tsx
function MyComponent() {
  const { progress, isLoading, message, updateProgress, complete } = useProgress();

  const handleLoad = async () => {
    updateProgress(10, 'Starting...');
    await doSomething();
    updateProgress(50, 'Processing...');
    await doSomethingElse();
    updateProgress(100, 'Complete!');
    setTimeout(complete, 500);
  };

  return (
    <>
      <button onClick={handleLoad}>Start Loading</button>
      <LoadingScreen isLoading={isLoading} progress={progress} message={message} />
    </>
  );
}
```

### File Upload with Progress
```tsx
function FileUploader() {
  const { progress, isLoading, message, updateProgress, complete, reset } = useProgress();

  const uploadFile = async (file) => {
    updateProgress(0, 'Preparing upload...');
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      updateProgress(i, `Uploading... ${i}%`);
    }
    
    complete();
  };

  return (
    <LoadingScreen isLoading={isLoading} progress={progress} message={message} />
  );
}
```

### App Initialization (Already Integrated)
The loading screen is automatically integrated into your app initialization:

1. **5%** - Starting app
2. **10%** - Initializing database
3. **20%** - Setting up media storage
4. **30%** - Requesting storage permissions
5. **40%** - Checking authentication
6. **50%** - Loading user profile
7. **60%** - Setting up profile
8. **70%** - Updating online status
9. **75%** - Initializing friend service
10. **80%** - Starting sync service
11. **85%** - Setting up real-time updates
12. **90%** - Configuring call service
13. **95%** - Loading user data
14. **100%** - Ready!

## Available Scenarios

### appInitialization
- Duration: 2000ms
- Steps: 50
- Messages: Initializing, Loading components, Setting up database, Almost ready

### dataSync
- Duration: 3000ms
- Steps: 75
- Messages: Syncing data, Updating messages, Fetching contacts, Finalizing sync

### mediaUpload
- Duration: 5000ms
- Steps: 100
- Messages: Preparing media, Uploading file, Processing, Almost done

## Customization

### Custom Messages
```tsx
updateProgress(25, 'Custom message here...');
```

### Custom Duration and Steps
```tsx
const { progress } = useProgress({
  duration: 5000,  // 5 seconds
  steps: 100,     // 100 steps
  autoIncrement: true,
});
```

### Manual Control
```tsx
// Start loading
updateProgress(0, 'Starting...');

// Update progress
updateProgress(50, 'Half way there...');

// Complete loading
updateProgress(100, 'Complete!');
setTimeout(complete, 500);

// Reset if needed
reset();
```

## Styling

The loading screen uses Tailwind CSS classes and can be customized:

```tsx
// Custom styling through props
<LoadingScreen 
  isLoading={isLoading}
  progress={progress}
  message={message}
  className="custom-class"
/>
```

## Performance Tips

1. **Use autoIncrement** for simple progress bars
2. **Manual control** for complex operations with known steps
3. **Predefined scenarios** for common use cases
4. **Reset** after completion to reuse the hook

## Integration Notes

The loading system is already integrated into:
- App initialization
- Database operations
- Authentication flows
- Real-time sync setup

You can easily add it to other parts of your app using the hooks and components provided.

## Troubleshooting

### Loading Not Showing
- Make sure `isLoading` is true
- Check that progress is being updated
- Verify the LoadingScreen component is rendered

### Progress Not Updating
- Ensure `updateProgress` is being called
- Check that progress values are between 0-100
- Verify autoIncrement is disabled for manual control

### Animation Issues
- Check CSS imports in index.css
- Ensure animations.css is in the correct path
- Verify Tailwind CSS is properly configured
