import { useState, useEffect } from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { cardImageOverlapTemplateId as templateIds } from '../../components/cardsetting/card-templates';

function LayoutOptions({ overlap, onLayoutOptionChanges }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(overlap);
  }, [overlap]);

  const handleChange = (event) => {
    setValue(event.target.value);
    onLayoutOptionChanges(event.target.value);
  };

  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 40 }}>
      <InputLabel id="demo-simple-select-standard-label">Overlap</InputLabel>
      <Select
        labelId="demo-simple-select-standard-label"
        id="demo-simple-select-standard"
        value={value}
        onChange={handleChange}
        label="Layout"
      >
        <MenuItem value={0}>
          <em>None</em>
        </MenuItem>
        <MenuItem value={templateIds[0]}>Top</MenuItem>
        <MenuItem value={templateIds[1]}>Center</MenuItem>
        <MenuItem value={templateIds[2]}>Bottom</MenuItem>
      </Select>
    </FormControl>
  );
}

export default LayoutOptions;
