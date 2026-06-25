import { useState, useEffect } from "react";
import { 
  db,
  collection, 
  query, 
  onSnapshot, 
  getDoc, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  where, 
  orderBy, 
  limit 
} from "../firebase";
import { Table, Order, MenuItem, AppNotification } from "../types";
import Navbar from "../components/Navbar";
import { 
  Plus, 
  Users, 
  ChevronRight, 
  PlusCircle, 
  FileText, 
  Divide, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  X,
  Bell,
  BellRing,
  CreditCard,
  Trash2,
  Edit,
  ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";
import { INITIAL_MENU } from "../constants";

export default function WaiterPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, "menuItems"), orderBy("category", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setMenuItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]);
    });

    return () => unsub();
  }, []);

  const menuToDisplay = menuItems.length > 0 ? menuItems : INITIAL_MENU.map((item, idx) => ({ ...item, id: `init-${idx}`, available: true })) as MenuItem[];

  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isOpeningTable, setIsOpeningTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableOccupants, setNewTableOccupants] = useState("2");
  const [newTableName, setNewTableName] = useState("");
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any[]>([]);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(1);
  const [activeTab, setActiveTab] = useState("tables");
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editTableNumber, setEditTableNumber] = useState("");
  const [editTableName, setEditTableName] = useState("");
  const [editTableOccupants, setEditTableOccupants] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const playAlertSound = () => {
    if (!soundEnabled) return;
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.5;
    audio.play().catch(e => {
      console.log("Audio play blocked by browser:", e);
      setSoundEnabled(false);
    });
  };
  
  const { profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, "tables"), where("status", "!=", "paid"), orderBy("status"), orderBy("number", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTables(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Table[]);
    });

    return () => unsub();
  }, []);

  // Notification Listening
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Check for new unread notifications to show toast
      const lastNotify = docs[0];
      if (lastNotify && !lastNotify.read) {
        const now = new Date().getTime();
        const created = lastNotify.createdAt?.seconds 
          ? lastNotify.createdAt.seconds * 1000 
          : new Date(lastNotify.createdAt).getTime();

        if (now - created < 10000) {
          setToast(lastNotify);
          playAlertSound();
          if ("Notification" in window && Notification.permission === "granted") {
            new window.Notification("Delícias do Mar", {
              body: lastNotify.message,
            });
          }
          setTimeout(() => setToast(null), 5000);
        }
      }
      setNotifications(docs);
    });

    return () => unsub();
  }, []);

  // Table Orders Sync
  useEffect(() => {
    if (!selectedTable) {
      setTableOrders([]);
      return;
    }

    const q = query(
      collection(db, "orders"), 
      where("tableId", "==", selectedTable.id),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setTableOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
    });

    return () => unsub();
  }, [selectedTable]);

  const markNotifyRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }
  };

  const openTable = async () => {
    if (!newTableNumber) return;
    try {
      await addDoc(collection(db, "tables"), {
        number: parseInt(newTableNumber),
        name: newTableName || null,
        status: "active",
        occupants: parseInt(newTableOccupants),
        totalAmount: 0,
        waiterId: profile?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsOpeningTable(false);
      setNewTableNumber("");
      setNewTableName("");
      setNewTableOccupants("2");
    } catch (e) {
      console.error(e);
    }
  };

  const updateTableInfo = async () => {
    if (!selectedTable) return;
    try {
      await updateDoc(doc(db, "tables", selectedTable.id), {
        number: parseInt(editTableNumber),
        name: editTableName || null,
        occupants: parseInt(editTableOccupants),
        updatedAt: new Date().toISOString()
      });
      setIsEditingTable(false);
      // Update local selected table
      setSelectedTable({
        ...selectedTable,
        number: parseInt(editTableNumber),
        name: editTableName || null,
        occupants: parseInt(editTableOccupants)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const completeOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const cancelOrder = async (order: Order) => {
    if (!selectedTable) return;
    if (window.confirm("Deseja realmente cancelar este pedido? O valor será subtraído do total da mesa.")) {
      try {
        await deleteDoc(doc(db, "orders", order.id));
        
        // Update table amount
        const newTotal = Math.max(0, (selectedTable.totalAmount || 0) - order.total);
        await updateDoc(doc(db, "tables", selectedTable.id), {
          totalAmount: newTotal,
          updatedAt: new Date().toISOString()
        });

        // Update local selected table if needed (onSnapshot will normally handle this)
      } catch (e) {
        console.error(e);
      }
    }
  };

  const addItemToOrder = (item: any) => {
    const existing = currentOrder.find(i => i.name === item.name);
    if (existing) {
      setCurrentOrder(currentOrder.map(i => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCurrentOrder([...currentOrder, { ...item, quantity: 1 }]);
    }
  };

  const sendOrder = async () => {
    if (!selectedTable || currentOrder.length === 0) return;
    try {
      const orderTotal = currentOrder.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      
      // Create order
      await addDoc(collection(db, "orders"), {
        tableId: selectedTable.id,
        items: currentOrder,
        total: orderTotal,
        status: "pending",
        waiterId: profile?.uid,
        createdAt: new Date().toISOString()
      });

      // Update table amount
      const newTotal = (selectedTable.totalAmount || 0) + orderTotal;
      await updateDoc(doc(db, "tables", selectedTable.id), {
        totalAmount: newTotal,
        updatedAt: new Date().toISOString()
      });

      setCurrentOrder([]);
      setIsAddingItems(false);
      
      // Update local selected table
      const docSnap = await getDoc(doc(db, "tables", selectedTable.id));
      if (docSnap.exists()) {
        setSelectedTable({ id: docSnap.id, ...docSnap.data() } as Table);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const requestBillAction = async () => {
    if (!selectedTable) return;
    try {
      await updateDoc(doc(db, "tables", selectedTable.id), {
        status: "bill_requested",
        updatedAt: new Date().toISOString()
      });

      // Create notification for other waiters/admins
      await addDoc(collection(db, "notifications"), {
        type: "bill_request",
        tableNumber: selectedTable.number,
        tableId: selectedTable.id,
        message: `Mesa ${selectedTable.number}: O garçom ${profile?.name} solicitou o fechamento!`,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Update local selected table
      const docSnap = await getDoc(doc(db, "tables", selectedTable.id));
      if (docSnap.exists()) {
        setSelectedTable({ id: docSnap.id, ...docSnap.data() } as Table);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const closeTable = async () => {
    if (!selectedTable) return;
    try {
      await updateDoc(doc(db, "tables", selectedTable.id), {
        status: "paid",
        updatedAt: new Date().toISOString()
      });
      setSelectedTable(null);
      setIsBillOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const removeTable = async (id: string) => {
    setTableToDelete(id);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-primary">
      {/* Toast Notification - Persistent & Visual */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[200] w-full max-w-sm px-4"
          >
            <div className="bg-accent text-primary-dark p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/20">
              <div className="bg-white/20 p-2 rounded-xl animate-bounce">
                <BellRing size={24} />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm uppercase tracking-tighter">Novo Alerta!</p>
                <p className="text-sm font-bold leading-tight">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="p-2 hover:bg-black/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar />

      <main className="p-6 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold gold-text">Área do Garçom</h1>
            <p className="text-accent-light opacity-60">Gerencie mesas e pedidos com eficiência.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-full border border-coffee transition-colors ${notifications.some(n => !n.read) ? 'bg-accent/20 text-accent animate-pulse' : 'bg-secondary/30 text-accent-light'}`}
              >
                {notifications.some(n => !n.read) ? <BellRing size={24} /> : <Bell size={24} />}
              </button>
              
              {showNotifications && (
                <div className="absolute top-14 right-0 w-80 bg-secondary border border-accent rounded-3xl shadow-2xl z-[100] max-h-[400px] overflow-y-auto overflow-x-hidden flex flex-col">
                  <div className="p-4 bg-primary-dark border-b border-coffee sticky top-0 flex justify-between items-center z-10">
                    <div className="flex flex-col">
                      <h3 className="gold-text font-bold text-sm uppercase">Notificações</h3>
                      <div className="flex gap-2 mt-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                          className={`text-[9px] px-2 py-0.5 rounded-full font-black border ${soundEnabled ? 'border-green-500/50 text-green-500 bg-green-500/5' : 'border-red-500/50 text-red-500 bg-red-500/5'}`}
                        >
                          SOM {soundEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                          className="text-[9px] px-2 py-0.5 rounded-full font-black border border-accent/50 text-accent bg-accent/5"
                        >
                          LIMPAR TUDO
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setShowNotifications(false)} className="text-accent-light"><X size={18} /></button>
                  </div>
                  <div className="divide-y divide-coffee/30">
                    {notifications.length > 0 ? notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-4 hover:bg-primary-dark/50 transition-colors cursor-pointer ${!n.read ? 'bg-accent/5 border-l-4 border-accent' : ''}`}
                        onClick={() => markNotifyRead(n.id)}
                      >
                        <p className={`text-sm ${!n.read ? 'font-bold text-white' : 'text-accent-light'}`}>{n.message}</p>
                        <p className="text-[10px] opacity-40 mt-1">{new Date(n.createdAt?.seconds * 1000).toLocaleTimeString()}</p>
                      </div>
                    )) : (
                      <div className="p-10 text-center text-sm text-coffee italic">
                        Nenhuma notificação
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsOpeningTable(true)}
              className="p-3 gold-gradient rounded-full text-primary-dark shadow-lg shadow-primary-dark hover:scale-110 transition-transform"
            >
              <Plus size={24} />
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: -50, x: '-50%' }}
              animate={{ opacity: 1, y: 20, x: '-50%' }}
              exit={{ opacity: 0, y: -50, x: '-50%' }}
              className="fixed top-20 left-1/2 z-[200] w-full max-w-sm"
              onClick={() => {
                setToast(null);
                setShowNotifications(true);
              }}
            >
              <div className="bg-accent text-primary-dark p-4 rounded-2xl shadow-2xl flex items-center gap-4 cursor-pointer">
                <div className="bg-primary-dark/20 p-2 rounded-xl">
                  <BellRing size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm uppercase tracking-tight">Novo Chamado!</p>
                  <p className="text-xs font-bold opacity-80">{toast.message}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setToast(null); }} className="p-1"><X size={16}/></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mesas Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {tables.map(table => (
            <motion.button
              key={table.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedTable(table)}
              className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${
                table.status === 'bill_requested' 
                ? 'border-yellow-500 bg-yellow-950/20 animate-pulse' 
                : 'border-coffee bg-secondary/30'
              }`}
            >
              <div className="absolute -top-3 -right-3 flex gap-1">
                {table.status === 'bill_requested' && (
                  <div className="bg-yellow-500 text-primary-dark p-2 rounded-full shadow-lg">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </div>
              <span className="text-sm uppercase tracking-widest text-accent-light mb-1">Mesa</span>
              <span className="text-4xl font-black gold-text">{table.number}</span>
              {table.name && (
                <span className="text-[10px] font-bold text-accent-light opacity-60 mt-1 uppercase truncate max-w-full italic px-2">
                  "{table.name}"
                </span>
              )}
              <div className="flex items-center gap-1 mt-3 text-xs opacity-60">
                <Users size={12} />
                <span>{table.occupants}</span>
              </div>
              <div className="mt-4 font-bold text-accent">
                R$ {table.totalAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Modal: Detalhes da Mesa */}
        <AnimatePresence>
          {selectedTable && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-primary-dark/95 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            >
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="bg-secondary w-full max-w-2xl rounded-3xl border border-accent overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-6 bg-primary-dark border-b border-coffee flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl gold-gradient flex flex-col items-center justify-center text-primary-dark">
                      <span className="text-[10px] font-bold uppercase">Mesa</span>
                      <span className="text-2xl font-black">{selectedTable.number}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold gold-text">
                          {selectedTable.name ? `Mesa ${selectedTable.number} - ${selectedTable.name}` : 'Detalhes da Mesa'}
                        </h2>
                        <button 
                          onClick={() => {
                            setEditTableNumber(selectedTable.number.toString());
                            setEditTableName(selectedTable.name || "");
                            setEditTableOccupants(selectedTable.occupants.toString());
                            setIsEditingTable(true);
                          }}
                          className="p-1 text-accent-light opacity-40 hover:opacity-100 hover:text-accent transition-all"
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-accent-light opacity-60">
                        <Users size={12} /> {selectedTable.occupants} pessoas | <Clock size={12} /> Criada {new Date(selectedTable.createdAt?.seconds * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => removeTable(selectedTable.id)} 
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      title="Excluir Mesa"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button onClick={() => setSelectedTable(null)} className="p-2 text-accent-light hover:text-white">
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Comanda / Pedidos */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm uppercase tracking-widest text-accent-light font-bold flex items-center gap-2">
                        <FileText size={16} /> Pedidos da Mesa
                      </h3>
                      <span className="text-xs gold-text font-black px-3 py-1 bg-accent/10 rounded-full border border-accent/20">
                        TOTAL: R$ {selectedTable.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tableOrders.length > 0 ? tableOrders.map(order => (
                        <div key={order.id} className="bg-primary-dark/40 p-4 rounded-2xl border border-coffee/30 flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md border ${order.status === 'pending' ? 'border-orange-500/50 text-orange-400 bg-orange-500/5 shadow-[0_0_10px_rgba(249,115,22,0.1)]' : 'border-green-500/50 text-green-400 bg-green-500/5'}`}>
                                {order.status === 'pending' ? 'Cozinha/Bar' : 'Entregue'}
                              </span>
                              <span className="text-[10px] text-accent-light opacity-40">
                                {new Date(order.createdAt?.seconds * 1000).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="text-sm text-white/90">
                                  <span className="gold-text font-bold mr-2">{item.quantity}x</span>
                                  {item.name}
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-xs font-bold text-accent">Total: R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            {order.status === 'pending' && (
                              <button 
                                onClick={() => completeOrder(order.id)}
                                className="p-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl hover:bg-green-500 hover:text-primary-dark transition-all"
                                title="Marcar como Entregue"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => cancelOrder(order)}
                              className="p-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500 hover:text-primary-dark transition-all"
                              title="Cancelar Pedido"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="py-10 text-center border-2 border-dashed border-coffee/20 rounded-3xl">
                          <ShoppingBag className="mx-auto text-coffee opacity-20 mb-3" size={32} />
                          <p className="text-xs text-accent-light opacity-40 italic">Nenhum pedido lançado ainda.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setIsAddingItems(true)}
                      className="p-4 bg-coffee/30 border border-accent/30 rounded-2xl flex items-center gap-3 hover:bg-coffee/50 transition-colors"
                    >
                      <PlusCircle className="text-accent" />
                      <div className="text-left">
                        <p className="font-bold text-white">Lançar Pedido</p>
                        <p className="text-xs text-accent-light opacity-60">Adicionar itens à mesa</p>
                      </div>
                    </button>
                    {selectedTable.status === 'active' ? (
                      <button 
                        onClick={requestBillAction}
                        className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-3 hover:bg-yellow-500/20 transition-colors"
                      >
                        <CreditCard className="text-yellow-500" />
                        <div className="text-left">
                          <p className="font-bold text-yellow-500">Fechar Conta</p>
                          <p className="text-xs text-accent-light opacity-60">Solicitar encerramento</p>
                        </div>
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIsBillOpen(true)}
                        className="p-4 bg-accent/10 border border-accent/30 rounded-2xl flex items-center gap-3 hover:bg-accent/20 transition-colors"
                      >
                        <FileText className="text-accent" />
                        <div className="text-left">
                          <p className="font-bold text-accent">Ver Conta</p>
                          <p className="text-xs text-accent-light opacity-60">Detalhes e pagamento</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Modal: Editar Mesa */}
          {isEditingTable && selectedTable && (
            <div className="fixed inset-0 z-[90] bg-primary-dark/90 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-secondary p-8 rounded-[2.5rem] border border-accent w-full max-w-sm overflow-hidden relative"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl"></div>
                <h2 className="text-2xl font-black gold-text mb-6 uppercase tracking-tighter">Editar Mesa {selectedTable.number}</h2>
                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black gold-text opacity-60 ml-2">Número da Mesa</label>
                    <input 
                      type="number" 
                      value={editTableNumber}
                      onChange={(e) => setEditTableNumber(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-accent transition-all text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black gold-text opacity-60 ml-2">Identificação / Nome</label>
                    <input 
                      type="text" 
                      value={editTableName}
                      onChange={(e) => setEditTableName(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-accent transition-all text-white font-bold"
                      placeholder="Ex: Reserva Beira Mar"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black gold-text opacity-60 ml-2">Pessoas (Ocupantes)</label>
                    <input 
                      type="number" 
                      value={editTableOccupants}
                      onChange={(e) => setEditTableOccupants(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-accent transition-all text-white font-bold"
                    />
                  </div>
                  
                  <div className="flex gap-4 mt-8 pt-4">
                    <button 
                      onClick={() => setIsEditingTable(false)} 
                      className="flex-1 py-4 text-accent-light font-black uppercase text-xs tracking-widest hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={updateTableInfo} 
                      className="flex-1 py-4 gold-gradient text-primary-dark rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary-dark/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Abrir Mesa */}
          {isOpeningTable && (
            <div className="fixed inset-0 z-[60] bg-primary-dark/90 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-secondary p-8 rounded-3xl border border-accent w-full max-w-sm"
              >
                <h2 className="text-2xl font-bold gold-text mb-6">Abrir Nova Mesa</h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase gold-text">Número da Mesa</label>
                    <input 
                      type="number" 
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Ex: 05"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase gold-text">Pessoas</label>
                    <input 
                      type="number" 
                      value={newTableOccupants}
                      onChange={(e) => setNewTableOccupants(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase gold-text">Identificação da Mesa (Opcional)</label>
                    <input 
                      type="text" 
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Ex: Reserva João, Lateral"
                    />
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button onClick={() => setIsOpeningTable(false)} className="flex-1 py-3 text-accent-light font-bold">Cancelar</button>
                    <button onClick={openTable} className="flex-1 py-3 gold-gradient text-primary-dark rounded-xl font-bold">Abrir Mesa</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Adicionar Itens */}
          {isAddingItems && (
            <div className="fixed inset-0 z-[70] bg-primary-dark flex flex-col">
              <header className="p-4 border-b border-coffee flex justify-between items-center">
                <h2 className="font-bold gold-text">Lançar Pedido - Mesa {selectedTable?.number}</h2>
                <button onClick={() => setIsAddingItems(false)}><X /></button>
              </header>
              
              <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
                {/* Menu */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {Array.from(new Set(menuToDisplay.map(i => i.category))).map(cat => (
                    <div key={cat} className="space-y-3">
                      <h3 className="text-xs font-bold text-accent uppercase tracking-widest">{cat}</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {menuToDisplay.filter(i => i.category === cat && i.available !== false).map(item => (
                          <button 
                            key={item.id || item.name}
                            onClick={() => addItemToOrder(item)}
                            className="p-4 bg-secondary/30 border border-coffee/30 rounded-xl flex justify-between items-center text-left hover:bg-secondary/50"
                          >
                            <div>
                              <p className="font-bold text-sm">{item.name}</p>
                              <p className="text-xs text-accent-light opacity-60">R$ {item.price.toFixed(2)}</p>
                            </div>
                            <PlusCircle size={20} className="text-accent" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo Pedido */}
                <div className="w-full sm:w-80 bg-primary-dark border-t sm:border-t-0 sm:border-l border-coffee p-4 flex flex-col">
                  <h3 className="font-bold gold-text mb-4">Pedido Atual</h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {currentOrder.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-secondary/20 p-3 rounded-lg border border-coffee/20">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{item.name}</p>
                          <p className="text-xs text-accent-light">R$ {(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="font-black text-accent">{item.quantity}x</span>
                           <button 
                            onClick={() => setCurrentOrder(currentOrder.filter((_, i) => i !== idx))}
                            className="text-red-400"
                           ><X size={16}/></button>
                        </div>
                      </div>
                    ))}
                    {currentOrder.length === 0 && (
                      <p className="text-center text-coffee text-sm italic mt-10">Nenhum item adicionado.</p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-coffee space-y-4">
                    <div className="flex justify-between text-xl font-black gold-text">
                      <span>Total</span>
                      <span>R$ {currentOrder.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={sendOrder}
                      disabled={currentOrder.length === 0}
                      className="w-full gold-gradient py-3 rounded-xl text-primary-dark font-bold shadow-lg disabled:opacity-50"
                    >
                      Enviar Pedido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Conta */}
          {isBillOpen && selectedTable && (
            <div className="fixed inset-0 z-[80] bg-primary-dark/95 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-secondary w-full max-w-md rounded-3xl border border-accent overflow-hidden"
              >
                <div className="p-6 bg-primary-dark border-b border-coffee text-center">
                  <h2 className="text-2xl font-black gold-text mb-1">CONTA DETALHADA</h2>
                  <p className="text-xs text-accent-light opacity-60">MESA {selectedTable.number}</p>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="space-y-3 pb-6 border-b border-coffee/30">
                    <div className="flex justify-between font-bold">
                      <span className="text-accent-light">Total Consumido</span>
                      <span className="text-white text-xl">R$ {selectedTable.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {/* Taxa de mesa simulada ou inclusa */}
                    <div className="flex justify-between text-sm opacity-60">
                      <span>Taxa de Mesa (Inclusa)</span>
                      <span>R$ 0,00</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase gold-text font-bold">Divisão da Conta</p>
                    <div className="flex items-center gap-4 bg-primary-dark p-4 rounded-2xl border border-coffee">
                      <Divide className="text-accent" />
                      <div className="flex-1">
                        <p className="text-xs text-accent-light opacity-60 font-bold mb-1">Pessoas</p>
                        <input 
                          type="number" 
                          min="1"
                          value={splitCount}
                          onChange={(e) => setSplitCount(parseInt(e.target.value) || 1)}
                          className="bg-transparent w-full font-bold text-xl outline-none"
                        />
                      </div>
                    </div>
                    <div className="bg-accent/10 p-5 rounded-2xl border border-accent/20 flex flex-col items-center justify-center">
                      <p className="text-xs gold-text uppercase font-bold opacity-60 mb-1">Valor por Pessoa</p>
                      <p className="text-3xl font-black text-white">R$ {(selectedTable.totalAmount / splitCount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsBillOpen(false)} className="flex-1 py-4 text-accent-light font-bold">Voltar</button>
                    <button 
                      onClick={closeTable}
                      className="flex-1 gold-gradient py-4 rounded-2xl text-primary-dark font-black shadow-lg shadow-primary-dark/50"
                    >
                      CONFIRMAR PAGAMENTO
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: Exclusão de Mesa */}
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[110] bg-primary-dark/95 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-secondary p-8 rounded-[2.5rem] border-2 border-red-500/50 w-full max-w-md text-center space-y-6 shadow-2xl relative"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>
                
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <AlertCircle size={32} />
                </div>
                
                <h3 className="gold-text font-black uppercase tracking-tighter text-xl">Confirmar Exclusão</h3>
                
                <p className="text-accent-light text-sm font-bold leading-relaxed px-2 uppercase">
                  VOCÊ DESEJA EXCLUIR ESTA MESA? SE SIM CLIQUE EM (DELETAR) SE NÃO CLIQUE EM (NÃO).
                </p>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setTableToDelete(null);
                    }}
                    className="flex-1 py-4 bg-primary-dark border border-coffee rounded-2xl text-accent-light font-black uppercase text-xs tracking-widest hover:text-white transition-colors"
                  >
                    (NÃO)
                  </button>
                  <button 
                    onClick={async () => {
                      if (tableToDelete) {
                        try {
                          await deleteDoc(doc(db, "tables", tableToDelete));
                          setSelectedTable(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }
                      setIsDeleteModalOpen(false);
                      setTableToDelete(null);
                    }}
                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all"
                  >
                    (DELETAR)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
