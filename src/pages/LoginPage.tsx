import React, { useState } from "react";
import { 
  auth, 
  db,
  doc, 
  getDoc, 
  setDoc,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider,
  ensureMasterAccountExists
} from "../firebase";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, AlertCircle, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import Logo from "../components/Logo";
import { useToast } from "../components/Toast";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"customer" | "waiter" | "admin">("customer");
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [masterStatus, setMasterStatus] = useState<string>("checking");
  const navigate = useNavigate();
  const toast = useToast();

  React.useEffect(() => {
    let active = true;
    async function initMaster() {
      try {
        const res = await ensureMasterAccountExists();
        if (active) {
          setMasterStatus(res);
        }
      } catch (err: any) {
        console.error("Failed to automatically provision Co-Master account:", err);
        if (active) {
          setMasterStatus(`error: ${err.message || err}`);
        }
      }
    }
    initMaster();
    return () => {
      active = false;
    };
  }, []);

  // Update role when tab changes
  const handleTabChange = (tab: "customer" | "waiter" | "admin") => {
    setActiveTab(tab);
    setRole(tab);
    setError("");
    setMessage("");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      if (isForgot) {
        await sendPasswordResetEmail(auth, email);
        setMessage("E-mail de recuperação enviado!");
        toast.success("E-mail Enviado!", "Verifique sua caixa de entrada para redefinir sua senha.");
        setIsForgot(false);
        return;
      }

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
        await handleRedirect(userCredential.user.uid);
      } else {
        const userEmailLower = email.toLowerCase();
        const isSpecialAdmin = [
          "edinelsonept@gmail.com",
          "edinelsondamasceno546@gmail.com",
          "edinelsondamasceno07@gmail.com"
        ].includes(userEmailLower);

        // Registration is ONLY for customers, unless it's the special Co-Master setting up
        if (activeTab !== "customer" && !isSpecialAdmin) {
          setError("Apenas clientes podem se cadastrar livremente. Contas de equipe exigem convite do Co-Master.");
          toast.error("Acesso Negado", "Cadastro de equipe não é permitido livremente.");
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, userEmailLower, password);
        const user = userCredential.user;
        
        // Final role assignment
        let finalRole = "customer";
        if (isSpecialAdmin) finalRole = "admin";

        // Register profile in Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: name,
          email: userEmailLower,
          role: finalRole,
          active: true,
          createdAt: new Date().toISOString()
        });

        toast.success("Cadastro Realizado!", "Sua conta foi criada com sucesso.");
        await handleRedirect(user.uid);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("ERRO DE CONFIGURAÇÃO: O provedor 'E-mail/Senha' está desativado no Firebase Console. Ative-o em 'Authentication > Sign-in method' para permitir novos cadastros.");
        toast.error("Erro de Configuração", "O provedor de e-mail/senha não está ativado.");
      } else {
        setError(err.message);
        toast.error("Falha na Operação", err.message || "Verifique suas credenciais.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        const isSpecialAdmin = [
          "edinelsonept@gmail.com",
          "edinelsondamasceno546@gmail.com",
          "edinelsondamasceno07@gmail.com"
        ].includes(user.email?.toLowerCase() || "");
        
        if (!isSpecialAdmin && activeTab !== "customer") {
          setError("Contas de equipe não podem ser criadas via Google sem autorização prévia.");
          toast.error("Acesso Restrito", "Contas de equipe não podem ser cadastradas via Google.");
          return;
        }

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: user.displayName || "Usuário",
          email: user.email?.toLowerCase(),
          role: isSpecialAdmin ? "admin" : "customer",
          active: true,
          createdAt: new Date().toISOString()
        });
      }
      toast.success("Login com Google!", `Bem-vindo, ${user.displayName || "Usuário"}!`);
      await handleRedirect(user.uid);
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro no Google Login", err.message || "Tente novamente.");
    }
  };

  const handleRedirect = async (uid: string) => {
    let userDoc = await getDoc(doc(db, "users", uid));

    if (!userDoc.exists()) {
      const currentUser = auth.currentUser;
      const userEmail = currentUser?.email?.toLowerCase() || "";
      const isSpecialAdmin = [
        "edinelsonept@gmail.com",
        "edinelsondamasceno546@gmail.com",
        "edinelsondamasceno07@gmail.com",
        "edinelson.damasceno4145@aluno.seduc.pa.gov.br"
      ].includes(userEmail);

      const defaultProfile = {
        uid: uid,
        name: currentUser?.displayName || name || "Usuário",
        email: userEmail,
        role: isSpecialAdmin ? "admin" : "customer",
        active: true,
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, "users", uid), defaultProfile);
        userDoc = await getDoc(doc(db, "users", uid));
      } catch (err) {
        console.warn("Failed to auto-create user document on successful sign-in:", err);
      }
    }

    if (userDoc.exists()) {
      const data = userDoc.data();
      const role = data.role;
      const email = data.email?.toLowerCase();
      const isMasterAdmin = [
        "edinelsonept@gmail.com",
        "edinelsondamasceno546@gmail.com",
        "edinelsondamasceno07@gmail.com",
        "edinelson.damasceno4145@aluno.seduc.pa.gov.br"
      ].includes(email || "");

      let friendlyRoleName = "Cliente";
      if (role === "admin") friendlyRoleName = "Administrador";
      else if (role === "waiter") friendlyRoleName = "Garçom";

      toast.success("Autorizado!", `Sessão iniciada como ${data.name || "Usuário"} (${friendlyRoleName}).`);

      // If it's the master admin, they can land on whatever tab they selected
      if (isMasterAdmin) {
        if (activeTab === 'admin') navigate('/admin');
        else if (activeTab === 'waiter') navigate('/waiter');
        else navigate('/customers');
        return;
      }

      if (role === 'admin') navigate('/admin');
      else if (role === 'waiter') navigate('/waiter');
      else navigate('/customers');
    } else {
      // Direct fallback
      toast.success("Bem-vindo!", "Autenticação realizada com sucesso.");
      navigate('/customers');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-primary text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-secondary p-8 rounded-2xl border border-accent shadow-2xl shadow-primary-dark"
      >
        <div className="text-center mb-8">
          <Logo className="w-24 mx-auto mb-4 border-2 border-accent" size="md" />
          <h1 className="text-3xl font-black gold-text mb-2 uppercase tracking-tighter">Delícias do Mar</h1>
          <p className="text-accent-light opacity-80 font-medium mb-6">
            {isForgot ? "Recuperar conta" : isLogin ? "Bem-vindo de volta" : "Criar nova conta"}
          </p>

          {/* Login Tabs */}
          {!isForgot && (
            <div className="flex bg-primary-dark p-1 rounded-xl mb-6 border border-coffee/30 gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => handleTabChange("customer")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "customer" 
                    ? "gold-gradient text-primary-dark shadow-lg" 
                    : "text-accent-light hover:text-white"
                }`}
              >
                Clientes
              </button>
              <button
                onClick={() => handleTabChange("waiter")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "waiter" 
                    ? "gold-gradient text-primary-dark shadow-lg" 
                    : "text-accent-light hover:text-white"
                }`}
              >
                Garçons
              </button>
              <button
                onClick={() => handleTabChange("admin")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "admin" 
                    ? "gold-gradient text-primary-dark shadow-lg" 
                    : "text-accent-light hover:text-white"
                }`}
              >
                Co-Masters
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-green-900/30 border border-green-500 text-green-200 p-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-sm">{message}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && !isForgot && (
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-widest text-accent-light">Nome Completo</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-accent" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-primary-dark border border-coffee rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-accent outline-none"
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-accent-light">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-accent" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-primary-dark border border-coffee rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-accent outline-none"
                placeholder="exemplo@email.com"
                required
              />
            </div>
          </div>

          {!isForgot && (
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-widest text-accent-light">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-accent" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-primary-dark border border-coffee rounded-lg py-3 pl-10 pr-12 focus:ring-2 focus:ring-accent outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee hover:text-accent transition-colors p-1"
                  aria-label={showPassword ? "Esconder senha" : "Ver senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {!isLogin && !isForgot && (
            <div className="bg-accent/5 p-3 rounded-lg border border-accent/20 mb-4">
              <p className="text-[10px] uppercase gold-text font-bold mb-1 opacity-60">Perfil Selecionado</p>
              <p className="text-sm font-bold text-white capitalize">{activeTab === 'admin' ? 'Co-Master (Administrador)' : activeTab === 'waiter' ? 'Garçom' : 'Cliente'}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full gold-gradient text-primary-dark font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            {isForgot ? <LogIn size={20} /> : isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isForgot ? "Enviar Reset" : isLogin ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <div className="mt-6 space-y-4">
          {!isForgot && activeTab === "customer" && (
            <>
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-coffee"></div>
                <span className="text-xs text-accent-light">OU</span>
                <div className="flex-1 h-px bg-coffee"></div>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full bg-white text-gray-800 font-medium py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                type="button"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Entrar com Google
              </button>
            </>
          )}

          <div className="flex flex-col gap-2 text-center text-sm">
            {!isForgot && (
              <button onClick={() => setIsForgot(true)} className="text-accent underline">
                Esqueci minha senha
              </button>
            )}
            {isForgot && (
              <button onClick={() => setIsForgot(false)} className="text-accent">
                Voltar para Login
              </button>
            )}
            {(activeTab === "customer" || activeTab === "admin") && (
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setIsForgot(false);
                }} 
                className="text-accent-light opacity-80"
                type="button"
              >
                {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entre"}
              </button>
            )}
            {activeTab === 'waiter' && isLogin && (
               <p className="text-xs text-accent-light opacity-50 italic">
                 Contas de garçom são gerenciadas administrativamente pelo Co-Master.
               </p>
            )}

            {activeTab === 'waiter' && !isLogin && (
               <button onClick={() => setIsLogin(true)} className="text-accent">
                 Voltar para Login
               </button>
            )}
            
            {activeTab === 'admin' && (
              <div className="mt-4 p-3 bg-accent/15 rounded-xl border border-accent/20 text-xs space-y-1 text-left">
                <div className="font-bold uppercase tracking-wider text-accent-light flex items-center justify-between">
                  <span>Acesso Co-Master Principal</span>
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    masterStatus === "created" || masterStatus === "created_mock" 
                      ? "bg-green-500 animate-pulse" 
                      : masterStatus === "already_exists" || masterStatus === "already_exists_mock"
                        ? "bg-emerald-500"
                        : masterStatus === "checking"
                          ? "bg-yellow-500 animate-bounce"
                          : "bg-red-500"
                  }`} />
                </div>
                <div className="bg-primary/50 p-2 rounded border border-coffee/30 mt-2 font-mono text-[11px] text-accent-light select-all">
                  <p>E-mail: <span className="text-white font-bold select-all">edinelsonept@gmail.com</span></p>
                  <p>Senha: <span className="text-white font-bold select-all">@Coelho60</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("edinelsonept@gmail.com");
                    setPassword("@Coelho60");
                    setIsLogin(true);
                    toast.success("Credenciais Preenchidas!", "Clique no botão 'Entrar' para acessar.");
                  }}
                  className="w-full mt-2 bg-accent/25 hover:bg-accent/40 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition-all border border-accent/40 uppercase tracking-wider text-center active:scale-95"
                >
                  ⚡ Preencher Login Automático
                </button>
                <p className="text-[10px] text-accent-light/80 italic mt-2">
                  {masterStatus === "checking" && "🔄 Verificando / Inicializando no banco de dados..."}
                  {(masterStatus === "created" || masterStatus === "created_mock") && "✅ Conta de Co-Master criada e pronta no banco de dados!"}
                  {(masterStatus === "already_exists" || masterStatus === "already_exists_mock") && "🔒 Conta existente e pronta para uso."}
                  {masterStatus.startsWith("error") && `📢 Erro de Inicialização: certifique-se de ativar o provedor E-mail/Senha nas configurações do Firebase Authentication.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
