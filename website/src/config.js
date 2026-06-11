// src/config.js
export default {
  site: {
    title: 'EmscapeForge',
    description: 'Professional web development, technical writing, and editorial services.',
    url: 'https://emscapeforge.com',
    author: 'Emily'
  },
  navigation: [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Portfolio', path: '/portfolio' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' }
  ],
  social: {
    github: 'https://github.com/emscape',
    linkedin: '#',
    bluesky: '#'
  },
  contact: {
    web3formsKey: '4c46c461-bd09-40ff-b5be-003327cd374e'
  },
  features: {
    darkMode: true,
    animations: true,
    ads: {
      enabled: false,
      provider: 'none'
    }
  }
}