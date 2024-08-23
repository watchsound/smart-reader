import { createTheme } from '@mui/material/styles';

// Create a theme instance.
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#242424',
    },
    text: {
      primary: '#ffffff',
      secondary: '#aaaaaa',
    },
    white: {
      primary: '#FFFFFF',
      secondary: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.0rem',
      fontWeight: 500,
      color: '#ffffff',
    },
    title: {
      fontSize: '0.9rem',
      fontWeight: 300,
      color: '#ffffff',
    },
    subtitle: {
      fontSize: '0.7rem',
      fontWeight: 250,
      color: '#ffffff',
    },
    content: {
      fontSize: '0.8rem',
      fontWeight: 280,
      color: '#ffffff',
    },
  },
  // You can also customize other aspects like shape, components, etc.
  components: {
    // Example of customizing a Button globally
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 500,
          textTransform: 'none',
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

export default darkTheme;
