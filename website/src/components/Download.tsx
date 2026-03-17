import { motion } from 'framer-motion';
import { Download as DownloadIcon, ArrowUpRight } from 'lucide-react';
import { FaWindows, FaApple, FaLinux } from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface Platform {
  name: string;
  icon: IconType;
  version: string;
  format: string;
  size: string;
  url: string;
  comingSoon: boolean;
}

const platforms: Platform[] = [
  { name: 'Windows', icon: FaWindows, version: '10+', format: '.msi', size: '~85 MB', url: '#', comingSoon: false },
  { name: 'macOS', icon: FaApple, version: '10.15+', format: '.dmg', size: '~92 MB', url: '#', comingSoon: true },
  { name: 'Linux', icon: FaLinux, version: 'Ubuntu 20.04+', format: '.deb', size: '~88 MB', url: '#', comingSoon: true },
];

const Download = () => {
  return (
    <section id="download" className="py-28 lg:py-40 px-6 lg:px-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          className="mb-20 lg:mb-28"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-px bg-accent" />
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent">
              Get Started
            </span>
          </div>
          <h2 className="font-serif text-5xl sm:text-6xl lg:text-7xl tracking-[-0.02em] text-chalk leading-[0.95]">
            Ready when
            <br />
            <span className="italic text-sand">you are.</span>
          </h2>
        </motion.div>

        {/* Version badge */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent border border-accent/30 px-4 py-2 inline-block">
            v0.1.0 — Early Access
          </span>
        </motion.div>

        {/* Platform cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {platforms.map((p, i) => {
            const Icon = p.icon;
            const Card = p.comingSoon ? motion.div : motion.a;
            return (
              <Card
                key={p.name}
                {...(!p.comingSoon && { href: p.url })}
                className={`group relative border border-border bg-surface ${p.comingSoon ? '' : 'hover:border-accent/40'} transition-all duration-500 p-8 lg:p-10 flex flex-col justify-between min-h-[280px] ${p.comingSoon ? 'opacity-60' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                {...(!p.comingSoon && { whileHover: { y: -4 } })}
              >
                {/* Coming Soon badge */}
                {p.comingSoon && (
                  <span className="absolute top-4 right-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ash border border-border px-3 py-1">
                    Coming Soon
                  </span>
                )}

                {/* Top */}
                <div>
                  <Icon className={`w-8 h-8 text-cream mb-6 ${p.comingSoon ? '' : 'group-hover:text-accent'} transition-colors duration-500`} />
                  <h3 className="font-serif text-3xl text-chalk mb-2">
                    {p.name}
                  </h3>
                  <p className="font-mono text-[11px] tracking-widest text-ash uppercase">
                    {p.version}
                  </p>
                </div>

                {/* Bottom */}
                <div className="flex items-end justify-between mt-8">
                  <div>
                    <span className="font-mono text-[10px] text-ash tracking-wider block">{p.format}</span>
                    <span className="font-mono text-[10px] text-ash tracking-wider block">{p.size}</span>
                  </div>
                  {!p.comingSoon && (
                    <div className="flex items-center gap-2 text-accent opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                      <DownloadIcon className="w-4 h-4" />
                      <span className="font-mono text-[11px] tracking-wider uppercase">Download</span>
                    </div>
                  )}
                </div>

                {/* Corner accent */}
                {!p.comingSoon && (
                  <div className="absolute top-0 right-0 w-0 h-0 group-hover:w-8 group-hover:h-8 bg-accent transition-all duration-500" />
                )}
              </Card>
            );
          })}
        </div>

        {/* GitHub link */}
        <motion.div
          className="mt-16 flex justify-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href="https://github.com/11ArkaN/media-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] uppercase text-ash hover:text-accent transition-colors duration-300"
          >
            View source on GitHub
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
          </a>
        </motion.div>

        {/* Requirements */}
        <motion.div
          className="mt-24 border-t border-border pt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h4 className="font-mono text-[11px] tracking-[0.3em] uppercase text-ash mb-10">
            System Requirements
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { label: 'OS', value: 'Windows 10+ (macOS & Linux coming soon)' },
              { label: 'Memory', value: '4 GB RAM minimum' },
              { label: 'Storage', value: '500 MB free space' },
              { label: 'Dependencies', value: 'FFmpeg & yt-dlp (auto-installed)' },
            ].map((req) => (
              <div key={req.label}>
                <span className="font-mono text-[11px] tracking-widest uppercase text-accent block mb-2">
                  {req.label}
                </span>
                <p className="text-ash text-sm font-light leading-relaxed">
                  {req.value}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Download;
