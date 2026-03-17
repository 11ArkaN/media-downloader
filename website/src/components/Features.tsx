import { motion } from 'framer-motion';
import { Download, Scissors, FolderOpen, Settings, Layers, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

const features: Feature[] = [
  {
    icon: Download,
    label: '01',
    title: 'Grab from anywhere',
    body: '500+ sites. Paste a URL, pick a format, hit go. YouTube, TikTok, Vimeo, SoundCloud — it just works.',
  },
  {
    icon: Scissors,
    label: '02',
    title: 'Edit on device',
    body: 'Trim, crop, apply filters, adjust audio. A full timeline editor baked in — no separate software needed.',
  },
  {
    icon: FolderOpen,
    label: '03',
    title: 'Browse your library',
    body: 'Grid view, list view, search, instant preview. Your media stays organized and accessible.',
  },
  {
    icon: Settings,
    label: '04',
    title: 'Quality you control',
    body: '4K, 1080p, 720p, audio-only. Custom presets. You decide what lands on your drive.',
  },
  {
    icon: Layers,
    label: '05',
    title: 'Batch everything',
    body: 'Queue up dozens of downloads. Track each one independently. Process while you sleep.',
  },
  {
    icon: Shield,
    label: '06',
    title: 'Privacy by default',
    body: 'Fully offline processing. Zero telemetry. No cloud. No accounts. Everything stays on your machine.',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-28 lg:py-40 px-6 lg:px-10">
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
              Capabilities
            </span>
          </div>
          <h2 className="font-serif text-5xl sm:text-6xl lg:text-7xl tracking-[-0.02em] text-chalk leading-[0.95]">
            Everything you need,
            <br />
            <span className="italic text-sand">nothing you don't.</span>
          </h2>
        </motion.div>

        {/* Feature rows — editorial list style */}
        <div className="space-y-0">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={i}
                className="group border-t border-border py-10 lg:py-14"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
                  {/* Number */}
                  <div className="lg:col-span-1">
                    <span className="font-mono text-[11px] tracking-widest text-ash group-hover:text-accent transition-colors duration-500">
                      {feat.label}
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="lg:col-span-4 flex items-start gap-4">
                    <Icon className="w-5 h-5 text-accent mt-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                    <h3 className="font-serif text-2xl lg:text-3xl text-chalk tracking-[-0.01em] group-hover:text-accent transition-colors duration-500">
                      {feat.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <div className="lg:col-span-5 lg:col-start-7">
                    <p className="text-ash text-[15px] leading-relaxed font-light max-w-md group-hover:text-sand transition-colors duration-500">
                      {feat.body}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="lg:col-span-1 lg:col-start-12 hidden lg:flex justify-end items-start pt-2">
                    <div className="w-6 h-px bg-border group-hover:bg-accent group-hover:w-10 transition-all duration-500" />
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div className="border-t border-border" />
        </div>
      </div>
    </section>
  );
};

export default Features;
