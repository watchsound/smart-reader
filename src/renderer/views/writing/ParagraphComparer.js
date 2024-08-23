/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { TextField, Button, List, ListItem, ListItemText } from '@mui/material';
import globalAlign from './globalAlign';
import AlignmentDisplay from './AlignmentDisplay';

function ParagraphComparer({paragraph1, paragraph2}) {
  // const [paragraph1, setParagraph1] = useState('');
  // const [paragraph2, setParagraph2] = useState('');
  const [result, setResult] = useState(null);

  const handleCompare = () => {
    const comparisonResult = globalAlign(paragraph1, paragraph2);
    setResult(comparisonResult);
  };

  useEffect(() => {
    handleCompare();
  }, [paragraph1, paragraph2]);

  if (!result) return null;
  return (
    <AlignmentDisplay alignment={result.alignment} />
  );
  // return (
  //   <div>
  //     {result && (
  //       <>
  //         <div>Score: {result.score}</div>
  //         <List>
  //           {result.alignment.map((item, index) => (
  //             <ListItem key={index}>
  //               <ListItemText
  //                 primary={`${item.word1} - ${item.word2}`}
  //                 secondary={item.match ? 'Match' : 'No match'}
  //               />
  //             </ListItem>
  //           ))}
  //         </List>
  //       </>
  //     )}
  //   </div>
  // );
}

export default ParagraphComparer;
