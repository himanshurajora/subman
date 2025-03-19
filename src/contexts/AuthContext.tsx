import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "../firebase";
import { User as FirebaseUser } from "firebase/auth";
import { User } from "../types";
import { db, doc, getDoc, setDoc } from "../firebase";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserLanguage: (language: 'en' | 'hi') => Promise<void>;
  setUserTheme: (theme: 'light' | 'dark') => Promise<void>;
  updateUserProfile: (profileData: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUserProfile(user: FirebaseUser) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserProfile(userDoc.data() as User);
      } else {
        console.log("No user profile found");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchUserProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await fetchUserProfile(userCredential.user);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  async function signup(email: string, password: string, displayName: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      const userProfile: User = {
        uid: user.uid,
        email: email,
        displayName: displayName,
        role: "user",
        language: "en",
        theme: "light",
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "users", user.uid), userProfile);
      setUserProfile(userProfile);
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  async function setUserLanguage(language: 'en' | 'hi') {
    if (!currentUser || !userProfile) return;
    
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(userDocRef, { language }, { merge: true });
      setUserProfile({ ...userProfile, language });
    } catch (error) {
      console.error("Error setting language:", error);
      throw error;
    }
  }

  async function setUserTheme(theme: 'light' | 'dark') {
    if (!currentUser || !userProfile) return;
    
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(userDocRef, { theme }, { merge: true });
      setUserProfile({ ...userProfile, theme });
    } catch (error) {
      console.error("Error setting theme:", error);
      throw error;
    }
  }

  async function updateUserProfile(profileData: { displayName?: string; photoURL?: string }) {
    if (!currentUser) return;
    
    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, profileData);
      
      // If we have a user profile, update it as well
      if (userProfile) {
        const updates: Partial<User> = {};
        
        if (profileData.displayName) {
          updates.displayName = profileData.displayName;
        }
        
        if (profileData.photoURL) {
          updates.photoURL = profileData.photoURL;
        }
        
        // Only update Firestore if we have updates
        if (Object.keys(updates).length > 0) {
          const userDocRef = doc(db, "users", currentUser.uid);
          await setDoc(userDocRef, updates, { merge: true });
          
          // Update local state
          setUserProfile({ ...userProfile, ...updates });
        }
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    signup,
    logout,
    setUserLanguage,
    setUserTheme,
    updateUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
} 