import { useState, useEffect } from 'react';
import { 
  MessageCircle, Mail, Lock, User, Eye, EyeOff, 
  ShieldCheck, Zap, CheckCircle, AlertCircle,
  Video, Users, Shield, Wifi, WifiOff, Smartphone, Download
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, name: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onAdminLogin: () => void;
  logoClickCount: number;
  setLogoClickCount: (count: number) => void;
}

// 3D Button Component
const Button3D = ({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary',
  className = '',
  type = 'button'
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'google';
  className?: string;
  type?: 'button' | 'submit';
}) => {
  const baseStyles = "relative w-full font-bold text-sm transition-all duration-150 ease-out transform-gpu select-none";
  
  const variants = {
    primary: `
      bg-gradient-to-b from-indigo-400 via-indigo-500 to-indigo-600
      text-white
      shadow-[0_6px_0_0_#4338ca,0_8px_12px_rgba(67,56,202,0.4)]
      hover:shadow-[0_4px_0_0_#4338ca,0_6px_10px_rgba(67,56,202,0.5)]
      hover:translate-y-[2px]
      active:shadow-[0_0px_0_0_#4338ca,0_2px_6px_rgba(67,56,202,0.4)]
      active:translate-y-[6px]
      rounded-2xl py-4
      border-t border-indigo-300/30
    `,
    secondary: `
      bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600
      text-white
      shadow-[0_5px_0_0_#7c3aed,0_7px_10px_rgba(124,58,237,0.3)]
      hover:shadow-[0_3px_0_0_#7c3aed,0_5px_8px_rgba(124,58,237,0.4)]
      hover:translate-y-[2px]
      active:shadow-[0_0px_0_0_#7c3aed,0_2px_5px_rgba(124,58,237,0.3)]
      active:translate-y-[5px]
      rounded-xl py-3
      border-t border-purple-300/30
    `,
    google: `
      bg-gradient-to-b from-white via-gray-50 to-gray-100
      text-gray-700
      shadow-[0_5px_0_0_#d1d5db,0_7px_10px_rgba(0,0,0,0.1)]
      hover:shadow-[0_3px_0_0_#d1d5db,0_5px_8px_rgba(0,0,0,0.15)]
      hover:translate-y-[2px]
      active:shadow-[0_0px_0_0_#d1d5db,0_2px_5px_rgba(0,0,0,0.1)]
      active:translate-y-[5px]
      rounded-xl py-3.5
      border border-gray-200
    `
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseStyles,
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed translate-y-0 shadow-none',
        className
      )}
    >
      {children}
    </button>
  );
};

