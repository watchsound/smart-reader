import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import ArrowRightAltOutlinedIcon from '@mui/icons-material/ArrowRightAltOutlined';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

function CorrectionCard2({ type, original, corrected, explain }) {
  const [color, setColor] = React.useState('red');

  React.useEffect(() => {
    setColor(mapToPredefinedColor(type));
  }, [type]);

  return (
    <Card variant="outlined" sx={{ maxWidth: 345 }}>
      <CardHeader
        title={
          <Typography
            variant="caption"
            sx={{ backgroundColor: color, color: '#FFFFFF', margin: '2px' }}
          >
            {type}
          </Typography>
        }
      />
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export default CorrectionCard2;
