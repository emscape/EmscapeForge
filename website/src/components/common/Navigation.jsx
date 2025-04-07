// src/components/common/Navigation.jsx
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import config from '../../config';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Shrink nav on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <nav className={`site-nav ${isScrolled ? 'scrolled' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="nav-container">
        <a href="/" className="logo">
          <span className="logo-text">EmscapeForge</span>
        </a>
        
        <button 
          className="mobile-menu-toggle" 
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
        
        <div className="nav-links">
          {config.navigation.map((item) => (
            <a 
              key={item.path} 
              href={item.path}
              className="nav-link"
            >
              {item.name}
            </a>
          ))}
        </div>
        
        <ThemeToggle />
      </div>
    </nav>
  );
};

export default Navigation;