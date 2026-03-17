import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="px-6 lg:px-10 pt-20 pb-10 border-t border-border">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Top row — big serif text + back to top */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 mb-20">
            <h3 className="font-serif text-4xl lg:text-6xl text-chalk leading-[0.95] tracking-[-0.02em] max-w-lg">
              Your media,
              <br />
              <span className="italic text-sand">your rules.</span>
            </h3>
            <button
              onClick={scrollToTop}
              className="font-mono text-[11px] tracking-[0.2em] uppercase text-ash hover:text-accent transition-colors duration-300 flex items-center gap-2 self-start lg:self-auto"
            >
              Back to top
              <ArrowUpRight className="w-3.5 h-3.5 rotate-[-90deg]" />
            </button>
          </div>

          {/* Bottom row — brand + links */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pt-10 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent rounded-full" />
              <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash">
                © 2025 Media Downloader
              </span>
            </div>

            <div className="flex items-center gap-8">
              {[
                { label: 'GitHub', href: 'https://github.com/11ArkaN/media-downloader' },
                { label: 'Docs', href: '#' },
                { label: 'Contact', href: 'mailto:support@example.com' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="font-mono text-[11px] tracking-[0.15em] uppercase text-ash hover:text-cream transition-colors duration-300"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
