import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalRoot(document.querySelector('#portal-root'));
    return () => setMounted(false);
  }, []);

  if (!mounted || !portalRoot) {
    return null;
  }

  return createPortal(children, portalRoot);
};

export default Portal;
