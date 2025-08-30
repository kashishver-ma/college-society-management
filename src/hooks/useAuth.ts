// src/hooks/useAuth.ts
import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import { User } from "@/types";
// import { FirebaseError } from "firebase/app";

// import { useRouter } from "next/navigation";

interface AuthState {
  user: (User & { firebaseUser: FirebaseUser }) | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const setCookie = (name: string, value: string, maxAge = 3600) => {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge};`;
  };

  const clearCookie = (name: string) => {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = { ...userDoc.data() as User, firebaseUser };
            setCookie("userRole", userData.role);
            const token = await firebaseUser.getIdToken();
            setCookie("firebaseToken", token);

            setAuthState({ user: userData, loading: false, error: null });
          } else {
            setAuthState({ user: null, loading: false, error: "User data not found" });
          }
        } catch (error) {
          setAuthState({ user: null, loading: false, error: "Error fetching user data" });
        }
      } else {
        clearCookie("userRole");
        clearCookie("firebaseToken");
        setAuthState({ user: null, loading: false, error: null });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (!userDoc.exists()) throw new Error("User data not found in Firestore");

      const userData = { ...userDoc.data() as User, firebaseUser: userCredential.user };
      setCookie("userRole", userData.role);
      const token = await userCredential.user.getIdToken();
      setCookie("firebaseToken", token);

      setAuthState({ user: userData, loading: false, error: null });
      return userData.role;
    } catch (error: unknown) {
      if (error instanceof Error) console.log("Login Error:", error.message);
      else console.log("Unknown error:", error);

      setAuthState(prev => ({ ...prev, loading: false, error: "Login failed" }));
      return null;
    }
  };

  const logout = async () => {
    try {
      setAuthState({ user: null, loading: false, error: null });
      clearCookie("userRole");
      clearCookie("firebaseToken");
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      setAuthState(prev => ({ ...prev, error: "Logout failed" }));
      throw error;
    }
  };

  return {
    auth,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    login,
    logout,
  };
}
