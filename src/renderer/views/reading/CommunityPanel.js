/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import {
  FormControlLabel,
  Box,
  Checkbox,
  FormGroup,
  Card, CardContent, CardActions, Typography, Grid, Avatar
} from '@mui/material';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';


import {
  communityNoteToggled,
} from '../../store/reducers/readerSlice';
import customStorage from '../../store/customStorage';

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function CommunityPanel({ idFromServer }) {
  // states
  const [annotations, setAnnotations] = useState([]);
  const [serverUrl, setServerUrl] = useState('');
  const showCommunityNote = useSelector((state) => state.reader.showCommunityNote);
  const selectedCommunityNote = useSelector((state) => state.reader.selectedCommunityNote);

  const dispatch = useDispatch();



  useEffect(() => {
    if ( idFromServer < 0 || !selectedCommunityNote) return;
    async function t() {
      try {
          const url = await  customStorage.getServerUrl();
          setServerUrl(url);
          const response = await axios.get(`${url}/api/annotation/byannotationsid?annotationsId=${selectedCommunityNote.id}`);
          if (response.ok || response.status === 200 ) {
            setAnnotations(response.data);
          } else {
            setAnnotations([]);
            console.error('Failed to fetch annotations');
          }
      } catch (error) {
          console.error('Failed to fetch annotation', error);
      }
    }
    t();
  }, [idFromServer, selectedCommunityNote]);


  return (
    <>
     <Box mb={2}>
        <div className="two_end_container">
          <div className="two_end_start">
            <FormGroup aria-label="community-setting" row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showCommunityNote}
                    onChange={() => dispatch(communityNoteToggled(!showCommunityNote))}
                  />
                }
                label="Show Community Note"
              />
            </FormGroup>
          </div>
          <div className="two_end_end" />
        </div>
      </Box>
      <ScrollPane>
        <Grid container spacing={2} sx={{margin:'4px'}}>
      {annotations.map((annotation) => (
          <Card key={annotation.id} variant="outlined">
            <CardContent>
              <Typography variant="body2" color="textSecondary" component="p">
                {annotation.content}
              </Typography>
            </CardContent>
            <CardActions  disableSpacing sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar  sx={{ width: 18, height: 18 }}  src={`${serverUrl}/avatar/${encodeURIComponent(annotation.author)}`} alt={annotation.author} />

                <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                  {annotation.author}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                {new Date(annotation.createTime).toLocaleString()}
              </Typography>
            </CardActions>
          </Card>
      ))}
    </Grid>
      </ScrollPane>
    </>
  );
}

export default CommunityPanel;
