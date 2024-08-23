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
    "step-5" :{
       "description" : "从句子的基本结构扩展为完整句子",
       "output" : "There are many books on the second floor of the library.",
        "explain" : "",
    },
 */
function StepFiveFinalCard({
  title,
  output,
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
        <Box display="flex" alignItems="center" mb={1} sx={{width: '100%'}}>
          <Typography
            variant="body1"
            component="span"
            sx={{ textDecoration: 'green wavy underline', mr: 1,  }}
          >
            {output}
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

export default StepFiveFinalCard;
