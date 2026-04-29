import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }

      if (currentUser) {
        setLoading(true);
        const docRef = doc(db, 'usuarios', currentUser.uid);
        let creando = false;

        unsubDoc = onSnapshot(docRef, async (docSnap) => {
          if (!docSnap.exists() && !creando) {
            creando = true;
            await setDoc(docRef, {
              email: currentUser.email,
              nombre: '',
              apellido: '',
              rol: 'pendiente',
              perfilCompleto: false,
              fechaRegistro: new Date()
            });
            // La notificación se envía desde el formulario de perfil tras completar nombre y apellido
          } else if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.rol);
            setUserData(data);
            setUser(currentUser);
            setLoading(false);
          }
        });
      } else {
        setUser(null);
        setRole(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const loginConGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoading(false);
    }
  };

  const logout = () => signOut(auth);

  return {
    user, loading, role, userData,
    isAdmin: role === 'admin',
    isSupervisor: role === 'supervisor',
    isAdminOrSupervisor: role === 'admin' || role === 'supervisor',
    loginConGoogle, logout
  };
}
