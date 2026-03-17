import { createTheme } from '@mui/material/styles';

// Dark Theme - Slack-style dark mode
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e8e8e8',      // Light text for dark mode
      light: '#ffffff',
      dark: '#d1d1d1',
      contrastText: '#1a1d21',
    },
    secondary: {
      main: '#1d9bd1',      // Slack blue (brighter for dark)
      light: '#4eb3de',
      dark: '#1264a3',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a1d21',   // Slack dark mode background
      paper: '#222529',     // Slightly lighter for cards
    },
    text: {
      primary: '#d1d2d3',   // Slack dark mode text
      secondary: '#ababad', // Slack dark mode secondary
    },
    divider: '#3d4043',
    error: {
      main: '#f5487f',      // Brighter red for dark mode
      light: '#f87198',
      dark: '#e01e5a',
    },
    warning: {
      main: '#f3c655',      // Brighter yellow for dark mode
      light: '#f7d67a',
      dark: '#ecb22e',
    },
    info: {
      main: '#1d9bd1',      // Slack blue
      light: '#4eb3de',
      dark: '#1264a3',
    },
    success: {
      main: '#4ec99a',      // Brighter green for dark mode
      light: '#74d4af',
      dark: '#2eb67d',
    },
    white: {
      primary: '#ffffff',
      secondary: '#f8f8f8',
    },
  },
  typography: {
    fontFamily: 'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2.0rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#d1d2d3',
    },
    title: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#d1d2d3',
    },
    subtitle: {
      fontSize: '0.75rem',
      fontWeight: 400,
      color: '#ababad',
    },
    content: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: '#d1d2d3',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 4,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.4)',
          backgroundImage: 'none',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.15);
          border-radius: 4px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255,255,255,0.25);
        }
      `,
    },
  },
});

export default darkTheme;
