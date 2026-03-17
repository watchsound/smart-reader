import { createTheme } from '@mui/material/styles';

// Light Theme - Slack-style with warm accents
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#611f69',      // Slack aubergine/purple
      light: '#7c3085',
      dark: '#4a154b',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1264a3',      // Slack blue
      light: '#1d9bd1',
      dark: '#0b4f82',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8f8f8',   // Light warm gray
      paper: '#ffffff',
    },
    text: {
      primary: '#1d1c1d',   // Slack dark text
      secondary: '#616061', // Slack secondary text
    },
    divider: '#e8e8e8',
    error: {
      main: '#e01e5a',      // Slack red/pink
      light: '#f5487f',
      dark: '#b01848',
    },
    warning: {
      main: '#ecb22e',      // Slack yellow
      light: '#f3c655',
      dark: '#cc9a1d',
    },
    info: {
      main: '#1264a3',      // Slack blue
      light: '#1d9bd1',
      dark: '#0b4f82',
    },
    success: {
      main: '#2eb67d',      // Slack green
      light: '#4ec99a',
      dark: '#238c61',
    },
    white: {
      primary: '#ffffff',
      secondary: '#f8f8f8',
    },
  },
  typography: {
    fontFamily: 'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2.2rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#1d1c1d',
    },
    title: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#1d1c1d',
    },
    subtitle: {
      fontSize: '0.75rem',
      fontWeight: 400,
      color: '#616061',
    },
    content: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: '#1d1c1d',
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
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 0 0 1px rgba(29,28,29,0.13), 0 4px 12px rgba(0,0,0,0.12)',
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
          background-color: rgba(29,28,29,0.25);
          border-radius: 4px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background-color: rgba(29,28,29,0.4);
        }
      `,
    },
  },
});

export default lightTheme;
