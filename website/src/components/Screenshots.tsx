import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

import mainInterfaceImg from '../assets/screenshots/main-interface.png';
import downloadSectionImg from '../assets/screenshots/download-section.png';
import editingToolsImg from '../assets/screenshots/editing-tools.png';
import fileManagerImg from '../assets/screenshots/file-manager.png';

const screens = [
  { id: 'main', label: 'Interface', title: 'Main Interface', image: mainInterfaceImg },
  { id: 'download', label: 'Downloads', title: 'Download Queue', image: downloadSectionImg },
  { id: 'editor', label: 'Editor', title: 'Video Editor', image: editingToolsImg },
  { id: 'files', label: 'Files', title: 'File Manager', image: fileManagerImg },
];

const Screenshots = () => {
  const [active, setActive] = useState(0);

  return (
    <section id="screenshots" className="py-28 lg:py-40 px-6 lg:px-10 bg-surface/40">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          className="mb-16 lg:mb-24"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-accent" />
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent">
              Preview
            </span>
          </div>
          <h2 className="font-serif text-5xl sm:text-6xl lg:text-7xl tracking-[-0.02em] text-chalk leading-[0.95]">
            See it
            <span className="italic text-sand"> in action.</span>
          </h2>
        </motion.div>

        {/* Tab bar */}
        <motion.div
          className="flex flex-wrap gap-2 mb-10"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {screens.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`font-mono text-[11px] tracking-[0.15em] uppercase px-5 py-2.5 border transition-all duration-300 ${
                active === i
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-ash hover:text-cream hover:border-border-light'
              }`}
            >
              {s.label}
            </button>
          ))}
        </motion.div>

        {/* Screenshot display */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="relative overflow-hidden border border-border bg-bg">
            <AnimatePresence mode="wait">
              <motion.img
                key={active}
                src={screens[active].image}
                alt={screens[active].title}
                className="w-full"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </AnimatePresence>

            {/* Overlay label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bg/90 via-bg/40 to-transparent px-6 py-6 flex items-end justify-between">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`title-${active}`}
                  className="font-serif text-2xl text-chalk"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  {screens[active].title}
                </motion.span>
              </AnimatePresence>
              <span className="font-mono text-[11px] text-ash tracking-widest">
                {String(active + 1).padStart(2, '0')} / {String(screens.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Thumbnail strip */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {screens.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`relative overflow-hidden border transition-all duration-300 ${
                active === i
                  ? 'border-accent opacity-100'
                  : 'border-border opacity-40 hover:opacity-70'
              }`}
            >
              <img src={s.image} alt={s.label} className="w-full aspect-video object-cover" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Screenshots;
