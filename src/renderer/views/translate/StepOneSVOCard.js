/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  CardContent,
  CardHeader,
  Paper,
} from '@mui/material';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import DependencyTree from './DependencyTree';

/**
 "sub-verb-obj-list: [
          {
            "subject" : {
                "input" : "二楼",
                "english" : "the second floor",
            },
              "verb" : {
                "input" : "有",
                "english" : [ "has", "there are" ],
            },
            "object" : {
                "input" : "书",
                "english" : "books",
            },
          },
        ],
 */
function StepOneSVOCard({
  originalTokens,
  title,
  subVerbObjList,
  explain,
}) {
  const [tokens, setTokens] = React.useState([]);

  function findToken(text) {
    const item = originalTokens.filter((item) => item.text === text);
    return item && item.length > 0 ? item[0] : null;
  }

  React.useEffect(() => {
    const tt = [];
    subVerbObjList.forEach( (row) => {
      const {subject, verb, object} = row;
      const t = [];
      let item = findToken(subject.input);
      if (item) {
        t.push({ ...item, tag: subject.english });
      } else {
        t.push({
          index:0,
          text: subject.input,
          tag: verb.english,
          color: mapToPredefinedColor('NN'),
        });
      }
      item = findToken(verb.input);
      if (item) {
        t.push({ ...item, tag: verb.english });
      } else {
        t.push({
          index:1,
          text: verb.input,
          tag:  verb.english,
          color: mapToPredefinedColor('VB'),
        });
      }
      item = findToken(object.input);
      if (item) {
        t.push({ ...item, tag: object.english });
      } else {
        t.push({
          index:1,
          text: object.input,
          tag:  verb.english,
          color: mapToPredefinedColor('NN'),
        });
      }
      tt.push(t);
    });

    setTokens(tt);
  }, [originalTokens, subVerbObjList]);

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
         <CardContent>
        {tokens.map((items, index) => (
                <DependencyTree
                  tokens={items}
                  dependencies={[]}
                />

      ))}
       </CardContent>
    </Box>
    <Box sx={{ margin: '6px', borderLeftStyle: 'solid', borderColor: '#3992ffE0', }}>
      <Typography variant="body2"   sx={{ padding: '6px' }}>
           {explain}
       </Typography>
     </Box>
    </Paper>
  );
}

export default StepOneSVOCard;
