import React from 'react';
import ChristmasScene from './components/ChristmasScene';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
        <ChristmasScene />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-center items-center md:items-start md:pl-24 pb-20 md:pb-0">
        <div className="text-center md:text-left animate-fade-in-up transition-opacity duration-1000">
          <h1 className="font-playfair text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-red-200 to-pink-200 drop-shadow-[0_0_15px_rgba(255,0,85,0.8)] italic">
            Merry Christmas
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-pink-100/80 tracking-[0.3em] font-light font-playfair uppercase drop-shadow-md">
            To July
          </p>
          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-pink-400 to-transparent mt-8 mx-auto md:mx-0 opacity-70"></div>
        </div>
      </div>
    </div>
  );
};

export default App;