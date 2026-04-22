import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setRole(docSnap.data().rol);
        } else {
          // Si es nuevo, lo registramos como pendiente
          const nuevoUsuario = {
            email: currentUser.email,
            nombre: currentUser.displayName,
            rol: 'pendiente',
            fechaRegistro: new Date()
          };
          await setDoc(docRef, nuevoUsuario);
          setRole('pendiente');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginConGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  return { user, loading, role, isAdmin: role === 'admin', loginConGoogle, logout };
}