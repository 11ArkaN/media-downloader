import { motion } from 'framer-motion';

const items = [
  'YouTube', 'Vimeo', 'TikTok', 'Twitter', 'Instagram', 'Reddit',
  'SoundCloud', 'Twitch', 'Dailymotion', 'Bandcamp', 'Facebook',
  '500+ Sites Supported',
];

const Marquee = () => {
  const doubled = [...items, ...items];

  return (
    <motion.div
      className="py-6 border-y border-border overflow-hidden bg-surface/50 mt-20 lg:mt-28"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="animate-marquee flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center mx-8">
            <span className="w-1.5 h-1.5 bg-accent rounded-full mr-8 flex-shrink-0" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-ash">
              {item}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
};

export default Marquee;
