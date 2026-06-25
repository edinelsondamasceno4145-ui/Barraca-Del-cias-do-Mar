import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // Defaults to 4000ms
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string, duration?: number) => {
    addToast("success", title, message, duration);
  }, [addToast]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    addToast("error", title, message, duration);
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    addToast("warning", title, message, duration);
  }, [addToast]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    addToast("info", title, message, duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onClose }: { toast: Toast; onClose: (id: string) => void; key?: any }) => {
  const { id, type, title, message, duration = 4000 } = toast;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
  };

  const borders = {
    success: "border-emerald-500/20 shadow-emerald-500/5",
    error: "border-rose-500/20 shadow-rose-500/5",
    warning: "border-amber-500/20 shadow-amber-500/5",
    info: "border-sky-500/20 shadow-sky-500/5",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.15 } }}
      className={`pointer-events-auto w-full bg-primary-dark/95 backdrop-blur-md border rounded-2xl p-4 shadow-xl flex gap-3 relative overflow-hidden ${borders[type]}`}
    >
      {/* Dynamic light accent top edge */}
      <span className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
        type === "success" ? "from-emerald-500 to-teal-500" :
        type === "error" ? "from-rose-500 to-pink-500" :
        type === "warning" ? "from-amber-500 to-yellow-500" :
        "from-sky-500 to-blue-500"
      }`} />

      {icons[type]}

      <div className="flex-1 pr-4">
        <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{title}</h4>
        {message && <p className="text-xs text-accent-light/80 mt-1 leading-relaxed font-sans">{message}</p>}
      </div>

      <button
        onClick={() => onClose(id)}
        className="text-accent-light/40 hover:text-white hover:bg-white/5 p-1 rounded-lg transition-colors self-start shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress animation representing duration */}
      {duration > 0 && (
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          className={`absolute bottom-0 left-0 h-[2px] ${
            type === "success" ? "bg-emerald-500/40" :
            type === "error" ? "bg-rose-500/40" :
            type === "warning" ? "bg-amber-500/40" :
            "bg-sky-500/40"
          }`}
        />
      )}
    </motion.div>
  );
};
