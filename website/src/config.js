// src/config.js
export default {
  site: {
    title: 'EmscapeForge',
    description: 'Emily\'s personal website showcasing projects, blog posts, and professional information',
    url: 'https://emscapeforge.com',
    author: 'Emily'
  },
  navigation: [
    { name: 'Home', path: '/' },
    { name: 'Projects', path: '/projects' },
    { name: 'Blog', path: '/blog' },
    { name: 'Presentations', path: '/presentations' },
    { name: 'About', path: '/about' }
  ],
  social: {
    github: 'https://github.com/emscape',
    linkedin: '#',
    twitter: '#',
    bluesky: '#'
  },
  features: {
    darkMode: true,
    animations: true,
    ads: {
      enabled: false,
      provider: 'none'
    }
  },
  github: {
    username: 'emscape',
    repoCount: 10,
    sortBy: 'updated'
  }
}