/* eslint-disable react/require-default-props */
/* eslint-disable prettier/prettier */
import { useEffect, useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import CardMedia from '@mui/material/CardMedia';

import TextField from '@mui/material/TextField';

import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

// import OpenAI from 'openai';
import { Note, NoteType, CardType } from '../../../commons/model/Note';
import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import parseMindmapToReactFlow, {
  removeStartEndSymbolLines,
} from '../../../commons/utils/content/mindmapUtil';
import customStorage from '../../store/customStorage';
import { createImage } from '../../api/booksApi';
import { createQuizProblem } from '../../api/quizApi';
import SmallButton from '../Button/SmallButton';
import getSummaryChatHistoryPrompt, {
  getMindMapChatHistoryPrompt,
  getQuizChatHistoryPrompt,
} from '../../../commons/utils/AIPrompts';
import aiProviderManager from '../../../commons/service/AIProviderManager';



/**
 *  if noteType is book,  we treat new note separately, as currently we keep book note
 *  at different location.
 * @param param0
 * @returns
 */
function CreateNotePanel({
  sourceType,
  sourceKey,
  content,
  imageData,
  cfi,
  url,
  emoji,
  color,
  highlightType,
  dialogHandle,
}: {
  sourceType: string;
  sourceKey: number;
  content: string;
  imageData: string;
  cfi: string;
  url: string;
  emoji: string;
  color: string;
  highlightType: string;
  dialogHandle?: (newNote: Note) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  // const [apiKey, setApiKey] = useState('');
  //   const [model, setModel] = useState('');
  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const [summary, setSummary] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [savedTags, setSavedTags] = useState('');
  const [CreateNote] = useCreateNoteMutation();

  // const openai = useMemo(() => {
  //   // console.log(` openai-key1 = ${apiKey}`);
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  useEffect(() => {
    async function t() {
      // const id = await customStorage.getOpenAIKey();
      // setApiKey(id);
      //       const m = await customStorage.getChatGPTModel();
      //  setModel(m);
      const ts = (await customStorage.getItem('saved_tags')) || [];
      if (ts.length > 0) setSavedTags(ts.join(','));
    }
    t();
  }, []);

  return (
    <>
      <DialogTitle id="custom-modal-title">Create Card</DialogTitle>
      <DialogContent>
        {imageData && (
          <Card sx={{ maxWidth: 345 }}>
            <CardMedia component="img" height="140" image={imageData} />
          </Card>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2, // Adjust the space between rows
          }}
        >
          <TextField
            label="Title"
            value={title}
            variant="outlined"
            sx={{ height: '35px', marginBottom: '5px' }}
            onChange={(event) => setTitle(event.currentTarget.value)}
            data-autofocus
          />
          <TextField
            placeholder="summary"
            multiline
            rows={4} //
            value={summary}
            sx={{ marginBottom: '5px' }}
            onChange={(event) => setSummary(event.currentTarget.value)}
          />
          <TextField
            placeholder="Content"
            multiline
            rows={4} //
            value={content}
            disabled
            sx={{ marginBottom: '5px' }}
          />
          <TextField
            label="Tags(separated by ,)"
            value={tags}
            variant="outlined"
            sx={{ height: '35px', marginBottom: '5px' }}
            onChange={(event) => setTags(event.currentTarget.value)}
            data-autofocus
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <SmallButton
          onClick={async (event) => {
            let newNote = null;
            try {
              if (!title && !summary && !imageData && !content) return;
              setSubmitting(true);
              event.preventDefault();
              let anImageId = '';
              if (imageData) {
                const r = await createImage( imageData );
                anImageId = r.id;
              }
              let sKey = sourceKey;
              if (sourceType === NoteType.Url) {
                const bookmark = await customStorage.createBookmark(sourceKey);
                if (bookmark) sKey = bookmark.id;
              }
              newNote = {
                sourceKey: sKey,
                title,
                cards: [
                  {
                    text: summary || '',
                    html: '',
                    image: anImageId,
                  },
                  {
                    text: content || '',
                    html: '',
                  },
                ],
                cfi, // cfi
                range: '', // range
                chapter: '',
                chapterIndex: -1,
                percentage: 0, /// percentage
                sourceType, // type
                color, // color
                tags: tags ? tags.split(',') : [],
                rate: 0,
                position: [],
                emoji,
                highlightOnly: false,
                highlightType,
                hasQuiz: false,
              };
              const n = await CreateNote(newNote);
              newNote = n.data ? n.data : n;
            } catch (error: any) {
              if (error.toJSON && error.toJSON().message === 'Network Error') {
                setAlertContent('No internet connection.');
                setAlert(true);
              }
              const message = error.response?.data?.error?.message;
              if (message) {
                setAlertContent(message);
                setAlert(true);
              }
            } finally {
              setSubmitting(false);
              if (dialogHandle) dialogHandle(newNote);
            }
          }}
        >
          Create Manually
        </SmallButton>
        {content && content.length > 50 && (
          <SmallButton
            onClick={async (event) => {
              let newNote = null;
              try {
                if (!title && !summary && !imageData && !content) return;
                setSubmitting(true);
                event.preventDefault();
                let summary1 = summary;
                let title1 = title;
                let tags = [];
                if (!summary1 && !title && content) {
                  const prompt  = getSummaryChatHistoryPrompt(content, savedTags);
                  let result = await aiProviderManager.sendChatMessage(prompt, '', {}, true);
                  if (!result) result = { title: '', summary: '', keywords: '' };

                  summary1 = result.summary;
                  title1 = result.title;
                  tags = result.keywords;
                }
                const prompt = getMindMapChatHistoryPrompt(content || summary1);
                console.log(prompt);
                const mindmap = await aiProviderManager.sendChatMessage(prompt)
                console.log(mindmap);
                const mindmapContent = removeStartEndSymbolLines(mindmap);
                const mindmapObj = parseMindmapToReactFlow(mindmapContent);

                let sKey = sourceKey;
                if (sourceType === NoteType.Url) {
                  const bookmark =
                    await customStorage.createBookmark(sourceKey);
                  if (bookmark) sKey = bookmark.id;
                }
                newNote = {
                  sourceKey: sKey,
                  title: title1,
                  cards: [
                    {
                      text: summary1 || '',
                      html: '',
                    },
                    {
                      text: content || '',
                      html: '',
                    },
                    {
                      text: mindmap || '',
                      html: '',
                      data: mindmapObj,
                      type: CardType.MindMap,
                    },
                  ],
                  chapter: '',
                  chapterIndex: -1,
                  cfi, // cfi
                  range: '', // range
                  percentage: 0, /// percentage
                  sourceType, // type
                  color, // color
                  tags,
                  rate: 0,
                  hasQuiz: true, // bug, if create quiz failed?
                  position: [],
                  emoji,
                  highlightOnly: false,
                  highlightType,
                };
                const n = await CreateNote(newNote);
                newNote = n.data ? n.data : n;
                const newPrompt = getQuizChatHistoryPrompt(content || summary1);
                const quizJson = await aiProviderManager.sendChatMessage(newPrompt, '', {}, true);
                if (quizJson) {
                  for (let i = 0; i < quizJson.quiz.length; i++) {
                    const quizProblem = quizJson.quiz[i];
                    if (quizProblem) {
                      quizProblem.sourceKey = newNote.id;
                      quizProblem.sourceType = 'note';
                      quizProblem.id = uuid();
                      quizProblem.correct = false;
                      createQuizProblem(quizProblem);
                    }
                  }
                }
              } catch (error: any) {
                if (
                  error.toJSON &&
                  error.toJSON().message === 'Network Error'
                ) {
                  setAlertContent('No internet connection.');
                  setAlert(true);
                }
                const message = error.response?.data?.error?.message;
                if (message) {
                  setAlertContent(message);
                  setAlert(true);
                }
              } finally {
                setSubmitting(false);
                if (dialogHandle) dialogHandle(newNote);
              }
            }}
          >
            Use AI
          </SmallButton>
        )}
        <SmallButton
          onClick={(event) => {
            if (dialogHandle) dialogHandle(null);
          }}
        >
          Close
        </SmallButton>
      </DialogActions>
      <Snackbar
        open={alert}
        autoHideDuration={6000}
        onClose={() => setAlert(false)}
      >
        <Alert severity="error">{alertContent}</Alert>
      </Snackbar>
    </>
  );
}

export default CreateNotePanel;
