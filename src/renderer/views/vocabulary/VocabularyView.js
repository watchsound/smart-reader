import React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
// import { v4 as uuid } from 'uuid';
import { useSelector } from 'react-redux';

import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';

import LeitnerSystem from '../../components/LeitnerSystem/LeitnerSystem';
import VocabularyListView from './VocabularyListView';

const MyTabPanel = styled(TabPanel)({
  padding: '1px 1px',
  margin: '1px 1px',
});

function VocabularyView() {
  const [tabValue, setTabValue] = React.useState('1');
  const addVocabulary = useSelector((state) => state.vocabulary.addVocabulary);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const mainPanel = (
    <LeitnerSystem addVocabulary={addVocabulary} isVocabulary />
  );

  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleTabChange}>
            <Tab label="Words For Review" value="1" sx={{ fontSize: '11px' }} />
            <Tab label="Words In Query" value="2" sx={{ fontSize: '11px' }} />
          </TabList>
        </Box>
        <MyTabPanel value="1">
          <VocabularyListView isReviewDue />
        </MyTabPanel>
        <MyTabPanel value="2">
          <VocabularyListView isReviewDue={false} />
        </MyTabPanel>
      </TabContext>
    </Box>
  );

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="240"
    />
  );
}
export default VocabularyView;
