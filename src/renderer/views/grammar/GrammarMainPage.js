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


import JsonSchemaManager from '../../utils/json/JsonSchemaManager';
import algebraSchema from '../../utils/json/algebraInstructionSchema';
import { ChatGPTModel, LanguageModel, ReaderLevel } from '../../../commons/model/DataTypes';

import {
  getGrammarCorrectionPrompt,
  getLangSystemMessage,
} from './PromptUtil';
import { getFirstNMinusTailItems } from '../../../commons/utils/CommonLangUtil';
import CorrectionCard  from './CorrectionCard';
import { getGrammarOriginalToAnnotation, getGrammarCorrectedToAnnotation } from './GrammarUtil';
import aiProviderManager from '../../../commons/service/AIProviderManager';


function GrammarMainPage( ) {
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');

  const [content, setContent] = useState('');
  const [multiline, setMultiline] = useState(true);
  const [readerLevel, setReaderLevel] = useState('');

  const [sentence, setSentence] = useState('');
  const [corrected, setCorrected] = useState('');
  const [originalAnnotation, setOriginalAnnotation] = useState([]);
  const [correctedAnnotation, setCorrectedAnnotation] = useState([]);
  const [grammarCorrection, setGrammarCorrection] = useState(null);
  const [grammarCorrectionList, setGrammarCorrectionList] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [languageModel, setLanguageModel] = useState(
    LanguageModel.English,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dispatch = useDispatch();

  const componentRef = useRef(null);

  // useEffect(() => {
  //   const resizeObserver = new ResizeObserver((entries) => {
  //     if (entries[0]) {
  //       const { width, height } = entries[0].contentRect;
  //       setSize({ width, height });
  //     }
  //   });
  //   if (componentRef.current) {
  //     resizeObserver.observe(componentRef.current);
  //   }

  //   return () => {
  //     if (componentRef.current) {
  //       resizeObserver.unobserve(componentRef.current);
  //     }
  //   };
  // }, []);



  const jsonSchemaManager = useMemo(() => {
    const manager = new JsonSchemaManager();
    manager.registerSchema('algebra', algebraSchema);
    return manager;
  }, []);



  useEffect(() => {
    async function t() {
      const r = await customStorage.getReaderLevel();
      setReaderLevel(r);
    }
    t();
  }, []);

  const clearChat = () => {
     setSentence('');
     setGrammarCorrection(null);
     setContent('');
     setCorrected('');
     setOriginalAnnotation([]);
     setCorrectedAnnotation([]);
     setGrammarCorrectionList([]);
  };

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const getSystemMessage = () => {
    return getLangSystemMessage;
  };



  const submit = async ( ) => {
    if (submitting) return;

    clearChat();
    if (!content) return;

    try {
      setSubmitting(true);
      setSentence(content.trim());
      const prompt = getGrammarCorrectionPrompt(content.trim(), languageModel);
      const jsonData = await aiProviderManager.generateContentWithJson(
        prompt,
        true,
        'data',
     );
     if (jsonData && jsonData.data) {
       setGrammarCorrection(jsonData);
       let a = getGrammarOriginalToAnnotation(jsonData);
       setOriginalAnnotation(a);

       a = getGrammarCorrectedToAnnotation(jsonData);
       setCorrectedAnnotation(a);
       let c = '';
       jsonData.data.forEach((item, index) => {
         c += `${item['correct-sentence']  } `
       });
       setCorrected(c);

       let cc = [];
       jsonData.data.forEach( (item, index) => {
        item.explanations.forEach( (item2, index2) => {
          cc.push({...item2, id: `${index}-${index2}`});
        } )
      })
      setGrammarCorrectionList(cc);
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
      <Box  ref={componentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <div>
          <Select
                labelId="demo-simple-select-label"
                id="demo-language-select"
                value={languageModel}
                label="Language"
                onChange={handleLanguageModelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={LanguageModel.English}>English</MenuItem>
                <MenuItem value={LanguageModel.Chinese}>中文解释</MenuItem>
                <MenuItem value={LanguageModel.Japanese}>日本語で説明する</MenuItem>
              </Select>
        </div>
        <Stack spacing={2}>
           {sentence  &&  (
            <Paper
              sx={{ display: 'flex', justifyContent: 'center', p: 1 }}
              elevation={3}
            >
              <TextAnnotateBlend
                content={sentence}
                value={originalAnnotation}
              />
            </Paper>
           )}
           {corrected  &&  (
            <Paper
              sx={{ display: 'flex', justifyContent: 'center', p: 1 }}
              elevation={3}
            >
              <TextAnnotateBlend
                content={corrected}
                value={correctedAnnotation}
              />
            </Paper>
           )}
           { grammarCorrection && (grammarCorrection.data.map( (item, index) => {
             return (
               <div key={`key_${index}`}>
                {item.explanations.map( (item2, index2) => {
                  return (
                        <CorrectionCard  key={`${index}-${index2}`}
                          type={item2.type}
                          originalSentence={item['original-sentence']}
                          correctedSentence={item['correct-sentence']}
                          original={item2.original}
                          corrected={item2.corrected}
                          explain={item2.explain}
                          example={item2['similar-examples']}
                          language={languageModel}/>
                      );
                  } )
                }
              </div>
              );
              } ) ) }


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
            placeholder="Your English Sentences Here"
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
                  onClick={()=>console.log(JSON.stringify(grammarCorrection))}
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

export default GrammarMainPage;
