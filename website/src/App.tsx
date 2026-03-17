import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import Features from './components/Features';
import Screenshots from './components/Screenshots';
import Download from './components/Download';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-bg text-cream overflow-x-hidden grain">
      <Navigation />
      <Hero />
      <Marquee />
      <Features />
      <Screenshots />
      <Download />
      <Footer />
    </div>
  );
}

export default App;
