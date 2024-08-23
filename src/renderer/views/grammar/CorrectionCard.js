import React from 'react';
import { Box, Typography, Chip, Grid } from '@mui/material';
import ArrowRightAltOutlinedIcon from '@mui/icons-material/ArrowRightAltOutlined';
import { styled } from '@mui/material/styles';

import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TextAnnotator from 'text-annotator-v2';

import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import { getGrammarCorrectionExtraPrompt } from './PromptUtil';
import { parseMarkdownToHtmlNoCallback } from '../../components/note/NoteUtil';
import SmallButton from '../../components/Button/SmallButton';
import aiProviderManager from '../../../commons/service/AIProviderManager';

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

function CorrectionCard({
  originalSentence,
  correctedSentence,
  type,
  original,
  corrected,
  explain,
  example,
  language,
}) {
  const [color, setColor] = React.useState('red');
  const [expanded, setExpanded] = React.useState(false);
  const [detailedExplanation, setDetailedExplanation] = React.useState('');
  const [htmlCode, setHtmlCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  React.useEffect(() => {
    setColor(mapToPredefinedColor(type));
  }, [type]);

  React.useEffect(() => {
    async function t() {
      let html = await parseMarkdownToHtmlNoCallback(detailedExplanation);
      const annotator = new TextAnnotator(html);
      let ar = annotator.searchAll(type);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_blue' });
      }
      ar = annotator.searchAll(original);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_red' });
      }
      ar = annotator.searchAll(corrected);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_green' });
      }
      ar = annotator.searchAll('correct:');
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_green' });
      }
      ar = annotator.searchAll('incorrect:');
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_red' });
      }

      setHtmlCode(html);
    }
    if (detailedExplanation) t();
  }, [detailedExplanation]);

  const fetchDetailedData = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const prompt = getGrammarCorrectionExtraPrompt(
        originalSentence,
        correctedSentence,
        original,
        corrected,
        explain,
        language,
      );
      const r = await aiProviderManager.generateContent( prompt );
      setDetailedExplanation(r || '');
    } catch (e) {
      console.log(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="flex-start"
      p={2}
      border="1px solid #ddd"
      borderRadius="8px"
      width="100%"
    >
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography
            variant="h8"
            sx={{ backgroundColor: color, color: '#FFFFFF' }}
            gutterBottom
          >
            {type}
          </Typography>
        </Grid>

        <Grid item xs={6} container justifyContent="flex-end">
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </Grid>
      </Grid>

      <Box display="flex" alignItems="center" mb={1}>
        <Typography
          variant="body1"
          component="span"
          sx={{ textDecoration: 'line-through', mr: 1 }}
        >
          {original}
        </Typography>
        <ArrowRightAltOutlinedIcon />
        <Chip label={corrected} color="primary" />
      </Box>
      <Typography variant="body2" color="textSecondary">
        {explain}
      </Typography>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Grid container spacing={2}>
          <Grid item xs={11}>
            <Typography variant="body2" color="textSecondary">
              {example}
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

        {detailedExplanation && (
          <div
            className="note__body"
            style={{ overflowX: 'auto', margin: '4px', fontSize: '14px' }}
            dangerouslySetInnerHTML={{ __html: htmlCode }}
          />
        )}
      </Collapse>
    </Box>
  );
}

export default CorrectionCard;
