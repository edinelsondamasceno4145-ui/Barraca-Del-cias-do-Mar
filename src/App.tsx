import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, createContext, useContext } from "react";
import { auth, db, doc, getDoc, onAuthStateChanged } from "./firebase";
import { User } from "firebase/auth";
import { UserProfile } from "./types";
import { ToastProvider } from "./components/Toast";

// Pages (to be created)
import LoginPage from "./pages/LoginPage";
import WaiterPage from "./pages/WaiterPage";
import CustomerPage from "./pages/CustomerPage";
import AdminPage from "./pages/AdminPage";
import MenuPage from "./pages/MenuPage";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      try {
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<MenuPage />} />
            
            <Route 
              path="/waiter/*" 
              element={profile?.role === 'waiter' || profile?.role === 'admin' || ["edinelsonept@gmail.com", "edinelsondamasceno546@gmail.com", "edinelsondamasceno07@gmail.com", "edinelson.damasceno4145@aluno.seduc.pa.gov.br"].includes(profile?.email || '') ? <WaiterPage /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/customers/*" 
              element={profile?.role === 'customer' || profile?.role === 'admin' || ["edinelsonept@gmail.com", "edinelsondamasceno546@gmail.com", "edinelsondamasceno07@gmail.com", "edinelson.damasceno4145@aluno.seduc.pa.gov.br"].includes(profile?.email || '') ? <CustomerPage /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin/*" 
              element={profile?.role === 'admin' || ["edinelsonept@gmail.com", "edinelsondamasceno546@gmail.com", "edinelsondamasceno07@gmail.com", "edinelson.damasceno4145@aluno.seduc.pa.gov.br"].includes(profile?.email || '') ? <AdminPage /> : <Navigate to="/login" />} 
            />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
