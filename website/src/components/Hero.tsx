import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import mainInterfaceImg from '../assets/screenshots/main-interface.png';

const Hero = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="hero" className="relative min-h-screen flex flex-col justify-center px-6 lg:px-10 pt-20">
      <div className="max-w-[1400px] mx-auto w-full">
        {/* Eyebrow */}
        <motion.div
          className="mb-10 flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="w-12 h-px bg-accent" />
          <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent">
            Free &amp; Open Source
          </span>
        </motion.div>

        {/* Main heading — editorial serif */}
        <div className="relative mb-12">
          <motion.h1
            className="font-serif text-[clamp(3.5rem,10vw,10rem)] leading-[0.88] tracking-[-0.03em] text-chalk"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            Download.
            <br />
            <span className="italic text-accent">Edit.</span>
            <br />
            Own&nbsp;it.
          </motion.h1>

          {/* Floating accent block */}
          <motion.div
            className="hidden lg:block absolute -right-4 top-8 w-32 h-32 border border-accent/20"
            initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-3 bg-accent/5" />
            <div className="absolute -bottom-px -right-px w-4 h-4 bg-accent" />
          </motion.div>
        </div>

        {/* Subtext + CTA row */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-20">
          <motion.p
            className="text-sand text-lg lg:text-xl max-w-md leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            A desktop app that grabs media from 500+ sites and lets you edit it — all powered by yt-dlp and FFmpeg. No cloud. No fees. Just yours.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <motion.button
              onClick={() => scrollTo('download')}
              className="bg-accent text-bg font-sans font-semibold px-8 py-4 text-sm tracking-wide hover:bg-[#ff6a2e] transition-colors duration-300"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Download Free
            </motion.button>
            <motion.button
              onClick={() => scrollTo('features')}
              className="border border-border-light text-sand hover:text-cream hover:border-cream/40 px-8 py-4 text-sm tracking-wide transition-all duration-300 flex items-center gap-3"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Explore
              <ArrowDown className="w-3.5 h-3.5" />
            </motion.button>
          </motion.div>
        </div>

        {/* Hero image — full-bleed with tilt */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative overflow-hidden border border-border bg-surface">
            <img
              src={mainInterfaceImg}
              alt="Media Downloader interface"
              className="w-full"
            />
            {/* Top-left label */}
            <div className="absolute top-0 left-0 bg-accent text-bg font-mono text-[10px] tracking-widest uppercase px-4 py-2">
              Preview
            </div>
            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-bg/30" />
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.6 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown className="w-4 h-4 text-ash" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
