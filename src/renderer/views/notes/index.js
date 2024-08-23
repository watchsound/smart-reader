/* eslint-disable prettier/prettier */
import React from 'react'
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { styled } from '@mui/material/styles';

import NotesUI from './NotesUI';
import NotesLeitnerUI from './NotesLeitnerUI';

const MyTabPanel = styled(TabPanel)({
  padding: '1px 1px',
  margin: '1px 1px',
});


function NotePage() {
  const [tabValue, setTabValue] = React.useState('1');
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
   <Box sx={{ width: '100%' }}>
      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleTabChange}>
            <Tab label="Notes" value="1" sx={{ fontSize: '11px' }} />
            <Tab label="Leitner System" value="2" sx={{ fontSize: '11px' }} />
          </TabList>
        </Box>
        <MyTabPanel value="1">
          <NotesUI />
        </MyTabPanel>
        <MyTabPanel value="2">
          <NotesLeitnerUI />
        </MyTabPanel>
      </TabContext>
    </Box>
  );
}
export default NotePage;
