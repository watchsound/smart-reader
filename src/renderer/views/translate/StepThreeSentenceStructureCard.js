/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';


/**
    "step-3" :{
       "description" : "选择句型结构类项",
       "sentence-structure" : "简单句 (Simple Sentence)",
       "explain" : "",
    },
 */
function StepThreeSentenceStructureCard({
  title,
  sentenceStructure,
  explain,
}) {


  return (
    <Card variant="outlined" sx={{ maxWidth: '100%' }}>
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
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Typography
            variant="body1"
            component="span"
            sx={{ textDecoration: 'green wavy underline', mr: 1,  }}
          >
            {sentenceStructure}
          </Typography>

        </Box>
        <Box sx={{ margin: '6px', borderLeftStyle: 'solid', borderColor: '#3992ffE0', }}>
          <Typography variant="body2"   sx={{ padding: '6px' }}>
           {explain}
         </Typography>
       </Box>
      </CardContent>
    </Card>
  );
}

export default StepThreeSentenceStructureCard;
