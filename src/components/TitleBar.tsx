import { getCurrentWindow } from '@tauri-apps/api/window';
import { VscChromeMinimize, VscChromeMaximize, VscChromeClose } from 'react-icons/vsc';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TitleBar = () => {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const minimizeWindow = () => appWindow.minimize();
  const maximizeWindow = () => appWindow.toggleMaximize();
  const closeWindow = () => appWindow.close();

  return (
    <div data-tauri-drag-region className="glass-effect fixed top-0 left-0 right-0 h-10 flex justify-between items-center select-none z-[100] px-2 border-b border-white/10">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gradient-to-r from-lilac-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Download className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-sm font-semibold text-white">{t('app.title')}</h1>
      </div>
      <div className="flex items-center space-x-1">
        <button 
          onClick={minimizeWindow} 
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-white/10 hover:backdrop-blur-sm border border-transparent hover:border-white/20"
        >
          <VscChromeMinimize className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-200" />
        </button>
        <button 
          onClick={maximizeWindow} 
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-white/10 hover:backdrop-blur-sm border border-transparent hover:border-white/20"
        >
          <VscChromeMaximize className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-200" />
        </button>
        <button 
          onClick={closeWindow} 
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-red-500/20 hover:backdrop-blur-sm border border-transparent hover:border-red-400/30"
        >
          <VscChromeClose className="w-4 h-4 text-gray-400 group-hover:text-red-300 transition-colors duration-200" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar; 