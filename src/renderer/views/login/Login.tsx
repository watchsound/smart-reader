import { AutoStories } from '@mui/icons-material';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Snackbar,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/userAuthApi';
import { loginHandled } from '../../store/reducers/userSlice';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const handleLogin = async () => {
    // Guard against re-entry: Button is `disabled={loading}` but the
    // Enter-key handler bypasses it, so two rapid Enter presses during
    // the ~100 ms scrypt round-trip would fire two login() calls.
    if (loading) return;
    if (!email || !password) {
      showMessage('Please provide email and password.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const userInfo = await login(email, password);
      if (userInfo && userInfo.token) {
        dispatch(loginHandled(userInfo));
        showMessage('Login successful!', 'success');
        navigate('/bookshelf');
      } else {
        showMessage('Login failed. Please check your credentials.', 'error');
      }
    } catch (error) {
      showMessage('Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 3, sm: 4 },
        background: '#fff',
      }}
    >
          {/* Logo Section */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 70,
                height: 70,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #5c6bc0 0%, #7e57c2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 8px 25px rgba(92, 107, 192, 0.3)',
              }}
            >
              <AutoStories sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: '#2d3748', letterSpacing: '-0.5px' }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ color: '#718096', mt: 1 }}>
              Sign in to continue to SmartReader
            </Typography>
          </Box>

          {/* Form Section */}
          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: '#a0aec0' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  '&:hover fieldset': {
                    borderColor: '#5c6bc0',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#5c6bc0',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#5c6bc0',
                },
              }}
            />

            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#a0aec0' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: '#a0aec0' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  '&:hover fieldset': {
                    borderColor: '#5c6bc0',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#5c6bc0',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#5c6bc0',
                },
              }}
            />

            <Button
              fullWidth
              variant="contained"
              onClick={handleLogin}
              disabled={loading}
              sx={{
                py: 1.5,
                borderRadius: '12px',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #5c6bc0 0%, #7e57c2 100%)',
                boxShadow: '0 4px 15px rgba(92, 107, 192, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5c6bc0 0%, #7e57c2 100%)',
                  boxShadow: '0 6px 20px rgba(92, 107, 192, 0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: '#e2e8f0',
                  color: '#a0aec0',
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" sx={{ color: '#718096' }}>
                Don&apos;t have an account?{' '}
                <Button
                  onClick={() => navigate('/register')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#5c6bc0',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      background: 'transparent',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Register
                </Button>
              </Typography>
            </Box>
          </Box>

      {/* Footer */}
      <Typography
        variant="body2"
        sx={{ textAlign: 'center', mt: 2, color: '#a0aec0' }}
      >
        SmartReader - AI-Powered Learning
      </Typography>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{
            width: '100%',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Login;
