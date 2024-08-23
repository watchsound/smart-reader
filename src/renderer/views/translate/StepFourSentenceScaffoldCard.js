/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Paper,
} from '@mui/material';

/**
    "step-4" :{"
       "title" : "选择相应英语翻译的基本结构",
       "scaffold-options":
         [
         "The second floor has books",
         "There are books on the second floor."
         ],
       "best-scaffold" : "There are books on the second floor.",
       "explain" : "'there are' is commonly used for the existence of something at a location. "
    },
 */
function StepFourSentenceScaffoldCard({
  title,
  scaffoldOptions,
  explain,
}) {

  return (
     <Paper sx={{ width: '100%', margin: '0px', padding: '0px' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', padding: 1, gap: 1 }}>
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
       {scaffoldOptions.map((sentence, index) => (
          <Card variant="outlined" sx={{ width: '100%' }}>
            <CardContent>
                <Typography
                  variant="body1"
                  component="span"
                  sx={{ textDecoration: 'green wavy underline', mr: 1, }}
                >
                  {sentence}
                </Typography>
            </CardContent>
          </Card>
       ))}
       </Box>
       <Box sx={{ margin: '6px', borderLeftStyle: 'solid', borderColor: '#3992ffE0', }}>
        <Typography variant="body2"   sx={{ padding: '6px' }}>
            {explain}
        </Typography>
       </Box>

    </Paper>
  );
}

export default StepFourSentenceScaffoldCard;
