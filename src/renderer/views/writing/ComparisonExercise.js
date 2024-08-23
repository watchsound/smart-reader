/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import { Card, CardContent, Paper, Typography, Switch, FormControlLabel, IconButton } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import { langstudyComparisonExerciseMore } from '../../../commons/utils/AIPrompts';
import aiProviderManager from '../../../commons/service/AIProviderManager';
/**
 *{
 "issues": [
  {
    "type": "Capitalization",
    "explain": "The word \"When\" should be capitalized at the beginning of the sentence."
  },
 ],
 "exercises": [
  {
    "type": "Verb Tense Consistency",
    "original": "When the color of the sky is changed, the atmosphere looks different.",
    "rewriteExercise": "Change the verb \"is changed\" to match the correct tense and context.",
    "example": "When the color of the sky is set to change, the atmosphere looks different."
  },
 ]
}
 */

function ExerciseCard({ exercise }){
  const [isExampleVisible, setIsExampleVisible] = useState(false);
 const [additionalExamples, setAdditionalExamples] = useState([]);

  const toggleExampleVisibility = () => {
    setIsExampleVisible(!isExampleVisible);
  };

  const fetchMoreExamples = async () => {
    const prompt = langstudyComparisonExerciseMore(exercise);
    const moreExamples = await aiProviderManager.generateContentWithJson(prompt, true);
    if (moreExamples && moreExamples.data) setAdditionalExamples(moreExamples.data);
  };

  return (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Typography variant="body1" sx={{ textDecoration: 'dashed underline green', }}><strong>{exercise.type}</strong></Typography>
        <Typography variant="body1"><strong>Original:</strong> {exercise.original}</Typography>
        <Typography variant="body1"><strong>Rewrite Exercise:</strong> {exercise.rewriteExercise}</Typography>

        <FormControlLabel
          control={<Switch checked={isExampleVisible} onChange={toggleExampleVisibility} />}
          label="Show Example"
        />
       {isExampleVisible && (
          <>
            <Typography variant="body1" sx={{ marginTop: 1 }}>
              <strong>Example:</strong> {exercise.example}
              <IconButton onClick={fetchMoreExamples} aria-label="more">
                <MoreHorizIcon />
              </IconButton>
            </Typography>
            {additionalExamples.map((ad, index) => (
               <ExerciseCard key={index} exercise={ad} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};


function ComparisonExercise({mywritingComparison}) {

  return (
    <Paper sx={{ width: '100%', margin: '4px', padding: '4px' }}>
      <Typography variant="h6" sx={{ textDecoration: 'underline red', }}>Errors and Unnatural Usage:</Typography>
      {mywritingComparison.issues.map((issue, index) => (
        <Card  key={index}>
          <CardContent>
            <Typography variant="body1" >
              [{index}]<strong> {issue.type} </strong>
            </Typography>
            <Typography variant="body2" >
              {issue.explain}
            </Typography>
          </CardContent>
        </Card>
      ))}
      <Typography variant="h6" sx={{ textDecoration: 'underline red', }}>Exercises to Correct Mistakes:</Typography>
      {mywritingComparison.exercises.map((exercise, index) => (
        <ExerciseCard  key={index} exercise={exercise} />
      ))}
    </Paper>
  );
}

export default ComparisonExercise;
