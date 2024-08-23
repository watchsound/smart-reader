/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Box,
  Card,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Snackbar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Paper from '@mui/material/Paper';
import { useMemo, useEffect, useState, useRef, } from 'react';
import { v4 as uuid } from 'uuid';
import SendIcon from '@mui/icons-material/Send';
import SendAndArchiveIcon from '@mui/icons-material/SendAndArchive';
import OpenAI from 'openai';
import JSON5 from 'json5';

// import { OpenAI as ChatOpenAI } from "@langchain/openai";
// import { ToolMessage } from "@langchain/core/messages";

import { useSelector, useDispatch } from 'react-redux';
import Tooltip from '@mui/material/Tooltip';
import ButtonGroup from '@mui/material/ButtonGroup';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import Avatar from '@mui/material/Avatar';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import QuizIcon from '@mui/icons-material/Quiz';
import  {TextAnnotateBlend} from 'react-text-annotate-blend';


import customStorage from '../../store/customStorage';
import MessageItem from '../../components/chat/MessageItem';
import parseMarkdownToHtml from '../../components/note/NoteUtil';
import SmallButton from '../../components/Button/SmallButton';

import { LanguageModel, ReaderLevel } from '../../../commons/model/DataTypes';

import {
  getNLPAnnotationPrompt,
  getTranslatePrompt,
} from './PromptUtil';
import { getFirstNMinusTailItems } from '../../../commons/utils/CommonLangUtil';
import DependencyTree  from './DependencyTree';
import { getTokenAndDependencies } from './DependencyUtil';
import StepOneSVOCard from './StepOneSVOCard';
import StepTwoVerbCard from './StepTwoVerbCard';
import StepThreeSentenceStructureCard from './StepThreeSentenceStructureCard';
import StepFourSentenceScaffoldCard from './StepFourSentenceScaffoldCard';
import StepFiveFinalCard from './StepFiveFinalCard';
import aiProviderManager from '../../../commons/service/AIProviderManager';

