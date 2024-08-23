/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Grid,
} from '@mui/material';
import ArrowRightAltOutlinedIcon from '@mui/icons-material/ArrowRightAltOutlined';

import { getVerbComparisonPrompt, getVerbExplainedPrompt } from './PromptUtil';
import { parseMarkdownToHtmlNoCallback } from '../../components/note/NoteUtil';
import SmallButton from '../../components/Button/SmallButton';
import aiProviderManager from '../../../commons/service/AIProviderManager';



/**
  "input-verb-list" : [
          {
            "input-verb" : "有",
            "english-verb-options": [ "has", "there are" ],
          },
        ],
 */
function StepTwoVerbCard({
  originalTokens,
  title,
  inputVerbList,
  explain,
  language,
}) {
  const [colors, setColors] = React.useState([]);
  const [expanded, setExpanded] = React.useState(false);
  const [detailedExplanation, setDetailedExplanation] = React.useState('');
  const [htmlCode, setHtmlCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  React.useEffect(() => {
    async function t() {
      const html = await parseMarkdownToHtmlNoCallback(detailedExplanation);
      setHtmlCode(html);
    }
    if (detailedExplanation) t();
  }, [detailedExplanation]);

  const fetchDetailedData = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let prompt = '';
      const vbs = inputVerbList[0]['english-verb-options'];
      if (vbs.length > 1){
         prompt = getVerbComparisonPrompt(vbs[0], vbs[1], language);
      } else {
        prompt = getVerbExplainedPrompt(vbs[0], language);
      }
      const r = await aiProviderManager.generateContent(prompt );
      setDetailedExplanation(r || '');
      setExpanded(true);
    } catch (e) {
      console.log(e);
    } finally {
      setSubmitting(false);
    }
  };



  function findToken(text) {
    const item = originalTokens.filter((item) => item.text === text);
    return item && item.length > 0 ? item[0] : null;
  }

  React.useEffect(() => {
    const cs = [];
    inputVerbList.forEach( (item, index) => {
        const iv = findToken(item['input-verb']);
        if (iv) {
          cs.push(iv.color);
        } else {
          cs.push('white');
        }
    });
   setColors(cs);
  }, [inputVerbList]);

  return (
     <Paper sx={{ width: '100%', margin: '0px', padding: '0px' }}>
      <CardHeader
        title={
          <Typography
            variant="caption"
              sx={{  borderLeftStyle: 'solid', borderColor: 'red', backgroundColor: '#3992ffE0', color: '#FFFFFF', padding: '6px' }}
          >
            {title}
          </Typography>
        }
        />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', padding: 1, gap: 1 }}>

       {inputVerbList.map((pair, index) => (
          <Card variant="outlined" sx={{ maxWidth: '100%' }}>
            <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
                <Typography
                  variant="body1"
                  component="span"
                  sx={{ textDecoration: 'green wavy underline', mr: 1, backgroundColor: colors[index]}}
                >
                  {pair['input-verb']}
                </Typography>
                <ArrowRightAltOutlinedIcon />
                {Array.isArray(pair['english-verb-options']) &&
                  pair['english-verb-options'].map((t, i) => {
                    return <Chip label={t} color="primary" />
                  })}
                {!Array.isArray(pair['english-verb-options']) && (
                  <Chip label={pair['english-verb-options']} color="primary" />
                )}

              </Box>
            </CardContent>
          </Card>
       ))}
       </Box>
       <Box sx={{ margin: '6px', borderLeftStyle: 'solid', borderColor: '#3992ffE0', }}>
       <Grid container spacing={2}  sx={{   padding: '6px' }}>
          <Grid item xs={11}>
            <Typography variant="body2" color="textSecondary">
             {explain}
            </Typography>
          </Grid>
          <Grid item xs={1} justifyContent="flex-end">
            <SmallButton
              color="primary"
              onClick={fetchDetailedData}
              disabled={submitting || detailedExplanation}
            >
              More...
            </SmallButton>
          </Grid>
        </Grid>
        </Box>
        {detailedExplanation && (
        <Box sx={{ margin: '6px', borderLeftStyle: 'solid', borderColor: '#3992ffE0', }}>

          <div
            className="note__body"
            style={{ overflowX: 'auto', margin: '4px', fontSize: '14px' }}
            dangerouslySetInnerHTML={{ __html: htmlCode }}
          />

        </Box>
         )}
    </Paper>
  );
}

export default StepTwoVerbCard;
