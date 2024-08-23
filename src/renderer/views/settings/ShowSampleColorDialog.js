import * as React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import Popover from '@mui/material/Popover';

const sampleData = `
{
  "levels": {
    "middleschool": "0",
    "highschool": "1",
    "college": "2",
    "advanced": "3"
  },
  "colors": {
    "0": "#42a5f5",
    "1": "#ba68c8",
    "2": "#FF5733",
    "3": "#ff9800"
  },
  "words": {
    "0": [
      "towards",
      "secrecy",
      "exclusivity",
      "organization",
      "maintaining",
      "cooperation"
    ],
    "1": [
      "entire",
      "entirely",
      "power",
      "curtain",
      "dusty",
      "partner",
      "settle",
      "emphasize",
      "mission",
      "development",
      "transparent",
      "research",
      "collaborative",
      "accessible",
      "environment",
      "advancement"
    ],
    "2": [
      "highlights",
      "commitment",
      "openness",
      "transparency",
      "collaboration",
      "choice",
      "reflects",
      "founders",
      "vision",
      "beneficial",
      "doubtless",
      "implysecretive",
      "isolated",
      "approach"
    ],
    "3": [
      "development",
      "contrary",
      "core",
      "goals"
    ]
  }
}
`;

function ShowSampleColorDialog({
  vocabulary,
  anchorEl,
  handleWindowClose,
  open,
}) {
  return (
    <Popover
      onClose={() => handleWindowClose()}
      open={open}
      anchorOrigin={{
        vertical: 'center',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      anchorEl={anchorEl.current}
    >
      <Card>
        <CardContent sx={{ maxHeight: 320, overflowY: 'auto' }}>
          <pre>{sampleData}</pre>
        </CardContent>
      </Card>
    </Popover>
  );
}

export default ShowSampleColorDialog;
