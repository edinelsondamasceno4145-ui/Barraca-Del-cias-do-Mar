import { INITIAL_MENU } from "../constants";
import { useState, useEffect } from "react";
import { db, collection, query, onSnapshot, orderBy } from "../firebase";
import { MenuItem } from "../types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, UtensilsCrossed, Beer, Waves, Filter, CheckCircle2, Circle } from "lucide-react";

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "menuItems"), orderBy("category", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setMenuItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const menuToDisplay = menuItems.length > 0 ? menuItems : INITIAL_MENU.map((item, idx) => ({ ...item, id: `init-${idx}`, available: true })) as MenuItem[];
  const allCategories: string[] = Array.from(new Set(menuToDisplay.map(item => item.category)));
  
  const filteredItems = menuToDisplay.filter(item => {
    const matchesCategory = selectedCategory === "TODOS" || item.category === selectedCategory;
    const matchesAvailability = showOnlyAvailable ? item.available !== false : true;
    return matchesCategory && matchesAvailability;
  });

  const categoriesToRender = selectedCategory === "TODOS" 
    ? allCategories 
    : allCategories.filter(cat => cat === selectedCategory);

  const getIcon = (category: string) => {
    switch (category) {
      case "PEIXES": return <Waves className="text-accent" />;
      case "CARNES": return <UtensilsCrossed className="text-accent" />;
      case "TIRA GOSTO": return <Coffee className="text-accent" />;
      case "BEBIDAS": return <Beer className="text-accent" />;
      default: return <UtensilsCrossed className="text-accent" />;
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <Navbar />
      
      <header className="py-12 px-6 text-center bg-primary-dark border-b border-coffee relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <Waves className="absolute -top-10 -left-10 w-64 h-64 text-accent rotate-12" />
          <Waves className="absolute -bottom-10 -right-10 w-64 h-64 text-accent -rotate-12" />
        </div>
        
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="mb-6 flex justify-center"
        >
          <img 
            src="/logo.png" 
            alt="Logo Delícias do Mar" 
            className="w-32 h-32 rounded-[2rem] border-4 border-accent shadow-2xl object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-6xl font-black gold-text mb-4 tracking-tighter uppercase"
        >
          Cardápio Oficial
        </motion.h1>
        <p className="text-accent-light text-lg max-w-2xl mx-auto opacity-80">
          Descubra os sabores autênticos da nossa barraca. Ingredientes frescos, tempero caseiro e a brisa do mar.
        </p>
      </header>

      <main className="max-w-5xl mx-auto py-12 px-6 space-y-16">
        {/* Filtros */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold gold-text uppercase flex items-center gap-2">
              <Filter size={18} /> Filtros
            </h2>
            
            <button 
              onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-bold ${showOnlyAvailable ? 'bg-accent/10 border-accent text-accent' : 'border-coffee text-accent-light opacity-60'}`}
            >
              {showOnlyAvailable ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              Apenas Disponíveis
            </button>
          </div>

          <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedCategory("TODOS")}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap shadow-sm ${selectedCategory === "TODOS" ? 'gold-gradient text-primary-dark border-accent' : 'bg-primary-dark text-accent-light border-coffee hover:border-accent'}`}
            >
              TODOS
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap shadow-sm ${selectedCategory === cat ? 'gold-gradient text-primary-dark border-accent' : 'bg-primary-dark text-accent-light border-coffee hover:border-accent'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {categoriesToRender.map((category) => {
          const itemsInSection = filteredItems.filter(item => item.category === category);
          if (itemsInSection.length === 0) return null;

          return (
            <section key={category} className="space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-secondary rounded-xl border border-coffee">
                  {getIcon(category)}
                </div>
                <h2 className="text-3xl font-bold gold-text tracking-widest uppercase">{category}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {itemsInSection.map((item, idx) => (
                  <motion.div 
                    key={item.id || item.name}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-secondary/40 p-5 rounded-2xl border-l-4 ${item.available !== false ? 'border-accent hover:bg-secondary/60' : 'border-red-500/50 opacity-60'} transition-colors group relative`}
                  >
                    {!item.available && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[8px] font-black text-red-500 uppercase tracking-tighter">
                        Indisponível
                      </div>
                    )}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-accent-light opacity-70 mt-1">{item.description}</p>
                        )}
                      </div>
                      <span className="text-xl font-black gold-text whitespace-nowrap">
                        R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="py-20 text-center">
            <UtensilsCrossed className="mx-auto text-coffee opacity-20 mb-4" size={48} />
            <p className="text-accent-light opacity-40 italic">Nenhum item encontrado com estes filtros.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
