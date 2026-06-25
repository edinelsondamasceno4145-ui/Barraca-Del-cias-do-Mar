import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, X, MessageSquare, Send } from "lucide-react";
import { db, collection, addDoc } from "../firebase";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  customerId: string;
  customerName: string;
}

export default function ReviewModal({ isOpen, onClose, orderId, customerId, customerName }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addDoc(collection(db, "reviews"), {
        orderId: orderId,
        customerId: customerId,
        customerName: customerName,
        rating,
        comment,
        createdAt: new Date().toISOString()
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setComment("");
        setRating(5);
      }, 2000);
    } catch (error) {
      console.error("Error submitting review to Firestore:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-primary-dark/80 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-secondary rounded-3xl border border-accent shadow-2xl overflow-hidden"
          >
            {success ? (
              <div className="p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500 animate-pulse">
                  <Star className="text-green-500 fill-current" size={40} />
                </div>
                <h3 className="text-2xl font-black gold-text uppercase">Obrigado!</h3>
                <p className="text-accent-light opacity-80 font-medium">Sua avaliação ajuda a melhorar nossas Delícias do Mar.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-coffee flex justify-between items-center bg-primary-dark/50">
                  <h3 className="text-xl font-black gold-text uppercase tracking-tighter">Avaliar Pedido</h3>
                  <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-accent">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                  <div className="space-y-4 text-center">
                    <p className="text-sm font-bold text-accent-light uppercase tracking-widest opacity-60">Sua Nota</p>
                    <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className={`transform transition-all active:scale-90 ${rating >= star ? 'scale-110' : 'opacity-40 grayscale'}`}
                        >
                          <Star 
                            size={44} 
                            className={`${rating >= star ? 'text-accent fill-current' : 'text-coffee'}`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-lg font-black gold-text">
                      {rating === 5 ? "Excelente!" : rating === 4 ? "Muito Bom" : rating === 3 ? "Bom" : rating === 2 ? "Poderia melhorar" : "Insatisfeito"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-accent-light opacity-60">
                      <MessageSquare size={18} />
                      <label className="text-xs font-bold uppercase tracking-widest">Seu Comentário (Opcional)</label>
                    </div>
                    <textarea 
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Conte-nos o que achou das delícias..."
                      className="w-full bg-primary-dark border-2 border-coffee rounded-2xl p-4 text-white outline-none focus:border-accent transition-colors resize-none h-32"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full gold-gradient py-4 rounded-2xl text-primary-dark font-black shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-6 h-6 border-3 border-primary-dark border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Send size={20} />
                        ENVIAR AVALIAÇÃO
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
