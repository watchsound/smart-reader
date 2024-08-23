import React from 'react';
import { Toaster } from 'react-hot-toast';
import Typography from '@mui/material/Typography';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import ProTip from '../ProTip';
import Copyright from '../Copyright';
import BookListInServer from './BookListInServer';

export default function HomePage() {
  return (
    <Container maxWidth="lg">
      <Toaster />
      <Box my={4}>
        <BookListInServer />
        <ProTip />
        <Copyright />
      </Box>
    </Container>
  );
}
