import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from '../services/firebase';

const AuthContext = createContext({
  user: null,
  session: null,
  userMetadata: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
  updateUserMetadata: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [userMetadata, setUserMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    // Safety timer to prevent infinite loading screen
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          setSession({ user: firebaseUser });
          
          try {
            if (firebaseUser.phoneNumber) {
              const { getOrCreateUserByPhone } = require('../services/userService');
              const userRec = await getOrCreateUserByPhone(firebaseUser.phoneNumber, firebaseUser.uid);
              setUserMetadata({
                uid: userRec.uid,
                name: userRec.name || '',
                phone: userRec.phone || firebaseUser.phoneNumber,
                email: userRec.email || firebaseUser.email || ''
              });
            } else {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                setUserMetadata(userSnap.data());
              } else {
                const meta = {
                  uid: firebaseUser.uid,
                  name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : ''),
                  email: firebaseUser.email || '',
                  phone: firebaseUser.phoneNumber || '',
                  createdAt: new Date().toISOString()
                };
                setUserMetadata(meta);
              }
            }
          } catch (e) {
            console.error('Error fetching user metadata from Firestore:', e);
            setUserMetadata({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '',
              phone: firebaseUser.phoneNumber || '',
              email: firebaseUser.email || ''
            });
          }
        } else {
          setUser(null);
          setSession(null);
          setUserMetadata(null);
        }
      } catch (err) {
        console.error("Auth state listener error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // Update user metadata in Firestore
  const updateUserMetadata = async (metadata) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, metadata, { merge: true });
      setUserMetadata(prev => ({ ...prev, ...metadata }));
    } catch (error) {
      console.error('Failed to update user metadata:', error);
    }
  };

  // Sign up with email & password using Firebase
  const signUp = async (email, password, metadata) => {
    try {
      console.log('Starting Firebase signup for:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const userDoc = {
        uid: firebaseUser.uid,
        email: email,
        ...metadata,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
      setUserMetadata(userDoc);
      return { error: null };
    } catch (error) {
      console.error('Firebase Signup error:', error);
      let message = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      }
      return { error: { message, code: error.code } };
    }
  };

  // Sign in with email & password
  const signIn = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      console.error('Firebase Signin error:', error);
      return { error: { message: error.message, code: error.code } };
    }
  };

  // Sign in with Google (stub / fallback)
  const signInWithGoogle = async () => {
    try {
      return { error: { message: 'Google sign-in is not supported on this platform natively.' } };
    } catch (error) {
      return { error: { message: 'Google sign-in failed.' } };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setSession(null);
      setUserMetadata(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    session,
    userMetadata,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateUserMetadata
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};