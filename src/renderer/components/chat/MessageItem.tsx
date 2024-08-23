/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useMemo, useEffect, useState, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import { deepOrange, deepPurple } from '@mui/material/colors';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import PasswordIcon from '@mui/icons-material/Password';
import QuizIcon from '@mui/icons-material/Quiz';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import 'highlight.js/styles/github.css'; // Import the desired highlight.js CSS style
// import OpenAI from 'openai';
import { v4 as uuid } from 'uuid';
import { debounce } from 'lodash';
import { Message } from '../../../commons/model/chat';
import CreatePromptModal from './CreatePromptModal';
import { LogoIcon } from './Logo';
import ScrollIntoView from './ScrollIntoView';
import CopyToClipboardButton from './CopyToClipboardButton';
import CreateNoteModal from './CreateNoteModal';
import parseMarkdownToHtml, {
  parseMarkdownToHtmlNoCallback,
} from '../note/NoteUtil';
import { StudyMode } from '../../../commons/model/DataTypes';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';
import { getQuizChatHistoryPrompt } from '../../../commons/utils/AIPrompts';
import openImpressWindow from '../impressjs';
import aiProviderManager from '../../../commons/service/AIProviderManager';
import RichTextActionMenu from '../richtext/RichTextActionMenu';
import RichTextCard from '../richtext/RichTextCard';

const ColoredTextTypography = styled(Typography)({
  color: 'gray',
  fontSize: [16, '!important'],
});

function MessageItem({ message }: { message: Message }) {
  const [htmlCode, setHtmlCode] = useState('');
  const [selectedText, setSelectedText] = useState('');
  // const [showImpressjs, setShowImpressjs] = useState(false);
  const [emphasis, setEmphasis] = useState('');
  const [entry, setEntry] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // const wordCount = useMemo(() => {
  //   const matches = message.content.match(/[\w\d\’\'-\(\)]+/gi);
  //   return matches ? matches.length : 0;
  // }, [message.content]);

  // const openai = useMemo(() => {
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //     const m = await customStorage.getChatGPTModel();
  //     setModel(m);
  //   }
  //   t();
  // }, []);

  const handleMouseUp = () => {
    const s = window.getSelection() || '';
    const text = s.toString();
    setSelectedText(text);
  };
  const addToKeyWordList = async () => {
    if (!selectedText) return;
    const studyMode = (await customStorage.getStudyMode()) || StudyMode.General;
    customStorage.addToKeyWordList(studyMode, selectedText);
  };

  const createQuiz = async () => {
    const v = selectedText || message.content;
    if (!v || v.length < 10) return;
    const newPrompt = getQuizChatHistoryPrompt(v);
    const quizJson = await aiProviderManager.sendChatMessage(
      newPrompt,
      '',
      {},
      true,
    );
    if (quizJson) {
      for (let i = 0; i < quizJson.quiz.length; i++) {
        const quizProblem = quizJson.quiz[i];
        if (quizProblem) {
          quizProblem.sourceKey = message.id;
          quizProblem.sourceType = 'chat';
          quizProblem.id = uuid();
          quizProblem.correct = false;
          customStorage.createQuizProblem(quizProblem);
        }
      }
    }
  };
  const maybeKeywords = () => {
    if (!selectedText) return false;
    const p0 = selectedText.indexOf(' ');
    if (p0 < 0) return true;
    const p1 = selectedText.indexOf(' ', p0 + 2);
    if (p1 < 0) return true;
    const p2 = selectedText.indexOf(' ', p1 + 2);
    if (p2 < 0) return true;
    return false;
  };

  const debouncedFilter = useCallback(
    debounce(() => {
      async function t() {
        console.log(` log it ${message.content}`);
        const html = await parseMarkdownToHtmlNoCallback(message.content);
        setHtmlCode(html);
        const matches = message.content.match(/[\w\d\’\'-\(\)]+/gi);
        setWordCount(matches ? matches.length : 0);
      }
      t();
    }, 500),
    [message.content],
  );

  useEffect(() => {
    if (!message.content) return;
    debouncedFilter();
  }, [message.content, debouncedFilter]);

  return (
    <ScrollIntoView>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2} sx={{ width: '100%', alignItems: 'top' }}>
          <Grid item>
            {message.role === 'user' && (
              <Avatar sx={{ bgcolor: deepOrange[500] }}>N</Avatar>
            )}
            {message.role === 'assistant' && (
              <LogoIcon style={{ height: 32 }} />
            )}
          </Grid>
          <Grid item xs>
            {!emphasis && !entry && (
              <div
                className="note__body"
                style={{ overflowX: 'auto' }}
                onMouseUp={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: htmlCode }}
              />
            )}
            {(emphasis !== '' || entry !== '') && (
              <RichTextCard
                input={htmlCode}
                isHtml
                tokenCallback={() => {}}
                showToken
                entryEffect={entry}
                emphasisEffect={emphasis}
              />
            )}
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item>
                {message.role === 'assistant' && (
                  <Box>
                    <ColoredTextTypography>
                      {wordCount} words
                    </ColoredTextTypography>
                  </Box>
                )}
              </Grid>
              <Grid item>
                {message.role === 'user' && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                    }}
                  >
                    <CreatePromptModal
                      content={selectedText || message.content}
                    />
                  </Box>
                )}
                {message.role === 'assistant' && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                    }}
                  >
                    <CopyToClipboardButton
                      content={selectedText || message.content}
                    />
                    {(selectedText || message.content).length > 50 && (
                      <Tooltip title="Presentation">
                        <IconButton
                          size="small"
                          onClick={() =>
                            openImpressWindow({
                              paragraph: selectedText || message.content,
                            })
                          }
                          aria-label="presentation"
                        >
                          <CoPresentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Create Quiz">
                      <IconButton
                        size="small"
                        onClick={() => createQuiz()}
                        aria-label="create"
                      >
                        <QuizIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <RichTextActionMenu
                      asIconButton
                      emphasisCallback={setEmphasis}
                      entryCallback={setEntry}
                    />
                    <CreateNoteModal
                      sourceType={NoteType.Chat}
                      sourceKey={message.id}
                      content={selectedText || message.content}
                      imageData=""
                      cfi=""
                      url=""
                      emoji=""
                      color=""
                      highlightType=""
                      showButton
                      openDialog={false}
                    />
                  </Box>
                )}
                {message.role === 'assistant' && maybeKeywords() && (
                  <Tooltip title="Add To Keyword List">
                    <IconButton
                      size="small"
                      onClick={() => addToKeyWordList()}
                      aria-label="create"
                    >
                      <PasswordIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
      {/* {showImpressjs && (
        <Impressjs
          paragraph={selectedText || message.content}
          closeHandler={() => setShowImpressjs(false)}
        />
      )} */}
    </ScrollIntoView>
  );
}

export default MessageItem;
