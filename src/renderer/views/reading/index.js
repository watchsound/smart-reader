import React, { useEffect } from 'react';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { useLoaderData } from 'react-router-dom';
import { useDispatch } from 'react-redux';
// import OpenAI from 'openai';

import join from '../../../commons/utils/content/joinUtil';

import EPubView from './EPubView';
import PDFView from './PDFView';
import BookNotesPanel from './BookNotesPanel';
import SearchResultPane from './SearchResultPane';
// import { globalContext } from '../../utils/globalContext';
import customStorage from '../../store/customStorage';
import { getBookById } from '../../api/booksApi';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import CommunityPanel from './CommunityPanel';
import { currentBookHandled } from '../../store/reducers/readerSlice';
import InContextChatPanel from '../../components/chat/InContextChatPanel';
import ErrorBoundary from '../../ErrorBoundary';

const AntTabs = styled(Tabs)({
  borderBottom: '1px solid #e8e8e8',
  '& .MuiTabs-indicator': {
    backgroundColor: '#1890ff',
  },
});

const AntTab = styled((props) => <Tab disableRipple {...props} />)(
  ({ theme }) => ({
    textTransform: 'none',
    minWidth: 0,
    [theme.breakpoints.up('sm')]: {
      minWidth: 0,
    },
    fontSize: '11px',
    fontWeight: theme.typography.fontWeightRegular,
    //  marginRight: theme.spacing(1),
    color: 'rgba(0, 0, 0, 0.85)',
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    '&:hover': {
      color: '#40a9ff',
      opacity: 1,
    },
    '&.Mui-selected': {
      color: '#1890ff',
      fontWeight: theme.typography.fontWeightMedium,
    },
    '&.Mui-focusVisible': {
      backgroundColor: '#d1eaff',
    },
  }),
);

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export async function loader({ params }) {
  const book = await getBookById(params.id);
  if (!book) {
    throw new Response('', {
      status: 404,
      statusText: `Book Not Found FOR ${params.id}`,
    });
  }
  let note = null;
  if (params.noteId) {
    note = await customStorage.getNoteById(params.noteId);
  }
  return { book, note };
}

function EReaderPage() {
  // const [useCapture, setUseCapture] = useState(false);
  const [tabValue, setTabValue] = React.useState(0);
  const [bookPath, setBookPath] = React.useState('');
  const [serverUrl, setServerUrl] = React.useState('');
  // const [apiKey, setApiKey] = React.useState('');
  // const [model, setModel] = useState('');
  const { book, note } = useLoaderData();
  const dispatch = useDispatch();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  useEffect(() => {
    async function t() {
      const url = await customStorage.getServerUrl();
      setServerUrl(url || '');
    }
    t();
  }, []);

  // const openai = useMemo(() => {
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //     const m = await customStorage.getChatGPTModel();
  //      setModel(m);
  //   }
  //   t();
  // }, []);
  // const onCaptureComplete = (data) => {
  //   setUseCapture(false);
  // };

  // const bridgeScrollToCFI = (cfi) => {
  //   if (epubViewRef.current) {
  //     epubViewRef.current.scrollToCFI(cfi);
  //   }
  // };

  // const bridgeSearchText = (inputText, callback) => {
  //   console.log(`in bridge inputext = ${inputText}`);
  //   if (epubViewRef.current) {
  //     console.log(`in bridge inputext2 = ${inputText}`);
  //     epubViewRef.current.searchText(inputText, callback);
  //   }
  // };

  React.useEffect(() => {
    if (!book) return;
    async function cdr() {
      // const currentDirectory = await window.electron.ipcRenderer.dirname();
      // setCurdir(currentDirectory);
      // console.log(currentDirectory);
      // setBookPath(`file://${currentDirectory}/../assets/books/alice.epub`);
      let outPath = book.path;
      if (!outPath) {
        const dataPath = await customStorage.getItem('storageLocation');
        outPath = join(
          dataPath,
          `book`,
          `${book.keyInStorage || book.id}.${book.format}`,
        );
      }
      setBookPath(`file://${outPath}`);
      console.log(`file://${outPath}`);
      dispatch(currentBookHandled(book));
      // if (epubViewRef.current) {
      // epubViewRef.current.setBookPath(`file://${outPath}`, book);

      // epubViewRef.current.setBookPath(
      //  `file://${currentDirectory}/../assets/books/alicex.epub`,
      // );
      // }
    }
    cdr();
  }, [book]);

  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ bgcolor: '#fff' }}>
        <AntTabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons
          allowScrollButtonsMobile
          aria-label="scrollable"
        >
          <AntTab label="My Notes" {...a11yProps(0)} />
          <AntTab label="Search" {...a11yProps(1)} />
          <AntTab label="AI Bot" {...a11yProps(2)} />
          {serverUrl && <AntTab label="Communities" {...a11yProps(3)} />}
        </AntTabs>
      </Box>
      <CustomTabPanel value={tabValue} index={0}>
        <BookNotesPanel sourceKey={book.id} width={340} />
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <SearchResultPane />
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={2}>
        <InContextChatPanel curBook={book} />
      </CustomTabPanel>
      {serverUrl && (
        <CustomTabPanel value={tabValue} index={3}>
          <CommunityPanel idFromServer={book.idFromServer} />
        </CustomTabPanel>
      )}
    </Box>
  );

  const mainPanelEPub = (
    <EPubView
      bookPath={bookPath}
      curBook={book}
      curCfi={note ? note.cfi : ''}
    />
  );

  const mainPanelPDF = (
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <PDFView bookPath={bookPath} curBook={book} curNote={note} />
    </ErrorBoundary>
  );

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={book.format === 'epub' ? mainPanelEPub : mainPanelPDF}
      rightPanelWidth="340"
    />
  );
}
export default EReaderPage;
