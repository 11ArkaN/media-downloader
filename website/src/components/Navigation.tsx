import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: 'features' },
  { label: 'Preview', href: 'screenshots' },
  { label: 'Download', href: 'download' },
];

const Navigation = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-bg/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <button
            onClick={() => scrollTo('hero')}
            className="flex items-center gap-3 group"
          >
            <div className="w-2 h-2 bg-accent rounded-full group-hover:scale-150 transition-transform duration-300" />
            <span className="font-mono text-sm font-medium tracking-wider text-cream uppercase">
              MDL
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="font-mono text-[11px] tracking-[0.2em] uppercase text-ash hover:text-cream transition-colors duration-300"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo('download')}
              className="font-mono text-[11px] tracking-[0.2em] uppercase bg-accent text-bg px-5 py-2.5 hover:bg-[#ff6a2e] transition-colors duration-300"
            >
              Get App
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-ash hover:text-cream transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden bg-surface border-t border-border"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 py-8 flex flex-col gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="font-mono text-sm tracking-widest uppercase text-ash hover:text-cream transition-colors text-left"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => scrollTo('download')}
                className="font-mono text-sm tracking-widest uppercase bg-accent text-bg py-3 text-center hover:bg-[#ff6a2e] transition-colors mt-2"
              >
                Get App
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navigation;