// 3D Input Component
const Input3D = ({
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
  rightElement,
  error
}: {
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon: React.ElementType;
  rightElement?: React.ReactNode;
  error?: boolean;
}) => {
  const [focused, setFocused] = useState(false);
  
  return (
    <div className={cn(
      "relative group transition-all duration-200",
      focused && "transform scale-[1.02]"
    )}>
      <div className={cn(
        "absolute inset-0 rounded-xl transition-all duration-200",
        focused 
          ? "bg-indigo-500/20 blur-md" 
          : "bg-black/20 translate-y-1"
      )} />
      
      <div className={cn(
        "relative flex items-center bg-white/[0.05] border rounded-xl transition-all duration-200",
        focused 
          ? "border-indigo-500/50 bg-white/[0.08]" 
          : error 
            ? "border-red-500/50" 
            : "border-white/10"
      )}>
        <Icon className={cn(
          "absolute left-4 w-5 h-5 transition-colors duration-200",
          focused ? "text-indigo-400" : "text-white/30"
        )} />
        <input 
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 bg-transparent text-white placeholder-white/30 outline-none text-sm font-medium"
        />
        {rightElement && (
          <div className="absolute right-4">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
};

export function AuthScreen({ 
  onLogin, 
  onSignup, 
  onGoogleLogin, 
  onAdminLogin,
  logoClickCount,
  setLogoClickCount
}: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Password strength checker
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 8) strength += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
    
    setPasswordStrength(strength);
  }, [password]);

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    
    if (navigator.vibrate) {
      navigator.vibrate(newCount >= 5 ? [50, 30, 50] : 10);
    }
    
    if (newCount >= 5) {
      onAdminLogin();
      setLogoClickCount(0);
    }
  };

  const validateForm = (): boolean => {
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    
    if (!password) {
      setError('Please enter your password');
      return false;
    }
    
    if (authMode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your name');
        return false;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      
      if (!agreedToTerms) {
        setError('Please agree to Terms & Privacy Policy');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        await onLogin(email, password);
        setSuccess('Welcome back!');
      } else {
        await onSignup(email, password, name);
        setSuccess('Account created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    
    setError('');
    setGoogleLoading(true);
    
    try {
      await onGoogleLogin();
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-hidden">
      
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Online/Offline Indicator */}
      <div className={cn(
        "fixed top-4 left-4 z-50 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 backdrop-blur-sm",
        isOnline 
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30"
      )}>
        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isOnline ? 'Online' : 'Offline'}
      </div>

      {/* Desktop Feature Cards */}
      <div className="hidden lg:block fixed top-[15%] left-[8%] animate-float">
        <div className="p-4 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">End-to-End Encrypted</p>
            <p className="text-white/40 text-xs">Your messages are private</p>
          </div>
        </div>
      </div>
      
      <div className="hidden lg:block fixed top-[30%] right-[8%] animate-float" style={{ animationDelay: '1s' }}>
        <div className="p-4 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">HD Video Calls</p>
            <p className="text-white/40 text-xs">Crystal clear quality</p>
          </div>
        </div>
      </div>
      
      <div className="hidden lg:block fixed bottom-[30%] left-[8%] animate-float" style={{ animationDelay: '2s' }}>
        <div className="p-4 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Group Chats</p>
            <p className="text-white/40 text-xs">Up to 256 members</p>
          </div>
        </div>
      </div>
      
      <div className="hidden lg:block fixed bottom-[15%] right-[8%] animate-float" style={{ animationDelay: '3s' }}>
        <div className="p-4 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Lightning Fast</p>
            <p className="text-white/40 text-xs">Instant message delivery</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-[420px] z-10">
        <div className="relative">
          {/* Card Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] blur-xl opacity-30" />
          
          {/* Glass Card */}
          <div className="relative bg-gradient-to-b from-white/[0.12] to-white/[0.04] backdrop-blur-2xl rounded-[2rem] p-7 sm:p-9 border border-white/20 shadow-2xl">
            
            {/* Logo - 5 clicks for admin */}
            <div className="text-center mb-7">
              <button 
                onClick={handleLogoClick}
                className="relative w-24 h-24 mx-auto mb-4 group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
                
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_10px_30px_rgba(99,102,241,0.4)] transform transition-all duration-200 group-hover:scale-105 group-active:scale-95">
                  <MessageCircle className="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                
                {/* Tap Counter Badge */}
                {logoClickCount > 0 && logoClickCount < 5 && (
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg animate-bounce">
                    {5 - logoClickCount}
                  </div>
                )}
              </button>
              
              <h1 className="text-4xl font-black bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent tracking-tight">
                Ourdm
              </h1>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em] mt-1">
                Private & Secure Messaging
              </p>
            </div>

            {/* Auth Mode Tabs */}
            <div className="relative flex gap-2 p-1.5 mb-6 bg-black/30 rounded-2xl">
              <button
                onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}
                className={cn(
                  "relative flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200",
                  authMode === 'login' 
                    ? "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white shadow-[0_4px_0_0_#4338ca]" 
                    : "text-white/40 hover:text-white/60"
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setError(''); setSuccess(''); }}
                className={cn(
                  "relative flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200",
                  authMode === 'signup' 
                    ? "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white shadow-[0_4px_0_0_#4338ca]" 
                    : "text-white/40 hover:text-white/60"
                )}
              >
                Sign Up
              </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs font-medium">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-green-400 text-xs font-medium">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {authMode === 'signup' && (
                <Input3D
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  icon={User}
                />
              )}

              <Input3D
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                icon={Mail}
              />
              
              <Input3D
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                icon={Lock}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
              />

              {/* Password Strength */}
              {authMode === 'signup' && password && (
                <div className="space-y-2 px-1">
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i < passwordStrength ? strengthColors[passwordStrength - 1] : 'rgba(255,255,255,0.1)'
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/30">
                    Strength: <span style={{ color: passwordStrength > 0 ? strengthColors[passwordStrength - 1] : 'inherit' }} className="font-semibold">
                      {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : 'Enter password'}
                    </span>
                  </p>
                </div>
              )}

              {authMode === 'signup' && (
                <Input3D
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  icon={Lock}
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
              )}

              {/* Terms */}
              {authMode === 'signup' && (
                <label className="flex items-start gap-3 cursor-pointer px-1">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200",
                      agreedToTerms 
                        ? "bg-indigo-500 border-indigo-500 shadow-[0_2px_0_0_#4338ca]" 
                        : "border-white/20 hover:border-white/40"
                    )}>
                      {agreedToTerms && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    I agree to the <a href="#" className="text-indigo-400 hover:underline">Terms</a> and <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>
                  </span>
                </label>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button3D 
                  type="submit" 
                  variant="primary"
                  disabled={loading || !isOnline}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {authMode === 'login' ? 'Sign In Securely' : 'Create Account'}
                        <span className="text-lg">→</span>
                      </>
                    )}
                  </span>
                </Button3D>
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center mt-5 mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <span className="relative px-4 text-[10px] text-white/30 font-semibold uppercase tracking-widest bg-transparent">
                Or continue with
              </span>
            </div>

            {/* Google Sign In */}
            <Button3D 
              onClick={handleGoogleSignIn}
              variant="google"
              disabled={googleLoading || !isOnline}
            >
              <span className="flex items-center justify-center gap-3">
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </span>
            </Button3D>

            {/* Features */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                { icon: Shield, label: 'Encrypted', color: 'from-green-400 to-emerald-600' },
                { icon: Smartphone, label: 'PWA Ready', color: 'from-blue-400 to-cyan-600' },
                { icon: Zap, label: 'Real-time', color: 'from-yellow-400 to-orange-600' },
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:bg-white/[0.06] transition-colors"
                >
                  <div className={cn("w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg", feature.color)}>
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-[10px] text-white/50 font-medium">{feature.label}</p>
                </div>
              ))}
            </div>

            {/* Branding */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <ShieldCheck className="w-3 h-3 text-green-500" />
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em]">
                  Made with ❤️ by Sameer Shah
                </p>
              </div>
              <p className="text-white/20 text-[8px] font-medium">
                © 2025 Ourdm Privacy Systems • v3.0.0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PWA Install Button */}
      {showInstallPrompt && (
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={handleInstallApp}
            className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full text-white text-sm font-bold shadow-lg shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Install App
          </button>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default AuthScreen;
