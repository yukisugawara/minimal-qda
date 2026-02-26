import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DockLayout } from './components/DockLayout';
import { MapModal } from './components/MapModal';
import { MethodologyGuide } from './components/MethodologyGuide';
import { UsageGuide } from './components/UsageGuide';
import { SplashScreen } from './components/SplashScreen';
import { useAppStore } from './store/useAppStore';
import type { LayoutNode } from './utils/layoutTree';
import { DEFAULT_LAYOUT } from './utils/layoutTree';
import { initAutoSaveFromStorage } from './utils/autoSave';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const theme = useAppStore((s) => s.theme);

  const [layout, setLayout] = useState<LayoutNode>(structuredClone(DEFAULT_LAYOUT));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    initAutoSaveFromStorage();
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(structuredClone(DEFAULT_LAYOUT));
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-cream-50 dark:bg-dpurple-950 animate-fade-in">
      <Header onOpenMap={() => setShowMap(true)} onResetLayout={resetLayout} />
      <div className="flex-1 overflow-hidden">
        <DockLayout layout={layout} onLayoutChange={setLayout} />
      </div>
      {showMap && <MapModal onClose={() => setShowMap(false)} />}
      <MethodologyGuide />
      <UsageGuide />
    </div>
  );
}

export default App;
