/* eslint-disable prettier/prettier */
import * as React from 'react';
import Box from '@mui/material/Box';
import { Paper } from '@mui/material';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';

import { steps, stepsInfo } from "./config";
import SmallButton from '../../components/Button/SmallButton';

export default function WritingStepper({stepsCallback}) {
  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set());

  const isStepOptional = (step) => {
    return step === -1;
  };

  const isStepSkipped = (step) => {
    return skipped.has(step);
  };

  const handleNext = () => {
    let newSkipped = skipped;
    if (isStepSkipped(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    stepsCallback(steps[activeStep+1])
    setSkipped(newSkipped);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
     stepsCallback(steps[activeStep-1])
  };

  const handleSkip = () => {
    if (!isStepOptional(activeStep)) {
      // You probably want to guard against something like this,
      // it should never occur unless someone's actively trying to break something.
      // throw new Error("You can't skip a step that isn't optional.");
      return;
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
     stepsCallback(steps[activeStep+1])
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
  };

  const handleReset = () => {
    setActiveStep(0);
    stepsCallback(steps[0]);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label, index) => {
          const stepProps = {};
          const labelProps = {};
          if (isStepOptional(index)) {
            labelProps.optional = (
              <Typography variant="caption">Optional</Typography>
            );
          }
          if (isStepSkipped(index)) {
            stepProps.completed = false;
          }
          return (
            <Step key={label} {...stepProps}>
              <StepLabel {...labelProps}>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
      <Paper sx={{margin:'4px', padding: '4px'}}><Typography  variant="body2"> {stepsInfo[activeStep]}</Typography></Paper>

      {activeStep === steps.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Box sx={{ flex: '1 1 auto' }} />
            <SmallButton onClick={handleReset}>Reset</SmallButton>
          </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <SmallButton
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </SmallButton>
            <Box sx={{ flex: '1 1 auto' }} />
            {isStepOptional(activeStep) && (
              <SmallButton color="inherit" onClick={handleSkip} sx={{ mr: 1 }}>
                Skip
              </SmallButton>
            )}

            <SmallButton onClick={handleNext}>
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </SmallButton>
          </Box>
      )}
    </Box>
  );
}
