'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  Settings, 
  Bell, 
  User, 
  LogOut, 
  Palette,
  Shield,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  BarChart3,
  CreditCard,
  Code,
  Building,
  Copy,
  Brain,
  HelpCircle,
  Zap
} from 'lucide-react';
import NotificationBadge from './NotificationBadge';
import { Avatar, ContextMenu, ContextMenuItem } from 'shared/components';
import { useSafeSession } from '../lib/useSafeSession';
import AccountSwitcher from './AccountSwitcher';
import BillingModal from './BillingModal';
import DeveloperPortal from './DeveloperPortal';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme';
import { getProfilePhotos } from '../api/profilePhotos';
import { ProfilePhotos, UserProfile } from '../api/profilePhotos';
import { useWorkAuth } from '../contexts/WorkAuthContext';

interface AvatarContextMenuProps {
  className?: string;
}

export default function AvatarContextMenu({ className }: AvatarContextMenuProps) {
  const { session, status, mounted } = useSafeSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isWorkAuthenticated } = useWorkAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showDeveloperPortal, setShowDeveloperPortal] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const { theme, isDark } = useTheme();
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhotos | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isWorkUIActive, setIsWorkUIActive] = useState(false);
  const profilePhotosFetchInFlight = useRef<Promise<void> | null>(null);

  const PROFILE_PHOTOS_CACHE_KEY = 'vssyl_profile_photos_cache_v1';
  const PROFILE_PHOTOS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  useEffect(() => {
    setHydrated(true);
    if (session?.user) {
      // Load cached photos immediately (fast UI), then refresh in background.
      loadProfilePhotos({ allowCache: true, backgroundRefresh: true });
    }
  }, [session]);

  // Track whether the in-dashboard Work UI (BrandedWorkDashboard) is currently active.
  // This is stored by `WorkTab` and avoids treating a persisted work token as "always business".
  useEffect(() => {
    const readFlag = () => {
      try {
        setIsWorkUIActive(localStorage.getItem('vssyl_work_ui_active') === 'true');
      } catch {
        setIsWorkUIActive(false);
      }
    };

    readFlag();
    const onWorkUIEvent = (e: Event) => {
      const evt = e as CustomEvent<{ active?: boolean }>;
      if (typeof evt.detail?.active === 'boolean') {
        setIsWorkUIActive(evt.detail.active);
      } else {
        readFlag();
      }
    };

    // Cross-tab updates
    window.addEventListener('storage', readFlag);
    // Same-tab updates (WorkTab dispatches this)
    window.addEventListener('vssyl:work-ui-active', onWorkUIEvent);

    return () => {
      window.removeEventListener('storage', readFlag);
      window.removeEventListener('vssyl:work-ui-active', onWorkUIEvent);
    };
  }, []);

  // Refresh profile photos whenever the menu is opened.
  // This ensures profile photo uploads/removals (done elsewhere) show up immediately without a full refresh.
  useEffect(() => {
    if (isOpen && session?.user) {
      // On open, refresh if cache is stale; otherwise use cache.
      loadProfilePhotos({ allowCache: true, backgroundRefresh: true });
    }
  }, [isOpen, session]);

  const readCachedProfilePhotos = (): ProfilePhotos | null => {
    try {
      const raw = localStorage.getItem(PROFILE_PHOTOS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts?: number; photos?: ProfilePhotos };
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.ts !== 'number' || !parsed.photos) return null;
      const age = Date.now() - parsed.ts;
      if (age > PROFILE_PHOTOS_CACHE_TTL_MS) return null;
      return parsed.photos;
    } catch {
      return null;
    }
  };

  const writeCachedProfilePhotos = (photos: ProfilePhotos) => {
    try {
      localStorage.setItem(
        PROFILE_PHOTOS_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), photos })
      );
    } catch {
      // ignore (storage full / disabled)
    }
  };

  const loadProfilePhotos = async (opts?: { allowCache?: boolean; backgroundRefresh?: boolean }) => {
    try {
      const allowCache = opts?.allowCache === true;
      const backgroundRefresh = opts?.backgroundRefresh === true;

      if (allowCache) {
        const cached = readCachedProfilePhotos();
        if (cached) {
          // Fast path: show cached immediately.
          setProfilePhotos(cached);
          // If we don't want background refresh, stop here.
          if (!backgroundRefresh) return;
        }
      }

      // Dedupe in-flight requests.
      if (profilePhotosFetchInFlight.current) {
        await profilePhotosFetchInFlight.current;
        return;
      }

      profilePhotosFetchInFlight.current = (async () => {
      const response = await getProfilePhotos();
      setProfilePhotos(response.photos);
      setUserProfile(response.user);
      writeCachedProfilePhotos(response.photos);
      })();
      await profilePhotosFetchInFlight.current;
    } catch (err) {
      console.error('Error loading profile photos:', err);
    } finally {
      profilePhotosFetchInFlight.current = null;
    }
  };

  // Don't render while loading, not mounted, or not hydrated
  if (!hydrated || !mounted || status === "loading") return null;
  if (!session?.user) return null;

  // Determine whether we're in a business (work) context based on route.
  // Business pages live under /business/*, and the in-dashboard Work experience
  // (BrandedWorkDashboard) keeps you on /dashboard/*. We gate that using a UI flag,
  // not just isWorkAuthenticated, since the work token can persist across personal pages.
  const avatarContext: 'personal' | 'business' =
    pathname?.startsWith('/business/') || (isWorkAuthenticated && isWorkUIActive)
      ? 'business'
      : 'personal';

  // IMPORTANT: Avoid cross-context fallback. If the user set only a business photo, we should not
  // show it on personal pages. Use default photo (NextAuth image) if present, otherwise initials.
  const avatarSrc =
    avatarContext === 'business'
      ? (profilePhotos?.business || profilePhotos?.default || undefined)
      : (profilePhotos?.personal || profilePhotos?.default || undefined);

  const name = session.user.name || session.user.email || "User";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const userEmail = session.user.email || '';
  const userNumber = (session.user as any).userNumber || 'Not assigned';

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    localStorage.setItem('theme', newTheme);
    
    // Apply theme immediately to root element
    const root = document.documentElement;
    let isDark = false;
    
    if (newTheme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      isDark = newTheme === 'dark';
      root.classList.toggle('dark', isDark);
    }
    
    // Trigger a custom event to notify all components that need to update
    window.dispatchEvent(new CustomEvent('themeChange', { 
      detail: { theme: newTheme, isDark }
    }));
    
    // Force CSS re-evaluation by updating a timestamp
    root.style.setProperty('--theme-update', Date.now().toString());
    
    // Show feedback
    toast.success(`Theme changed to ${newTheme}`);
  };

  const handleSignOut = async () => {
    try {
      // Clear any local storage that might interfere
      localStorage.removeItem('lastActiveDashboardId');
      
      // Sign out without automatic redirect so we can control navigation
      const signOutResult = await signOut({ 
        callbackUrl: "/auth/login",
        redirect: false 
      });

      if (signOutResult?.url) {
        router.push(signOutResult.url);
      } else {
        router.push('/auth/login');
      }

      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force redirect to login
      window.location.href = '/auth/login';
    }
  };

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleCopyBlockId = () => {
    navigator.clipboard.writeText(userNumber);
    toast.success('Vssyl ID copied to clipboard!');
  };

  const contextMenuItems: ContextMenuItem[] = [
    // User info section
    {
      label: name,
      disabled: true,
    },
    {
      label: userEmail,
      disabled: true,
    },
    {
      label: `Vssyl ID: ${userNumber}`,
      disabled: true,
      icon: <Copy className="w-4 h-4" />,
      onClick: handleCopyBlockId,
    },
    { divider: true },
    
    // Notifications
    {
      icon: <Bell className="w-4 h-4" />,
      label: 'Notifications',
      onClick: () => {
        router.push('/notifications');
        handleClose();
      },
    },
    
    // Profile and settings
    {
      icon: <User className="w-4 h-4" />,
      label: 'Profile Settings',
      onClick: () => {
        router.push('/profile/settings');
        handleClose();
      },
    },
    {
      icon: <Brain className="w-4 h-4" />,
      label: 'AI Control Center',
      submenu: [
        {
          icon: <BarChart3 className="w-4 h-4" />,
          label: 'AI Overview',
          onClick: () => {
            router.push('/ai');
            handleClose();
          },
        },
        {
          icon: <Settings className="w-4 h-4" />,
          label: 'Autonomy Settings',
          onClick: () => {
            router.push('/ai?tab=autonomy');
            handleClose();
          },
        },
        {
          icon: <User className="w-4 h-4" />,
          label: 'Personality Profile',
          onClick: () => {
            router.push('/ai?tab=personality');
            handleClose();
          },
        },
        {
          icon: <Zap className="w-4 h-4" />,
          label: 'Autonomous Actions',
          onClick: () => {
            router.push('/ai?tab=actions');
            handleClose();
          },
        },
      ],
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: 'Settings',
      onClick: () => {
        router.push('/profile/settings');
        handleClose();
      },
    },
    {
      icon: <CreditCard className="w-4 h-4" />,
      label: 'Billing & Subscriptions',
      onClick: () => {
        setShowBilling(true);
        handleClose();
      },
    },
    {
      icon: <HelpCircle className="w-4 h-4" />,
      label: 'Support & Help',
      onClick: () => {
        router.push('/support');
        handleClose();
      },
    },
    { divider: true },
    
    // Theme toggle
    {
      icon: <Palette className="w-4 h-4" />,
      label: 'Theme',
      submenu: [
        {
          icon: <Sun className="w-4 h-4" />,
          label: `Light${theme === 'light' ? ' ✓' : ''}`,
          onClick: () => {
            handleThemeChange('light');
            handleClose();
          },
        },
        {
          icon: <Moon className="w-4 h-4" />,
          label: `Dark${theme === 'dark' ? ' ✓' : ''}`,
          onClick: () => {
            handleThemeChange('dark');
            handleClose();
          },
        },
        {
          icon: <Monitor className="w-4 h-4" />,
          label: `System${theme === 'system' ? ' ✓' : ''}`,
          onClick: () => {
            handleThemeChange('system');
            handleClose();
          },
        },
      ],
    },
    { divider: true },
    
    // Account switching
    {
      icon: <Shield className="w-4 h-4" />,
      label: 'Switch Accounts',
      onClick: () => {
        setShowAccountSwitcher(true);
        handleClose();
      },
    },
    { divider: true },
    
    // Sign out
    {
      icon: <LogOut className="w-4 h-4" />,
      label: 'Sign Out',
      onClick: handleSignOut,
    },
  ];

  return (
    <>
      {/* Avatar Trigger */}
      <div 
        ref={triggerRef}
        className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        onClick={handleTriggerClick}
        title="User Menu"
      >
        <div className="relative">
          <Avatar
            alt={session.user.name || session.user.email || ''}
            nameOrEmail={session.user.name ? session.user.name : (session.user.email ? session.user.email : '')}
            size={44}
            src={avatarSrc}
            context={avatarContext}
            personalPhoto={profilePhotos?.personal}
            businessPhoto={profilePhotos?.business}
          />
          {/* Online status indicator for chat context */}
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
        </div>
        {/* Removed user name and chevron icon for minimalist avatar menu */}
      </div>

      {/* Context Menu */}
      {isOpen && triggerRef.current && (
        <ContextMenu
          open={isOpen}
          onClose={handleClose}
          anchorPoint={{
            x: triggerRef.current.getBoundingClientRect().right - 200,
            y: triggerRef.current.getBoundingClientRect().bottom + 8,
          }}
          items={contextMenuItems}
        />
      )}

      {/* Account Switcher Modal */}
      {showAccountSwitcher && (
        <AccountSwitcher
          showModal={showAccountSwitcher}
          onClose={() => setShowAccountSwitcher(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <p className="text-gray-600 mb-4">Settings functionality coming soon...</p>
            <button
              onClick={() => setShowSettings(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Billing Modal */}
      <BillingModal
        isOpen={showBilling}
        onClose={() => setShowBilling(false)}
      />
      
      {/* Developer Portal */}
      <DeveloperPortal
        open={showDeveloperPortal}
        onClose={() => setShowDeveloperPortal(false)}
      />
    </>
  );
} 