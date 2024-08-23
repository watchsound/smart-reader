import React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
// import { v4 as uuid } from 'uuid';
import { useSelector, useDispatch } from 'react-redux';

import { createMoodBoard } from '../../api/moodBoardApi';
import TextSearchRow from '../../components/TextSearchRow';

// import DetailedMoodBoardPanel from '../../components/MoodBoard/gridLayout/DetailedMoodBoardPanel';
import MoodBoardList from '../../components/MoodBoard/gridLayout/MoodBoardList';
import DetailedDiagramPanel from '../../components/MoodBoard/diagram/DetailedDiagramPanel';
import CustomizedFilterBase from '../../components/CustomizedFilterBase';
import {
  noteAdded,
  moodBoardAdded,
  moodBoardHandled,
  moodBoardQueried,
} from '../../store/reducers/moodBoardSlice';

import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import NotesListPanelInMoodBoard from './NotesListPanelInMoodBoard';
import CreateNoteCell from '../notes/CreateNoteCell';

const MyTabPanel = styled(TabPanel)({
  padding: '1px 1px',
  margin: '1px 1px',
});

function MoodBoardView({ moodBoard }) {
  const [tabValue, setTabValue] = React.useState('1');
  // const [tabMainValue, setTabMainValue] = React.useState('1');

  const [curMoodBoard, setCurMoodBoard] = React.useState(moodBoard);

  const [moodBoardSearch, setMoodBoardSearch] = React.useState('');
  const [noteQueryStr, setNoteQueryStr] = React.useState('');

  const aMoodBoard = useSelector((state) => state.moodBoard.curMoodBoard);

  const dispatch = useDispatch();
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  React.useEffect(() => {
    if (!moodBoard) return;
    setCurMoodBoard(moodBoard);
  }, [moodBoard]);

  React.useEffect(() => {
    if (!aMoodBoard) return;
    setCurMoodBoard(aMoodBoard);
  }, [aMoodBoard]);

  const noteSelected = (note) => {
    dispatch(noteAdded(null)); // FIXME -- want same selection pass through
    dispatch(noteAdded(note));
  };

  const mainPanel = curMoodBoard ? (
    <DetailedDiagramPanel curMoodBoard={curMoodBoard} />
  ) : (
    <div>.</div>
  );

  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleTabChange}>
            <Tab label="Mood Board" value="1" sx={{ fontSize: '11px' }} />
            <Tab label="Notes" value="2" sx={{ fontSize: '11px' }} />
            <Tab label="Create Note" value="3" sx={{ fontSize: '11px' }} />
          </TabList>
        </Box>
        <MyTabPanel value="1">
          <TextSearchRow
            placeHolder="Search"
            label="title/content"
            sx={{ borderStyle: 'none' }}
            searchAction={(text) => setMoodBoardSearch(text)}
            createAction={async (text) => {
              const c = {
                name: text || 'New Mood Board',
                description: '',
                gridLayout: { layout: { lg: [] } },
                diagram: {},
                pinned: false,
              };
              const c2 = await createMoodBoard(c);
              dispatch(moodBoardAdded(c2));
              setCurMoodBoard(c2);
              dispatch(moodBoardHandled(c2));
            }}
          />
          <MoodBoardList moodBoardSearch={moodBoardSearch} />
        </MyTabPanel>
        <MyTabPanel value="2">
          <CustomizedFilterBase
            useForSidePane
            queryActionCallback={(query) => setNoteQueryStr(query)}
          />
          <NotesListPanelInMoodBoard
            query={noteQueryStr}
            noteSelectionHandler={(note) => noteSelected(note)}
          />
        </MyTabPanel>
        <MyTabPanel value="3">
          <CreateNoteCell noteCreationHandler={(note) => noteSelected(note)} />
        </MyTabPanel>
      </TabContext>
    </Box>
  );

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="320"
    />
  );
}
export default MoodBoardView;
