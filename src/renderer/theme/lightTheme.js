import { createTheme } from '@mui/material/styles';

// Create a theme instance.
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#0d0d0d',
      secondary: '#555555',
    },
    white: {
      primary: '#FFFFFF',
      secondary: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.2rem',
      fontWeight: 500,
      letterSpacing: '-0.24px',
      color: '#0d0d0d',
    },
    title: {
      fontSize: '0.9rem',
      fontWeight: 300,
      color: '#0d0d0d',
    },
    subtitle: {
      fontSize: '0.7rem',
      fontWeight: 250,
      color: '#0d0d0d',
    },
    content: {
      fontSize: '0.8rem',
      fontWeight: 280,
      color: '#0d0d0d',
    },
  },
  components: {
    // Example of customizing a Button globally
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 500,
          textTransform: 'none',
          // Additional customizations can go here
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        *::-webkit-scrollbar {
          width: 12px;               // Controls the width of the vertical scrollbar
          height: 12px;              // Controls the height of the horizontal scrollbar
        }
        *::-webkit-scrollbar-track {
          background: #d9d9d9;       // Color of the track (part the actual scrollbar slides within)
        }
        *::-webkit-scrollbar-thumb {
          background-color: darkgrey;    // Color of the scrollbar itself
          border-radius: 20px;       // Roundness of the scrollbar
          border: 3px solid #d9d9d9; // Creates a border around the scrollbar (optional)
        }
      `,
    },
  },
});

export default lightTheme;
