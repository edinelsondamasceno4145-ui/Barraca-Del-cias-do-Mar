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
import { Table, Order, MenuItem } from "../types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ReviewModal from "../components/ReviewModal";
import { 
  ShoppingBag, 
  Plus, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  Hash,
  X,
  CreditCard,
  Star,
  BellRing
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";
import { INITIAL_MENU } from "../constants";
import { useToast } from "../components/Toast";

export default function CustomerPage() {
  const toast = useToast();
  const [activeTable, setActiveTable] = useState<Table | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [reviewedOrders, setReviewedOrders] = useState<string[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [isLinkingTable, setIsLinkingTable] = useState(false);
  const [tableCode, setTableCode] = useState("");
  const [isRequestingAssistance, setIsRequestingAssistance] = useState(false);
  
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Table assigned to this customer
    const tablesQuery = query(
      collection(db, "tables"), 
      where("customerId", "==", user.uid),
      where("status", "!=", "paid"),
      limit(1)
    );
    const unsubTable = onSnapshot(tablesQuery, (snapshot) => {
      if (!snapshot.empty) {
        setActiveTable({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Table);
      } else {
        setActiveTable(null);
      }
    });

    // Orders for this customer
    const ordersQuery = query(
      collection(db, "orders"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setMyOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);
    });

    // Reviews by this customer
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("customerId", "==", user.uid)
    );
    const unsubReviews = onSnapshot(reviewsQuery, (snapshot) => {
      setReviewedOrders(snapshot.docs.map(d => d.data().orderId));
    });

    return () => {
      unsubTable();
      unsubOrders();
      unsubReviews();
    };
  }, [user]);

  const toggleItem = (item: any) => {
    const existing = selectedItems.find(i => i.name === item.name);
    if (existing) {
      setSelectedItems(selectedItems.filter(i => i.name !== item.name));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (name: string, delta: number) => {
    setSelectedItems(selectedItems.map(i => {
      if (i.name === name) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const placeOrder = async () => {
    if (!activeTable || selectedItems.length === 0) return;
    try {
      const orderTotal = selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      
      // Create Order
      await addDoc(collection(db, "orders"), {
        tableId: activeTable.id,
        items: selectedItems,
        total: orderTotal,
        status: "pending",
        customerId: user?.uid,
        createdAt: new Date().toISOString()
      });

      // Notify Waiters
      await addDoc(collection(db, "notifications"), {
        type: "order_update",
        tableNumber: activeTable.number,
        tableId: activeTable.id,
        message: `Novo pedido da Mesa ${activeTable.number}!`,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Update table amount
      const newTotal = (activeTable.totalAmount || 0) + orderTotal;
      await updateDoc(doc(db, "tables", activeTable.id), {
        totalAmount: newTotal,
        updatedAt: new Date().toISOString()
      });

      const itemsSummary = selectedItems.map(i => `${i.quantity}x ${i.name}`).join(", ");
      toast.success("Pedido Enviado com Sucesso!", `Seu pedido (${itemsSummary}) já foi enviado para a cozinha!`);
      
      setSelectedItems([]);
      setIsOrdering(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao Realizar Pedido", e.message || "Tente novamente ou fale com o garçom.");
    }
  };

  const requestBill = async () => {
    if (!activeTable) return;
    try {
      await updateDoc(doc(db, "tables", activeTable.id), {
        status: "bill_requested",
        updatedAt: new Date().toISOString()
      });

      // Create notification for waiters
      await addDoc(collection(db, "notifications"), {
        type: "bill_request",
        tableNumber: activeTable.number,
        tableId: activeTable.id,
        message: `A mesa ${activeTable.number} solicitou a conta!`,
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success("Fechamento Solicitado!", "A conta foi solicitada. O garçom trará os detalhes e a maquininha em breve.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na Solicitação", "Falha ao solicitar o fechamento da conta.");
    }
  };

  const requestAssistance = async () => {
    if (!activeTable) return;
    setIsRequestingAssistance(true);
    try {
      await addDoc(collection(db, "notifications"), {
        type: "bill_request",
        tableNumber: activeTable.number,
        tableId: activeTable.id,
        message: `A mesa ${activeTable.number} solicitou atendimento!`,
        read: false,
        createdAt: new Date().toISOString()
      });
      toast.success("Garçom Chamado!", "Recebemos sua solicitação. Um garçom está a caminho para auxiliá-lo.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro de Chamada", "Não foi possível chamar o garçom. Tente novamente.");
    } finally {
      setIsRequestingAssistance(false);
    }
  };

  const linkTable = async () => {
    try {
      const q = query(
        collection(db, "tables"),
        where("number", "==", parseInt(tableCode)),
        where("status", "==", "active"),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const tableDoc = snapshot.docs[0];
        await updateDoc(doc(db, "tables", tableDoc.id), {
          customerId: user?.uid,
          updatedAt: new Date().toISOString()
        });
        toast.success("Mesa Vinculada!", `Você está conectado à Mesa ${tableCode} com sucesso!`);
        setIsLinkingTable(false);
      } else {
        toast.warning("Mesa Indisponível", "A mesa informada não está aberta ou ativa no sistema no momento.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao Vincular", "Ocorreu um erro ao vincular a mesa.");
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <Navbar />

      <main className="p-6 max-w-4xl mx-auto space-y-8">
        {!activeTable ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/40 p-10 rounded-3xl border border-coffee text-center space-y-6"
          >
            <div className="w-20 h-20 bg-primary-dark rounded-full flex items-center justify-center mx-auto border border-accent">
              <Hash className="text-accent" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold gold-text">Seja bem-vindo!</h2>
              <p className="text-accent-light opacity-60 mt-2">Para fazer pedidos, informe o número da sua mesa.</p>
            </div>
            <div className="max-w-xs mx-auto space-y-4">
              <input 
                type="number"
                value={tableCode}
                onChange={(e) => setTableCode(e.target.value)}
                placeholder="Número da mesa"
                className="w-full bg-primary-dark border border-coffee rounded-xl py-3 px-4 text-center text-xl font-bold gold-text outline-none focus:ring-2 focus:ring-accent"
              />
              <button 
                onClick={linkTable}
                className="w-full gold-gradient py-3 rounded-xl text-primary-dark font-bold hover:scale-105 transition-transform"
              >
                Vincular Mesa
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            <header className="flex justify-between items-center bg-secondary/30 p-6 rounded-3xl border border-coffee">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 gold-gradient rounded-xl flex flex-col items-center justify-center text-primary-dark">
                  <span className="text-[8px] font-bold">MESA</span>
                  <span className="text-lg font-black">{activeTable.number}</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Sua Comanda</h1>
                  <p className="text-sm gold-text font-bold">Total: R$ {activeTable.totalAmount?.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={requestAssistance}
                  disabled={isRequestingAssistance}
                  className="p-3 bg-secondary rounded-xl text-accent border border-coffee hover:bg-secondary/50 transition-colors disabled:opacity-50"
                  title="Chamar Garçom"
                >
                  <BellRing size={20} />
                </button>
                {activeTable.status === 'bill_requested' ? (
                  <div className="bg-yellow-500/20 text-yellow-500 text-xs px-3 py-1 rounded-full border border-yellow-500/50 flex items-center gap-1">
                    <Clock size={12} /> Aguardando Garçom
                  </div>
                ) : (
                  <button 
                    onClick={requestBill}
                    className="p-3 bg-secondary rounded-xl text-accent border border-coffee hover:bg-secondary/50 transition-colors"
                    title="Fechar Conta"
                  >
                    <CreditCard size={20} />
                  </button>
                )}
                <button 
                  onClick={() => setIsOrdering(true)}
                  className="p-3 gold-gradient rounded-xl text-primary-dark shadow-lg shadow-primary-dark"
                >
                  <Plus size={20} />
                </button>
              </div>
            </header>

            <section className="space-y-4">
              <h2 className="text-sm font-bold gold-text uppercase tracking-widest flex items-center gap-2">
                <ShoppingBag size={16} /> Meus Pedidos
              </h2>
              <div className="space-y-3">
                {myOrders.map(order => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-secondary/20 p-4 rounded-2xl border border-coffee/30 flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${order.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                          {order.status === 'pending' ? 'Preparando' : 'Entregue'}
                        </span>
                        <span className="text-xs text-accent-light opacity-60">
                           {new Date(order.createdAt?.seconds * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-accent">R$ {order.total.toFixed(2)}</span>
                      {order.status === 'completed' && !reviewedOrders.includes(order.id) && (
                        <button 
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsReviewing(true);
                          }}
                          className="flex items-center gap-1 text-[10px] bg-accent/10 border border-accent/20 px-2 py-1 rounded-lg text-accent hover:bg-accent hover:text-primary-dark transition-all font-black uppercase"
                        >
                          <Star size={12} className="fill-current" />
                          Avaliar
                        </button>
                      )}
                      {reviewedOrders.includes(order.id) && (
                        <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase opacity-60">
                          <CheckCircle2 size={12} />
                          Avaliado
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {myOrders.length === 0 && (
                  <div className="text-center py-10 opacity-40 italic text-sm">
                    Você ainda não fez nenhum pedido nesta mesa.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />

      {selectedOrder && (
        <ReviewModal 
          isOpen={isReviewing}
          onClose={() => setIsReviewing(false)}
          orderId={selectedOrder.id}
          customerId={user?.uid || ""}
          customerName={profile?.name || "Cliente"}
        />
      )}

      <AnimatePresence>
        {isOrdering && (
          <div className="fixed inset-0 z-[100] bg-primary flex flex-col">
             <header className="p-4 border-b border-coffee flex justify-between items-center bg-primary-dark">
                <h2 className="font-bold gold-text underline underline-offset-8">REALIZAR PEDIDO</h2>
                <button 
                  onClick={() => setIsOrdering(false)}
                  className="p-2 text-accent-light"
                ><X /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-10 pb-32">
                 {Array.from(new Set(INITIAL_MENU.map(i => i.category))).map(cat => (
                    <section key={cat} className="space-y-4">
                      <h3 className="text-xs font-bold text-accent-light uppercase tracking-[0.2em] ml-2">{cat}</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {INITIAL_MENU.filter(i => i.category === cat).map(item => {
                          const selected = selectedItems.find(si => si.name === item.name);
                          return (
                            <div 
                              key={item.name}
                              className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selected ? 'bg-accent/10 border-accent' : 'bg-secondary/30 border-coffee'}`}
                            >
                              <div className="flex-1" onClick={() => toggleItem(item)}>
                                <p className="font-bold text-white mb-1">{item.name}</p>
                                <p className="text-xs gold-text">R$ {item.price.toFixed(2)}</p>
                              </div>
                              {selected && (
                                <div className="flex items-center gap-4 bg-primary-dark p-2 rounded-xl border border-accent">
                                  <button onClick={() => updateQuantity(item.name, -1)} className="text-accent p-1"><X size={14}/></button>
                                  <span className="font-black text-white">{selected.quantity}</span>
                                  <button onClick={() => updateQuantity(item.name, 1)} className="text-accent p-1"><Plus size={14}/></button>
                                </div>
                              ) || (
                                <button 
                                  onClick={() => toggleItem(item)}
                                  className="p-3 bg-secondary rounded-xl text-accent border border-coffee"
                                >
                                  <Plus size={18} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </section>
                 ))}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-6 bg-primary-dark border-t border-accent shadow-2xl shadow-accent/20">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                  <div>
                    <p className="text-xs text-accent-light opacity-60 font-bold uppercase">Total do Pedido</p>
                    <p className="text-2xl font-black gold-text">R$ {selectedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                  </div>
                  <button 
                    onClick={placeOrder}
                    disabled={selectedItems.length === 0}
                    className="flex-1 gold-gradient py-4 rounded-2xl text-primary-dark font-black shadow-lg disabled:opacity-50 hover:scale-105 transition-transform"
                  >
                    CONFIRMAR PEDIDO
                  </button>
                </div>
              </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// End of file
