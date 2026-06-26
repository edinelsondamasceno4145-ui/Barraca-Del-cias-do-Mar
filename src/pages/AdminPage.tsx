import React, { useState, useEffect } from "react";
import { INITIAL_MENU } from "../constants";
import { 
  db,
  collection, 
  query, 
  onSnapshot, 
  getDocs, 
  where, 
  doc, 
  updateDoc, 
  setDoc, 
  orderBy, 
  deleteDoc, 
  addDoc,
  initializeApp, 
  getApp, 
  getApps,
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut,
  syncAllCollectionsToFirebase,
  isDummy
} from "../firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import { UserProfile, UserRole, Table, Order, MenuItem, Review } from "../types";
import Navbar from "../components/Navbar";
import { useAuth } from "../App";
import { 
  Users, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  UserCheck, 
  UserX,
  BarChart3,
  Calendar,
  Plus,
  Mail,
  UserPlus,
  X,
  Edit,
  Lock,
  Trash2,
  List,
  Star,
  MessageSquare,
  Share2,
  Eye,
  EyeOff,
  QrCode,
  Download,
  Database,
  Copy,
  Check,
  RefreshCcw,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { isFirebaseSyncConfigured, syncAllCollectionsToFirebaseSync, FIREBASE_SYNC_SQL_INSTRUCTIONS } from "../firebaseSync";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../components/Toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from "recharts";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

export default function AdminPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [activeWaitersCount, setActiveWaitersCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    name: "",
    price: 0,
    category: "PEIXES",
    description: "",
    available: true
  });

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("waiter");
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  // Firebase Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; count: number; errors: string[] } | null>(null);
  const [copiedSQL, setCopiedSQL] = useState(false);

  // Firebase states
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);
  const [firebaseSyncResult, setFirebaseSyncResult] = useState<{ success: boolean; count: number; errors: string[] } | null>(null);

  useEffect(() => {
    // All Users
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const docs = snapshot.docs.map(d => d.data() as UserProfile);
      setUsersList(docs);
      setActiveWaitersCount(docs.filter(w => w.role === 'waiter' && w.active).length);
    });

    // Orders & Sales
    const ordersQuery = collection(db, "orders");
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const total = data.reduce((acc, order) => acc + (order.total || 0), 0);
      setTotalSales(total);
      setOrdersCount(data.length);

      // Generate chart data for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayOrders = data.filter(order => {
          const orderDate = order.createdAt?.seconds 
            ? new Date(order.createdAt.seconds * 1000) 
            : new Date(order.createdAt);
          return isSameDay(orderDate, date);
        });
        return {
          name: format(date, "EEE", { locale: ptBR }),
          total: dayOrders.reduce((acc, o) => acc + o.total, 0),
          count: dayOrders.length
        };
      });
      setChartData(last7Days);
    });

    // Menu Items
    const menuQuery = query(collection(db, "menuItems"), orderBy("category", "asc"));
    const unsubMenu = onSnapshot(menuQuery, (snapshot) => {
      setMenuItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]);
    });

    // Reviews
    const reviewsQuery = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsubReviews = onSnapshot(reviewsQuery, (snapshot) => {
      setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Review[]);
    });

    return () => {
      unsubUsers();
      unsubOrders();
      unsubMenu();
      unsubReviews();
    };
  }, []);

  const handleShareMenu = async () => {
    const shareData = {
      title: 'Cardápio - Delícias do Mar',
      text: 'Confira nossas delícias do mar fresquinhas!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success("Link Copiado!", "O link do cardápio foi copiado para a área de transferência.");
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  };

  const addUserInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    // Security check: Only edinelsonept@gmail.com can add admins or waiters
    if ((newUserRole === 'admin' || newUserRole === 'waiter') && profile?.email !== 'edinelsonept@gmail.com') {
      setUserError("Você não tem permissão para criar usuários com este cargo.");
      return;
    }

    if (!newUserEmail || !newUserName || !newUserPassword) {
      setUserError("Todos os campos são obrigatórios, incluindo a senha.");
      return;
    }

    if (newUserPassword.length < 6) {
      setUserError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      // 1. Create a secondary Firebase App instance for user creation
      // This allows us to create a user without logging out the current admin
      const secondaryAppName = `SecondaryApp-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newUserEmail.toLowerCase(), 
        newUserPassword
      );
      
      const firebaseUser = userCredential.user;

      // 3. Register the profile in Firestore
      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        name: newUserName,
        email: newUserEmail.toLowerCase(),
        password: newUserPassword, // Store password so admin can see it
        role: newUserRole,
        active: true,
        createdAt: new Date().toISOString()
      });

      // 4. Sign out the secondary app user and delete the apps to clean up
      await signOut(secondaryAuth);

      setUserSuccess(`Conta criada com sucesso para ${newUserName} (${newUserRole})!`);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("waiter");
      setTimeout(() => {
        setIsAddingUser(false);
        setUserSuccess("");
      }, 3000);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setUserError("Este e-mail já está em uso por outro usuário.");
      } else if (err.code === 'auth/invalid-email') {
        setUserError("O formato do e-mail é inválido. Verifique se digitou corretamente.");
      } else if (err.code === 'auth/weak-password') {
        setUserError("A senha é muito fraca. Tente uma senha mais complexa.");
      } else if (err.message?.includes('permission-denied') || err.code === 'permission-denied') {
        setUserError("Erro de permissão no banco de dados. Contate o suporte.");
      } else {
        setUserError("Erro ao processar: " + (err.message || "Erro desconhecido"));
      }
    }
  };

  const toggleUserStatus = async (targetUser: UserProfile) => {
    try {
      await updateDoc(doc(db, "users", targetUser.uid), {
        active: !targetUser.active
      });
      toast.success("Status Atualizado", `O funcionário "${targetUser.name}" agora está ${!targetUser.active ? "Ativo" : "Inativo"}.`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro no Status", "Não foi possível atualizar a atividade do usuário.");
    }
  };

  const updateUserRole = async (uid: string, role: UserRole) => {
    if ((role === 'admin' || role === 'waiter') && profile?.email !== 'edinelsonept@gmail.com') {
      toast.error("Acesso Negado", "Apenas o Co-Master principal pode atribuir estes cargos.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", uid), { role });
      const roleName = role === "admin" ? "Administrador" : role === "waiter" ? "Garçom" : "Cliente";
      toast.success("Cargo Atualizado", `O papel de acesso foi alterado para ${roleName}.`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro de Permissão", "Falha ao alterar o cargo do usuário.");
    }
  };

  const deleteUser = async (uid: string) => {
    if (confirm("Deseja realmente remover o acesso deste usuário?")) {
      try {
        await deleteDoc(doc(db, "users", uid));
        toast.success("Usuário Removido", "O acesso do usuário foi revogado com sucesso.");
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao Remover", "Não foi possível excluir o usuário.");
      }
    }
  };

  const saveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateDoc(doc(db, "menuItems", editingItem.id), {
          ...newItem,
          updatedAt: new Date().toISOString()
        });
        toast.success("Prato Atualizado!", `"${newItem.name}" foi alterado com sucesso.`);
      } else {
        await addDoc(collection(db, "menuItems"), {
          ...newItem,
          createdAt: new Date().toISOString()
        });
        toast.success("Novo Prato Criado!", `"${newItem.name}" foi inserido no cardápio.`);
      }
      setIsAddingItem(false);
      setEditingItem(null);
      setNewItem({ name: "", price: 0, category: "PEIXES", description: "", available: true });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao Salvar", "Não fomos capazes de salvar o prato no Firestore.");
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (confirm("Deseja realmente remover este item do cardápio?")) {
      try {
        await deleteDoc(doc(db, "menuItems", id));
        toast.success("Item Removido", "O prato foi apagado do cardápio.");
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao Remover", "Não foi possível deletar o item.");
      }
    }
  };

  const seedMenu = async () => {
    if (confirm("Isso irá importar todos os itens padrão do cardápio para o Firestore. Continuar?")) {
      try {
        for (const item of INITIAL_MENU) {
          await addDoc(collection(db, "menuItems"), {
            ...item,
            available: true,
            createdAt: new Date().toISOString()
          });
        }
        toast.success("Cardápio Restaurado!", "Todos os itens padrão foram inseridos com sucesso no Firestore.");
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao Semear", "Não foi possível reestabelecer o cardápio padrão.");
      }
    }
  };

  const handleBulkSyncToFirebaseSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { successCount, errors } = await syncAllCollectionsToFirebaseSync();
      setSyncResult({
        success: errors.length === 0,
        count: successCount,
        errors: errors
      });
    } catch (err: any) {
      setSyncResult({
        success: false,
        count: 0,
        errors: [err.message || String(err)]
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkSyncToFirebase = async () => {
    setIsFirebaseSyncing(true);
    setFirebaseSyncResult(null);
    try {
      const { successCount, errors } = await syncAllCollectionsToFirebase();
      setFirebaseSyncResult({
        success: errors.length === 0,
        count: successCount,
        errors: errors
      });
    } catch (err: any) {
      setFirebaseSyncResult({
        success: false,
        count: 0,
        errors: [err.message || String(err)]
      });
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  const handleCopySQL = () => {
    const firebaseSnippet = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC07u4gb67gSm8IbJ6Q90I9rQOS8BRfVXU",
  authDomain: "delicial-do-mar.firebaseapp.com",
  projectId: "delicial-do-mar",
  storageBucket: "delicial-do-mar.firebasestorage.app",
  messagingSenderId: "812355074989",
  appId: "1:812355074989:web:f51e15eb5ab29a67e6ff24"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);`;
    navigator.clipboard.writeText(firebaseSnippet);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  return (
    <div className="min-h-screen bg-primary">
      <Navbar />

      <main className="p-6 max-w-7xl mx-auto space-y-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black gold-text tracking-tighter uppercase">Gestão Co-Master</h1>
            <p className="text-accent-light opacity-60">Visão estratégica e controle da Barraca.</p>
          </div>
          
          <div className="flex bg-secondary p-1 rounded-xl border border-coffee text-sm font-bold overflow-x-auto scrollbar-hide shrink-0">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'gold-gradient text-primary-dark' : 'text-accent-light'}`}
            >
              DASHBOARD
            </button>
            <button 
              onClick={() => setActiveTab("users")}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'users' ? 'gold-gradient text-primary-dark' : 'text-accent-light'}`}
            >
              USUÁRIOS
            </button>
            <button 
              onClick={() => setActiveTab("menu")}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'menu' ? 'gold-gradient text-primary-dark' : 'text-accent-light'}`}
            >
              CARDÁPIO
            </button>
            <button 
              onClick={() => setActiveTab("reviews")}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'reviews' ? 'gold-gradient text-primary-dark' : 'text-accent-light'}`}
            >
              AVALIAÇÕES
            </button>
            <button 
              onClick={() => setActiveTab("firebase-sync")}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'firebase-sync' ? 'gold-gradient text-primary-dark' : 'text-accent-light'}`}
            >
              BANCO FIREBASE
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Faturamento Total", value: `R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="text-accent" />, color: "bg-blue-500/10" },
                { label: "Pedidos Realizados", value: ordersCount, icon: <ShoppingBag className="text-accent" />, color: "bg-orange-500/10" },
                { label: "Garçons Ativos", value: `${activeWaitersCount} / ${usersList.filter(u => u.role === 'waiter').length}`, icon: <Users className="text-accent" />, color: "bg-green-500/10" },
                { label: "Taxa de Conversão", value: "85%", icon: <TrendingUp className="text-accent" />, color: "bg-purple-500/10" }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-secondary/40 p-6 rounded-3xl border border-coffee hover:border-accent transition-colors group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-primary-dark rounded-2xl group-hover:gold-bg group-hover:text-primary-dark transition-all">
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-accent-light opacity-60 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                  <p className="text-3xl font-black text-white mt-1">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-secondary/40 p-8 rounded-3xl border border-coffee">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="gold-text font-bold uppercase flex items-center gap-2">
                    <BarChart3 size={20} /> Faturamento (Últimos 7 dias)
                  </h3>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2B1A10" vertical={false} />
                      <XAxis dataKey="name" stroke="#6B4528" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6B4528" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1A0F08', border: '1px solid #E6B15C', borderRadius: '12px' }}
                        itemStyle={{ color: '#E6B15C' }}
                      />
                      <Bar dataKey="total" fill="#E6B15C" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-secondary/40 p-8 rounded-3xl border border-coffee">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="gold-text font-bold uppercase flex items-center gap-2">
                    <ShoppingBag size={20} /> Volume de Pedidos
                  </h3>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2B1A10" vertical={false} />
                      <XAxis dataKey="name" stroke="#6B4528" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6B4528" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1A0F08', border: '1px solid #E6B15C', borderRadius: '12px' }}
                        itemStyle={{ color: '#E6B15C' }}
                      />
                      <Line type="monotone" dataKey="count" stroke="#E6B15C" strokeWidth={3} dot={{ fill: '#E6B15C', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="gold-text font-bold uppercase tracking-widest flex items-center gap-2">
                <List size={20} /> Gestão do Cardápio
              </h3>
              <div className="flex gap-3 sm:gap-4 flex-wrap justify-end">
                <button 
                  onClick={() => setShowQRCode(true)}
                  className="bg-primary-dark px-4 py-2 rounded-xl text-accent border border-accent/20 text-sm font-bold flex items-center gap-2 hover:bg-accent/10 transition-colors"
                >
                  <QrCode size={18} /> QR Code
                </button>
                <button 
                  onClick={handleShareMenu}
                  className="bg-primary-dark px-4 py-2 rounded-xl text-accent border border-accent/20 text-sm font-bold flex items-center gap-2 hover:bg-accent/10 transition-colors"
                >
                  <Share2 size={18} /> Compartilhar
                </button>
                <button 
                  onClick={seedMenu}
                  className="bg-secondary px-4 py-2 rounded-xl text-accent-light border border-coffee text-sm font-bold hover:bg-secondary/60 transition-colors"
                >
                  Restaurar Padrão
                </button>
                <button 
                  onClick={() => {
                    setEditingItem(null);
                    setNewItem({ name: "", price: 0, category: "PEIXES", description: "", available: true });
                    setIsAddingItem(true);
                  }}
                  className="gold-gradient text-primary-dark px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg hover:scale-105 transition-transform"
                >
                  <Plus size={18} /> Novo Item
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-secondary/40 p-6 rounded-3xl border border-coffee group hover:border-accent transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary-dark/50 px-3 py-1 rounded-full border border-accent/20">
                      <span className="text-[10px] gold-text font-bold uppercase tracking-wider">{item.category}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem(item);
                          setNewItem({ ...item });
                          setIsAddingItem(true);
                        }}
                        className="text-accent hover:text-white p-1"
                      >
                         <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => deleteMenuItem(item.id)}
                        className="text-red-500 hover:text-red-400 p-1"
                      >
                         <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-white">{item.name}</h4>
                  <p className="text-xs text-accent-light opacity-60 mt-1 h-8 line-clamp-2">{item.description || "Sem descrição"}</p>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-2xl font-black gold-text">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.available ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {item.available ? 'DISPONÍVEL' : 'INDISPONÍVEL'}
                    </div>
                  </div>
                </motion.div>
              ))}
              {menuItems.length === 0 && (
                <div className="col-span-full py-20 text-center bg-secondary/20 rounded-3xl border border-dashed border-coffee">
                  <p className="text-accent-light opacity-40 italic">Inicie seu cardápio adicionando o primeiro item acima.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="gold-text font-bold uppercase tracking-widest flex items-center gap-2">
                <Users size={20} /> Gestão de Usuários
              </h3>
              <button 
                onClick={() => {
                  setNewUserRole("waiter");
                  setIsAddingUser(true);
                }}
                className="gold-gradient text-primary-dark px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg hover:scale-105 transition-transform"
              >
                <Plus size={18} /> Novo Usuário
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {usersList.filter(u => u.role === 'admin' || u.role === 'waiter').map((targetUser) => (
                <motion.div 
                  key={targetUser.uid}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-secondary/40 p-6 rounded-3xl border border-coffee space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${targetUser.active ? 'gold-bg text-primary-dark' : 'bg-primary-dark text-coffee border border-coffee'}`}>
                        {targetUser.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white">{targetUser.name}</p>
                        <p className="text-xs text-accent-light opacity-60">{targetUser.email}</p>
                        {targetUser.password && (
                          <div className="flex items-center gap-1 mt-1">
                            <Lock size={10} className="text-accent opacity-40" />
                            <p className="text-[10px] font-mono gold-text opacity-80">{targetUser.password}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleUserStatus(targetUser)}
                        className={`p-2 rounded-xl transition-all ${targetUser.active ? 'text-green-500 hover:bg-green-500/10' : 'text-red-500 hover:bg-red-500/10'}`}
                        title={targetUser.active ? "Ativo" : "Bloqueado"}
                      >
                        {targetUser.active ? <UserCheck size={20} /> : <UserX size={20} />}
                      </button>
                      <button 
                        onClick={() => deleteUser(targetUser.uid)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Remover"
                      >
                         <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-coffee/20">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase gold-text font-black tracking-widest opacity-40">Cargo</span>
                      <select 
                        value={targetUser.role}
                        onChange={(e) => updateUserRole(targetUser.uid, e.target.value as UserRole)}
                        className="bg-primary-dark text-[10px] gold-text font-bold px-2 py-1 rounded-lg border border-accent/20 outline-none uppercase"
                        disabled={targetUser.role === 'admin' && profile?.email !== 'edinelsonept@gmail.com'}
                      >
                        { (profile?.email === 'edinelsonept@gmail.com' || targetUser.role === 'waiter') && <option value="waiter">Garçom</option> }
                        { profile?.email === 'edinelsonept@gmail.com' && <option value="admin">Co-Master</option> }
                      </select>
                    </div>
                    <div className="text-[10px] font-bold text-accent-light opacity-30">
                      ID: {targetUser.uid.slice(0, 6)}...
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black gold-text uppercase flex items-center gap-3">
              <Star className="text-accent" /> Feedback dos Clientes
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review) => (
                <motion.div 
                  key={review.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-secondary/30 p-6 rounded-3xl border border-coffee/30 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white">{review.customerName}</h4>
                      <p className="text-[10px] text-accent-light opacity-60 uppercase font-black">Pedido: {review.orderId.slice(-6)}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className={i < review.rating ? "text-accent fill-current" : "text-coffee opacity-30"} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-primary-dark/50 p-4 rounded-2xl border border-coffee/20 min-h-[80px]">
                    <MessageSquare size={14} className="text-accent mb-2 opacity-40" />
                    <p className="text-sm italic text-accent-light leading-relaxed">
                      "{review.comment || "Sem comentários."}"
                    </p>
                  </div>
                  
                  <p className="text-[10px] text-coffee font-medium text-right">
                    {review.createdAt?.seconds ? format(new Date(review.createdAt.seconds * 1000), "dd/MM/yyyy HH:mm") : "Recente"}
                  </p>
                </motion.div>
              ))}
              {reviews.length === 0 && (
                <div className="col-span-full text-center py-20 opacity-40 italic">
                   Nenhuma avaliação recebida ainda.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "firebase-sync" && (
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl font-black gold-text uppercase flex items-center gap-3">
                <Database className="text-accent" /> Painel de Configuração & Permissões Firebase
              </h2>
              <p className="text-accent-light opacity-60 text-sm">Gerenciamento do ambiente do Firestore, Regras de Acesso e credenciais oficiais do SDK Firebase Web.</p>
            </div>

            {/* TWO-COLUMN CONFIGURATION ENGINE */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* COLUMN A: FIREBASE FIRESTORE SYNC & CONFIGURATIONS */}
              <div className="space-y-6">
                <div className="bg-secondary/40 p-6 sm:p-8 rounded-[2rem] border border-coffee flex flex-col gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full filter blur-xl pointer-events-none" />
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <span>1. Firebase Firestore</span>
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border mt-2 ${
                        isDummy 
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDummy ? "bg-yellow-400 animate-bounce" : "bg-emerald-400 animate-pulse"}`} />
                        {isDummy ? "Modo de Simulação Local (Mock)" : "Conectado ao Firestore Oficial"}
                      </span>
                    </div>

                    <button
                      onClick={handleBulkSyncToFirebase}
                      disabled={isFirebaseSyncing}
                      className="flex items-center gap-2 px-5 py-3 gold-gradient text-primary-dark font-black text-xs rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 uppercase tracking-tight shrink-0 shadow-lg shadow-accent/10"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${isFirebaseSyncing ? 'animate-spin' : ''}`} />
                      {isFirebaseSyncing ? "PROCESSANDO..." : "SINCRONIZAR NO FIREBASE"}
                    </button>
                  </div>

                  <p className="text-accent-light/80 text-sm leading-relaxed">
                    Armazene todo o banco local (produtos do cardápio, comandas registradas, comandas de consumo das mesas, avaliações, etc.) permanentemente no seu Firebase oficial. Além disso, cria de forma autônoma todas as configurações estruturadas da sua barraca de praia (Taxas de mesa, Wi-Fi, horários de atendimento, locais, etc.).
                  </p>

                  {/* Firebase Sync Summary Result */}
                  {firebaseSyncResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border ${firebaseSyncResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/15 text-red-400'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-sm">
                            {firebaseSyncResult.success ? "Sincronização com Firebase Concluída!" : "Erro parcial na sincronização com Firebase"}
                          </p>
                          <p className="text-xs text-accent-light/80 mt-1">
                            Sincronizados <strong className="text-white">{firebaseSyncResult.count}</strong> registros/campos no banco no total.
                          </p>
                          {firebaseSyncResult.errors.length > 0 && (
                            <div className="mt-2 text-xs font-mono text-accent-light/60 max-h-24 overflow-y-auto space-y-0.5 bg-primary-dark/50 p-2 rounded">
                              {firebaseSyncResult.errors.map((err, idx) => <p key={idx}>{err}</p>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* RESTAURANT CONFIGURATION CARDS BOX */}
                  <div className="bg-primary/40 border border-coffee/30 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-coffee/30 pb-3">
                      <h4 className="font-black text-xs uppercase tracking-wider text-accent font-bold">Configurações Gerenciais Salvas</h4>
                      <span className="text-[10px] bg-accent/10 px-2 py-0.5 rounded text-accent font-mono uppercase font-bold">Chave: general</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Nome do Estabelecimento</p>
                        <p className="font-bold text-white">Barraca Delícias do Mar</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Taxa de Serviço Padrão</p>
                        <p className="font-bold text-white">10% (Inclusa na Fatura da Mesa)</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Rede Wi-Fi (Clientes)</p>
                        <p className="font-bold text-white">delicias_wifi_123</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Telefone Comercial</p>
                        <p className="font-bold text-white">(91) 98765-4321</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 sm:col-span-2 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Endereço Registrado</p>
                        <p className="font-bold text-white">Orla da Praia, CEP 68447-000, Salinópolis - PA</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Horário de Funcionamento</p>
                        <p className="font-bold text-white">10:00 às 23:00</p>
                      </div>
                      <div className="bg-primary-dark/30 p-3 rounded-xl border border-coffee/20 space-y-0.5">
                        <p className="text-accent-light/50 font-bold uppercase text-[9px] tracking-wider">Auto-Pagamento Pelo Celular</p>
                        <p className="font-bold text-emerald-400 font-bold">Habilitado ✓</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/40 p-6 rounded-2xl border border-coffee flex items-center gap-3">
                  <AlertCircle size={20} className="text-accent shrink-0" />
                  <p className="text-xs text-accent-light/80 leading-relaxed">
                    Satisfeito com o Firestore em produção! Todas as alterações efetuadas em tempo real nos outros painéis (funcionários, comandas, cardápios e avaliações) são salvas e protegidas pelas regras de autenticação configuradas no console.
                  </p>
                </div>
              </div>

              {/* COLUMN B: FIREBASE WEB APP SDK INITIALIZATION */}
              <div className="space-y-6">
                <div className="bg-secondary/40 p-6 sm:p-8 rounded-[2rem] border border-coffee flex flex-col gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full filter blur-xl pointer-events-none" />
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">2. Configuração Web SDK</h3>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border mt-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ambiente Oficial Ativo
                      </span>
                    </div>

                    <button
                      onClick={handleCopySQL}
                      className="flex items-center gap-2 px-5 py-3 gold-gradient text-primary-dark font-black text-xs rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 uppercase tracking-tight shrink-0 shadow-lg shadow-accent/10"
                    >
                      {copiedSQL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSQL ? "COPIADO!" : "COPIAR CÓDIGO"}
                    </button>
                  </div>

                  <p className="text-accent-light/80 text-sm leading-relaxed">
                    Abaixo está declarada a estrutura de parametrização Web do Firebase utilizada para a conexão em tempo real. Modifique esses dados no arquivo <code className="text-accent bg-primary-dark px-1.5 py-0.5 rounded font-mono text-xs">firebase-applet-config.json</code> caso necessite alternar o projeto do Firebase.
                  </p>

                  {/* FIREBASE CONFIG CODE BLOCK */}
                  <div className="bg-primary/40 border border-coffee/30 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-coffee/30 pb-3">
                      <h4 className="font-black text-xs uppercase tracking-wider text-accent font-bold">SDK Configuration & App Init</h4>
                      <span className="text-[10px] bg-accent/10 px-2 py-0.5 rounded text-accent font-mono uppercase font-bold">App ID: web:f51e15eb5ab29a67e6ff24</span>
                    </div>

                    <pre className="bg-primary-dark/95 p-3 rounded-lg border border-coffee/50 text-[10px] font-mono leading-relaxed text-accent-light/80 overflow-auto max-h-[290px] scrollbar-thin select-all">
{`// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC07u4gb67gSm8IbJ6Q90I9rQOS8BRfVXU",
  authDomain: "delicial-do-mar.firebaseapp.com",
  projectId: "delicial-do-mar",
  storageBucket: "delicial-do-mar.firebasestorage.app",
  messagingSenderId: "812355074989",
  appId: "1:812355074989:web:f51e15eb5ab29a67e6ff24"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);`}
                    </pre>
                  </div>
                </div>
              </div>

            </div>

            {/* VISUAL SECURITY RULES AND PERMISSIONS SECTION */}
            <div className="bg-secondary/30 border border-coffee p-6 sm:p-8 rounded-[2rem] space-y-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span>3. Políticas de Segurança & Permissões do Firestore (Rules)</span>
                </h3>
                <p className="text-xs text-accent-light/70 mt-1">
                  Controle de acesso granular (ABAC) implantado e ativo no banco por meio do arquivo <code className="text-accent bg-primary-dark/60 px-1 py-0.5 rounded font-mono">firestore.rules</code>. Admins Master têm passe livre absoluto.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { 
                    col: "/users", 
                    name: "Funcionários & Roles", 
                    read: "Autenticados", 
                    write: "Apenas Co-Master para promoções/cadastros; Usuários individuais podem ler/atualizar o próprio nome." 
                  },
                  { 
                    col: "/menuItems", 
                    name: "Cardápio do Restaurante", 
                    read: "Acesso Público (Livre)", 
                    write: "Apenas Administradores Co-Master/Master." 
                  },
                  { 
                    col: "/tables", 
                    name: "Comandas & Mesas", 
                    read: "Autenticados (Garçom/Cliente/Admin)", 
                    write: "Apenas Garçom ou Admin. Clientes podem sugerir consumo/atualizar os status parciais da sua mesa." 
                  },
                  { 
                    col: "/orders", 
                    name: "Pedidos Realizados", 
                    read: "Autenticados", 
                    write: "Clientes (criar pedidos no autoatendimento), Garçom ou Admin." 
                  },
                  { 
                    col: "/reviews", 
                    name: "Avaliações & Sat.", 
                    read: "Acesso Público (Livre)", 
                    write: "Clientes autenticados podem publicar avaliações (notas 1 a 5). Edição/Exclusão restrita a Admins." 
                  },
                  { 
                    col: "/configurations", 
                    name: "Parâmetros do Estabelecimento", 
                    read: "Acesso Público (Livre)", 
                    write: "Apenas Administradores Co-Master/Master." 
                  }
                ].map((rule, idx) => (
                  <div key={idx} className="bg-primary-dark/40 p-5 rounded-2xl border border-coffee/45 space-y-3 relative overflow-hidden group hover:border-accent/40 transition-colors">
                    <div className="flex justify-between items-start border-b border-coffee/20 pb-2">
                      <div>
                        <p className="font-mono text-sm text-accent font-bold tracking-tight">{rule.col}</p>
                        <p className="text-[11px] text-white/90 font-black uppercase tracking-wider">{rule.name}</p>
                      </div>
                      <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-bold uppercase tracking-wider">ATIVO</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-accent-light/40 uppercase font-black tracking-widest block">Permissões de Leitura</span>
                        <p className="text-white/80 leading-relaxed font-bold">{rule.read}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-accent-light/40 uppercase font-black tracking-widest block">Permissões de Escrita</span>
                        <p className="text-accent-light/90 leading-relaxed">{rule.write}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Adicionar Usuário */}
      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-50 bg-primary-dark/95 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-secondary p-8 rounded-3xl border border-accent w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black gold-text uppercase">Criar Nova Conta</h2>
                <button onClick={() => setIsAddingUser(false)} className="text-accent-light hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {userError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs p-3 rounded-lg mb-4">
                  {userError}
                </div>
              )}
              {userSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-500 text-xs p-3 rounded-lg mb-4">
                  {userSuccess}
                </div>
              )}

              <form onSubmit={addUserInvitation} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Nome Completo</label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-accent opacity-50" size={18} />
                    <input 
                      type="text" 
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">E-mail de Login</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-accent opacity-50" size={18} />
                    <input 
                      type="email" 
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-accent opacity-50" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 pl-10 pr-12 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee hover:text-accent transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Cargo do Usuário</label>
                  <select 
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent uppercase font-bold text-xs"
                  >
                    { profile?.email === 'edinelsonept@gmail.com' ? (
                      <>
                        <option value="waiter">Garçom</option>
                        <option value="admin">Co-Master (Admin)</option>
                      </>
                    ) : (
                      <option value="waiter">Garçom</option>
                    )}
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="w-full gold-gradient py-4 rounded-xl text-primary-dark font-black uppercase tracking-tighter shadow-lg mt-4"
                >
                  Criar Conta Agora
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Menu Item */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 bg-primary-dark/95 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-secondary p-8 rounded-3xl border border-accent w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black gold-text uppercase">{editingItem ? "Editar Item" : "Novo Item do Cardápio"}</h2>
                <button onClick={() => setIsAddingItem(false)} className="text-accent-light hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={saveMenuItem} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Nome do Item</label>
                    <input 
                      type="text" 
                      required
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Ex: Peixe Frito"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Preço (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Categoria</label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="PEIXES">PEIXES</option>
                    <option value="CARNES">CARNES</option>
                    <option value="PORÇÕES">PORÇÕES</option>
                    <option value="TIRA GOSTO">TIRA GOSTO</option>
                    <option value="BEBIDAS">BEBIDAS</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase gold-text font-bold tracking-widest">Descrição / Acompanhamentos</label>
                  <textarea 
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent h-24 resize-none"
                    placeholder="Alface, tomate, arroz..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setNewItem({ ...newItem, available: !newItem.available })}
                    className={`w-12 h-6 rounded-full relative transition-colors ${newItem.available ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newItem.available ? 'right-1' : 'left-1'}`} />
                  </button>
                  <span className="text-sm font-bold text-accent-light">Disponível no menu</span>
                </div>

                <button 
                  type="submit" 
                  className="w-full gold-gradient py-4 rounded-xl text-primary-dark font-black uppercase tracking-tighter shadow-lg"
                >
                  {editingItem ? "Salvar Alterações" : "Adicionar ao Cardápio"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRCode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-primary-dark/95 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-secondary p-8 rounded-[3rem] border border-accent w-full max-w-sm text-center space-y-6"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="gold-text font-black uppercase tracking-tighter text-xl">QR Code Cardápio</h3>
                <button onClick={() => setShowQRCode(false)} className="text-accent-light"><X size={24} /></button>
              </div>

              <div className="bg-white p-6 rounded-3xl mx-auto w-fit shadow-2xl border-4 border-accent/30">
                <a 
                  href={window.location.origin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <QRCodeSVG 
                    value={window.location.origin} 
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </a>
              </div>

              <div className="space-y-4">
                <p className="text-accent-light text-xs font-medium italic opacity-70">
                  Aponte a câmera para acessar o menu digital.<br/>
                  Link: <span className="text-accent">{window.location.host}</span>
                </p>
                
                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      const svg = document.querySelector('svg');
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");
                        const img = new Image();
                        img.onload = () => {
                          canvas.width = img.width;
                          canvas.height = img.height;
                          ctx?.drawImage(img, 0, 0);
                          const pngFile = canvas.toDataURL("image/png");
                          const downloadLink = document.createElement("a");
                          downloadLink.download = "QR_Code_Cardapio.png";
                          downloadLink.href = pngFile;
                          downloadLink.click();
                        };
                        img.src = "data:image/svg+xml;base64," + btoa(svgData);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-primary-dark font-black rounded-2xl hover:scale-105 transition-transform"
                  >
                    <Download size={20} /> Baixar Imagem
                  </button>
                  <button 
                    onClick={() => setShowQRCode(false)}
                    className="w-full py-3 text-accent-light font-bold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
