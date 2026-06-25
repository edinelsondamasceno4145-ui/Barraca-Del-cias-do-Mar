import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function Logo({ className = "", size = "md" }: LogoProps) {
  const sizes = {
    sm: "scale-50",
    md: "scale-100",
    lg: "scale-150"
  };

  return (
    <div className={`flex flex-col items-center justify-center bg-[#2B1A10] p-4 rounded-xl border border-[#E6B15C]/20 shadow-2xl ${className} ${sizes[size]}`}>
      <span className="text-[#E6B15C] text-[10px] sm:text-[12px] font-black tracking-[0.3em] uppercase mb-[-4px]">
        BARRACA
      </span>
      
      <span className="font-script text-[#E6B15C] text-2xl sm:text-3xl leading-none my-1 transform -rotate-2">
        Delícias do Mar
      </span>
      
      <div className="relative w-16 h-8 my-1 flex items-center justify-center">
        {/* Stylized Fish */}
        <svg 
          viewBox="0 0 100 40" 
          className="w-full h-full fill-[#E6B15C]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10,20 C20,5 50,5 80,20 C90,25 95,30 95,30 L85,25 C75,20 50,20 20,30 L10,20 Z" />
          <circle cx="25" cy="18" r="2" fill="#2B1A10" />
          {/* Waves */}
          <path d="M15,32 Q30,28 45,32 T75,32" fill="none" stroke="#E6B15C" strokeWidth="2" strokeLinecap="round" />
          <path d="M20,36 Q35,32 50,36 T80,36" fill="none" stroke="#E6B15C" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
      
      <span className="text-[#E6B15C] text-[10px] sm:text-[12px] font-black tracking-[0.4em] uppercase mt-[-2px]">
        DO MAR
      </span>
    </div>
  );
}
