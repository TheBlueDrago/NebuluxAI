import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, getPublicSettings } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { clearSignIn, signInAgain, signOut } from '@/lib/signOut';

const AuthContext = createContext();

// Who was signed in last time, saved on this device so the app (above all the home-screen app)
// opens at once instead of waiting on Base44; the real check runs straight after and wins.
// Only used while a sign-in token is saved; cleared with it (lib/signOut.js).
export const ME_KEY = "bh-me";
const cachedMe = () => {
  if (!appParams.token) return null;
  try {
    const u = JSON.parse(localStorage.getItem(ME_KEY) || "null");
    return u && u.id ? u : null;
  } catch {
    return null;
  }
};
const saveMe = (u) => {
  try {
    if (u && u.id) localStorage.setItem(ME_KEY, JSON.stringify(u));
    else localStorage.removeItem(ME_KEY);
  } catch {
    // Storage blocked: the app just waits for the check, as before.
  }
};

export const AuthProvider = ({ children }) => {
  const [early] = useState(cachedMe);
  const [user, setUser] = useState(early);
  const [isAuthenticated, setIsAuthenticated] = useState(!!early);
  const [isLoadingAuth, setIsLoadingAuth] = useState(!early);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(!early);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(!!early);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      if (!early) setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.

      // Ask who's signed in at the same time as the settings instead of after them, so the
      // app appears one network round trip sooner (it matters most on phones).
      const signedIn = appParams.token ? base44.auth.me().then((u) => ({ u }), (e) => ({ e })) : null;

      try {
        const publicSettings = await getPublicSettings();
        setAppPublicSettings(publicSettings);

        // If we got the app public settings successfully, check if user is authenticated
        if (signedIn) {
          await checkUserAuth(signedIn);
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  // `pending`: an answer already on its way from checkAppState ({ u } or { e }).
  const checkUserAuth = async (pending) => {
    try {
      // Now check if the user is authenticated (no spinner when the app already opened)
      if (!early) setIsLoadingAuth(true);
      const answer = pending && typeof pending.then === "function" ? await pending : { u: await base44.auth.me() };
      if (answer.e) throw answer.e;
      const currentUser = answer.u;
      // Never confirmed their email: not let into the site at all. Signed out here and sent to
      // the code screen, which signs them in only once the emailed code is entered.
      if (currentUser && currentUser.is_verified === false && currentUser.role !== "admin") {
        clearSignIn();
        window.location.replace("/register?verify=" + encodeURIComponent(currentUser.email || ""));
        return;
      }
      saveMe(currentUser);
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        saveMe(null);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    // Not base44.auth.logout(): it always leaves for blackhole-ai.base44.app (lib/signOut.js).
    if (shouldRedirect) {
      signOut();
    } else {
      clearSignIn();
    }
  };

  // This site's own sign-in page, not Base44's (the SDK's redirectToLogin goes to
  // blackhole-ai.base44.app, which doesn't reliably come back here). See lib/signOut.js.
  const navigateToLogin = () => {
    signInAgain();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
