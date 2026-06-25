import { MapPin } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-primary-dark border-t border-coffee pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Info Area */}
        <div className="space-y-8 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <Logo className="h-16 w-16 border-2 border-accent" size="md" />
            <div>
              <h3 className="gold-text font-black text-2xl uppercase tracking-tighter leading-none">Delícias do Mar</h3>
              <p className="text-[10px] text-accent-light opacity-60 uppercase font-black tracking-[0.4em] mt-1">Barraca & Restaurante</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start justify-center md:justify-start gap-3 text-accent-light group cursor-default">
              <MapPin className="text-accent shrink-0 group-hover:scale-110 transition-transform" size={20} />
              <p className="text-sm font-medium opacity-80 leading-relaxed">
                R. João Pessoa, 0<br/>
                Maçarico, Salinópolis - PA<br/>
                CEP: 68721-000
              </p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] font-bold text-accent uppercase tracking-widest pt-2">
              <span className="bg-secondary/50 px-3 py-1 rounded-full border border-coffee/30">✓ Cartões</span>
              <span className="bg-secondary/50 px-3 py-1 rounded-full border border-coffee/30">✓ Pix</span>
              <span className="bg-secondary/50 px-3 py-1 rounded-full border border-coffee/30">✓ Taxa de mesa</span>
            </div>
          </div>
        </div>

        {/* Maps Section */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <div className="h-[1px] w-8 bg-accent/30 hidden md:block"></div>
            <h4 className="text-xs font-black gold-text uppercase tracking-[0.3em]">Onde nos encontrar</h4>
          </div>
          
          <div className="w-full h-64 md:h-80 rounded-3xl overflow-hidden border border-coffee shadow-2xl relative group">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1500.47352329754!2d-47.3740557!3d-0.6042073!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92af82fbc19c9693%3A0x8690969696969696!2sBarraca%20Del%C3%ADcias%20do%20Mar!5e0!3m2!1spt-BR!2sbr!4v1713654545000!5m2!1spt-BR!2sbr" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              className="grayscale-[0.2] contrast-[1.1] hover:grayscale-0 transition-all duration-700"
            ></iframe>
            <div className="absolute inset-0 pointer-events-none border-[12px] border-primary-dark opacity-20 group-hover:opacity-0 transition-opacity"></div>
          </div>
          <p className="text-[10px] text-accent-light opacity-40 text-center md:text-right italic">
            * Toque no mapa para navegar com o Google Maps
          </p>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-coffee/20 text-center px-6">
        <p className="text-[9px] text-coffee font-bold tracking-[0.3em] uppercase opacity-60">
          Barraca Delícias do Mar • Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
