import React, { useState, useEffect, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { Grid, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
// import { v4 as uuid } from 'uuid';
import { useSelector, useDispatch } from 'react-redux';
// import OpenAI from 'openai';

import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import { steps, stepsInfo } from './config';
import ParagraphWithHiddenWords from './ParagraphWithHiddenWords';
import WritingStepper from './WritingStepper';
import MultilineTextField from './MultilineTextField';
import {
  langstudyAnnotatePrompt,
  langstudyGrammarCheckPrompt,
  langstudyComparisonExercise,
  langstudy5wPrompt,
} from '../../../commons/utils/AIPrompts';
import customStorage from '../../store/customStorage';
import AnnotatedText from './AnnotatedText';
import SmallButton from '../../components/Button/SmallButton';
import ParagraphComparer from './ParagraphComparer';
import aiProviderManager from '../../../commons/service/AIProviderManager';
import ComparisonExercise from './ComparisonExercise';

const MyTabPanel = styled(TabPanel)({
  padding: '1px 1px',
  margin: '1px 1px',
});
function JsonDisplay({ data }) {
  if (!data) return null;
  return (
    <Paper sx={{ width: '100%', margin: '0px', padding: '0px' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', padding: 1, gap: 1 }}>
        {data.data.map((item, index) => (
          <Paper
            key={index}
            sx={{ padding: 1, marginBottom: 1, minWidth: 200 }}
          >
            <Typography variant="body2">
              <strong>Scene:</strong> {item.sentenceIndex}
            </Typography>
            <Typography variant="body2">
              <strong>Who:</strong> {item.who}
            </Typography>
            <Typography variant="body2">
              <strong>What:</strong> {item.what}
            </Typography>
            <Typography variant="body2">
              <strong>When:</strong> {item.when}
            </Typography>
            <Typography variant="body2">
              <strong>Where:</strong> {item.where}
            </Typography>
            <Typography variant="body2">
              <strong>Why:</strong> {item.why}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
}

function WritingView() {
  const [tabValue, setTabValue] = useState('1');
  const [curStep, setCurStep] = useState(steps[0]);
  const [text, setText] = useState('');
  const [decorText, setDecorText] = useState(['', '', '', '', '', '']);
  // const [apiKey, setApiKey] = useState('');
  // const [model, setModel] = useState('');
  const [lang5w, setLang5w] = useState('');
  const [mywriting, setMywriting] = useState('');
  const [mywritingCheck, setMywritingCheck] = useState('');
  const [mywritingComparison, setMywritingComparison] = useState('');
  const [letmetry, setLetmetry] = useState(false);
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //      const m = await customStorage.getChatGPTModel();
  //      setModel(m);
  //   }
  //   t();
  // }, []);
  // const openai = useMemo(() => {
  //   // console.log(` openai-key1 = ${apiKey}`);
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  useEffect(() => {
    const stepPos = steps.indexOf(curStep);
    async function t() {
      const prompt = langstudyAnnotatePrompt(curStep);
      const mapped = await aiProviderManager.generateContentWithJson(
        `${prompt}\n ${text}`,
        false,
      );
      setDecorText(
        decorText.map((value, index) => {
          if (index === stepPos) return mapped;
          return value;
        }),
      );
    }
    if (text && !decorText[stepPos]) t();
  }, [curStep]);

  const resetText = (content) => {
    setText(content);
    setDecorText(['', '', '', '', '', '']);
    setLang5w('');
    setLetmetry(false);
    setMywritingCheck('');
    setMywritingComparison('');
  };
  const tryLetmetry = () => {
    setLetmetry(true);
    if (!text || lang5w) return;
    async function t() {
      const r = await aiProviderManager.generateContentWithJson(
        `${langstudy5wPrompt}\n  ${text}`,
        true,
      );
      setLang5w(r);
    }
    t();
  };

  const tryGrammarComparison = async () => {
    if (!mywriting) return;
    const prompt = langstudyComparisonExercise(text, mywriting);
    const r = await aiProviderManager.generateContentWithJson(prompt, true);
    setMywritingComparison(r);
  };

  const tryGrammarChecking = async () => {
    if (!mywriting) return;
    const r = await aiProviderManager.generateContentWithJson(
      `${langstudyGrammarCheckPrompt}\n please do grammar checking for: \n${mywriting}`,
      false,
    );
    setMywritingCheck(r);
    await tryGrammarComparison();
  };

  // const mainPanel = (
  return (
    <>
      <WritingStepper stepsCallback={(step) => setCurStep(step)} />
      {curStep === steps[0] && (
        <MultilineTextField
          initialText={text}
          placeholder="Enter paragraph you want to learn"
          onTextChange={(t) => resetText(t)}
        />
      )}
      {curStep !== steps[0] && (
        <ParagraphWithHiddenWords
          inputText={decorText[steps.indexOf(curStep)]}
        />
      )}
      {text && (
        <Paper>
          <div className="two_end_container">
            <div className="two_end_start" style={{ border: 'none' }}>
              <SmallButton onClick={() => tryLetmetry(true)}>
                Let me try it.
              </SmallButton>
            </div>
          </div>
        </Paper>
      )}
      {letmetry && (
        <>
          <JsonDisplay data={lang5w} />

          <MultilineTextField
            initialText={mywriting}
            placeholder="Write your paragraph here"
            onTextChange={(t) => setMywriting(t)}
          />
          <Paper sx={{ width: '100%', margin: '1px', padding: '2px' }}>
            <div className="two_end_container">
              <div className="two_end_end" style={{ border: 'none' }}>
                <SmallButton onClick={() => tryGrammarChecking()}>
                  Grammar Checking
                </SmallButton>
              </div>
            </div>
          </Paper>
          <AnnotatedText fullText={mywritingCheck} />
          {mywritingComparison && (
            <ComparisonExercise mywritingComparison={mywritingComparison} />
          )}
          {mywritingCheck && (
            <ParagraphComparer paragraph1={text} paragraph2={mywriting} />
          )}
        </>
      )}
    </>
  );

  // const rightPanel = (
  //   <Box sx={{ width: '100%' }}>
  //     <TabContext value={tabValue}>
  //       <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
  //         <TabList onChange={handleTabChange}>
  //           <Tab label="Vocabulary Set" value="1" sx={{ fontSize: '11px' }} />
  //           <Tab label="Vocabularies" value="2" sx={{ fontSize: '11px' }} />
  //         </TabList>
  //       </Box>
  //       <MyTabPanel value="1" />
  //       <MyTabPanel value="2" />
  //     </TabContext>
  //   </Box>
  // );

  // return (
  //   <RightCollapsibleLayout
  //     rightPanel={rightPanel}
  //     mainPanel={mainPanel}
  //     rightPanelWidth="240"
  //   />
  // );
}
export default WritingView;
