import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../App";
import { auth, signOut } from "../firebase";
import { LogOut, User, Menu as MenuIcon, ShoppingBag, LayoutDashboard } from "lucide-react";
import Logo from "./Logo";

export default function Navbar() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <nav className="bg-primary-dark border-b border-accent py-4 px-6 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-3 group">
        <Logo className="h-12 w-auto py-1 px-2 border-none bg-transparent shadow-none" size="sm" />
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            {(profile?.role === 'admin' || profile?.email === 'edinelsonept@gmail.com') && (
              <Link to="/admin" className="text-accent-light hover:text-white flex items-center gap-1 text-sm font-medium">
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            {(profile?.role === 'waiter' || profile?.email === 'edinelsonept@gmail.com') && (
              <Link to="/waiter" className="text-accent-light hover:text-white flex items-center gap-1 text-sm font-medium">
                <ShoppingBag size={18} />
                <span className="hidden sm:inline">Garçom</span>
              </Link>
            )}
            {(profile?.role === 'customer' || profile?.email === 'edinelsonept@gmail.com') && (
              <Link to="/customers" className="text-accent-light hover:text-white flex items-center gap-1 text-sm font-medium">
                <ShoppingBag size={18} />
                <span className="hidden sm:inline">Clientes</span>
              </Link>
            )}
            
            <div className="flex items-center gap-3 ml-2 border-l border-coffee pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs gold-text font-bold">{profile?.name}</p>
                <p className="text-[10px] text-accent-light opacity-60 uppercase tracking-tighter">{profile?.role}</p>
              </div>
              <button onClick={handleLogout} className="text-accent hover:text-accent-light transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </>
        ) : (
          <Link to="/login" className="gold-gradient text-primary-dark px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform">
            <User size={16} />
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}