function TranslateMainPage( ) {
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');


  const [content, setContent] = useState('');
  const [multiline, setMultiline] = useState(true);
  const [readerLevel, setReaderLevel] = useState('');


  const [sentence, setSentence] = useState('');
  const [translated, setTranslated] = useState('');
  const [annotationJsonOriginal, setAnnotationJsonOriginal] = useState(null);
  const [dependenciesOriginal, setDependenciesOriginal] = useState([]);
  const [tokensOriginal, setTokensOriginal] = useState([]);

  const [translateProcess, setTranslateProcess] = useState(null);

  const [annotationJsonTranslated, setAnnotationJsonTranslated] = useState(null);
  const [dependenciesTranslated, setDependenciesTranslated] = useState([]);
  const [tokensTranslated, setTokensTranslated] = useState([]);

  const [curStep, setCurStep] = useState(0);
  const [stepId, setStepId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [languageModel, setLanguageModel] = useState(
    LanguageModel.Chinese,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dispatch = useDispatch();

  const componentRef = useRef(null);

  useEffect(() => {
    async function t() {
      const r = await customStorage.getReaderLevel();
      setReaderLevel(r);
    }
    t();
  }, []);

  const clearChat = () => {
     setSentence('');
     setContent('');
     setTranslated('');
     setAnnotationJsonOriginal(null);
     setTranslateProcess(null);
     setDependenciesOriginal([]);
     setCurStep(0);
  };

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };


  const annotateSentence = async (input, isOriginal) => {
      const prompt = getNLPAnnotationPrompt(input.trim());
      const jsonData = await aiProviderManager.generateContentWithJson(
        prompt,
        true,
        'sentence',
      );
      if (!jsonData) return false;
      if (isOriginal) {
        setAnnotationJsonOriginal(jsonData);
        const { t, d } = getTokenAndDependencies(jsonData);
        setTokensOriginal(t);
        setDependenciesOriginal(d);
      } else {
        setAnnotationJsonTranslated(jsonData);
        const { t, d } = getTokenAndDependencies(jsonData);
        setTokensTranslated(t);
        setDependenciesTranslated(d);
      }
      return true;
  };
  // Function to start the interval
  const startInterval = () => {
    const intervalId = setInterval(() => {
      setCurStep(prevStep => prevStep + 1);
      if (curStep === 5) {
        clearInterval(intervalId);

      }
    }, 3000);
    setStepId(intervalId);
  };

  const submit = async ( ) => {
    if (submitting) return;
    clearChat();
    if (!content) return;

    try {
      setSubmitting(true);
      setSentence(content.trim());
      const success = await annotateSentence(content.trim(), true);
      if (success) {
       const prompt2 = getTranslatePrompt(content.trim(), languageModel);
       const jsonData2 = await aiProviderManager.generateContentWithJson(
        prompt2,
        true,
        'input-sentence',
       );
       if (jsonData2) {
         setTranslateProcess(jsonData2);
         startInterval();
         annotateSentence(jsonData2['step-5'].output, false)
       }

     }

      setSubmitting(false);

    } catch (error) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showMessage('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showMessage(message);
      }
    } finally {
       setSubmitting(false);
    }
  };

  const onContentChange = (event) => {
    const { value } = event.currentTarget;
    setContent(value);
  };

  const handleLanguageModelChange = (event) => {
    setLanguageModel(event.target.value);
  };
  // const handleChange = (newAnnotations) => {
  //   setOriginalAnnotation(newAnnotations);
  // };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div>
          <Select
                labelId="demo-simple-select-label"
                id="demo-language-select"
                value={languageModel}
                label="Language"
                onChange={handleLanguageModelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={LanguageModel.Chinese}>中文解释</MenuItem>
                <MenuItem value={LanguageModel.Japanese}>日本語で説明する</MenuItem>
              </Select>
      </div>
      <Box  ref={componentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
           {sentence  && tokensOriginal.length > 0 && (
            <Paper
              sx={{ display: 'flex', justifyContent: 'center', p: 1, paddingTop: '100px' }}
              elevation={3}
            >
              <DependencyTree
                tokens={tokensOriginal}
                dependencies={dependenciesOriginal}
              />
            </Paper>
           )}
          {sentence  && tokensTranslated.length > 0 && (
            <Paper
              sx={{ display: 'flex', justifyContent: 'center', p: 1  }}
              elevation={3}
            >
              <DependencyTree
                tokens={tokensTranslated}
                dependencies={dependenciesTranslated}
              />
            </Paper>
           )}
          {translateProcess && curStep > 0 && (
            <StepOneSVOCard
              originalTokens={tokensOriginal}
              title={translateProcess['step-1'].title}
              subVerbObjList={translateProcess['step-1']['sub-verb-obj-list']}
              explain={translateProcess['step-1'].explain}
            />
          )}
          {translateProcess && curStep > 1  && (
            <StepTwoVerbCard
              language={languageModel}
              originalTokens={tokensOriginal}
              title={translateProcess['step-2'].title}
              inputVerbList={translateProcess['step-2']['input-verb-list']}
              explain={translateProcess['step-2'].explain}
            />
          )}
          {translateProcess && curStep > 2  && (
             <StepFourSentenceScaffoldCard
              title={translateProcess['step-3'].title}
              scaffoldOptions={translateProcess['step-3']['scaffold-options']}
              explain={translateProcess['step-3'].explain}
            />
          )}
          {translateProcess && curStep > 3  && (
             <StepThreeSentenceStructureCard
              title={translateProcess['step-4'].title}
              sentenceStructure={translateProcess['step-4']['sentence-structure']}
              explain={translateProcess['step-4'].explain}
            />

          )}
          {translateProcess && curStep > 4  && (
            <StepFiveFinalCard
              title={translateProcess['step-5'].title}
              output={translateProcess['step-5'].output}
              explain={translateProcess['step-5'].explain}
            />
          )}
        </Stack>
      </Box>
      {/* Bottom Panel */}
      <Box sx={{  padding: 2 }}>
      <Paper sx={{ display: 'flex', justifyContent: 'center', p: 1 }} elevation={3}>
        <Stack  sx={{ width: '100%',   margin: '4px', p: 1 }} spacing={2} direction="row" alignItems="center">
          <TextField
            fullWidth
            multiline
            minRows={5}
            maxRows={5}
            disabled={submitting}
            value={content}
            onChange={onContentChange}
            placeholder={languageModel === LanguageModel.Chinese?
               "中译英：输入需要翻译的中文句子" : "日訳英：翻訳が必要な日本語の文を入力してください"}
            variant="outlined"
            size="small"
            onKeyDown={async (event) => {
              if (event.code === 'Enter' && (!event.shiftKey && !multiline)) {
                event.preventDefault();
                submit( );
              }

            }}
          />
          <div>
            <ButtonGroup orientation="vertical" aria-label="control group">
              <Tooltip title="Grammar Checking">
                <SmallButton
                  color="primary"
                  onClick={()=>submit( )}
                  disabled={submitting}
                >
                  <SendIcon />
                </SmallButton>
              </Tooltip>
               <Tooltip title="Print">
                <SmallButton
                  color="primary"
                  onClick={()=>console.log(JSON.stringify(annotationJsonOriginal))}
                >
                  <DeleteForeverIcon />
                </SmallButton>
              </Tooltip>
            </ButtonGroup>
          </div>
        </Stack>
      </Paper>
      </Box>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TranslateMainPage;
