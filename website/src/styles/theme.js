// src/styles/theme.js
export default {
  colors: {
    primary: {
      light: '#00B5AD', // Teal
      dark: '#008B8B'    // Dark Teal
    },
    secondary: {
      light: '#40E0D0', // Aqua
      dark: '#20B2AA'    // Dark Aqua
    },
    accent: {
      light: '#FF8C00', // Orange
      dark: '#FF7F50'    // Dark Orange
    },
    background: {
      light: '#FFFFFF',
      dark: '#121212'
    },
    text: {
      light: '#333333',
      dark: '#F5F5F5'
    }
  },
  fonts: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Montserrat, Georgia, serif'
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '16px'
  },
  shadows: {
    small: '0 2px 4px rgba(0,0,0,0.1)',
    medium: '0 4px 8px rgba(0,0,0,0.1)',
    large: '0 8px 16px rgba(0,0,0,0.1)'
  },
  transitions: {
    default: '0.3s ease',
    slow: '0.5s ease',
    fast: '0.15s ease'
  }
}