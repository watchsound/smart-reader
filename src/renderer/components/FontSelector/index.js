// src/components/FontSelector.js
import React, { useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const fonts = [
  'Arial',
  'Courier New',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Comic Sans MS',
  'Tahoma',
  'Trebuchet MS',
  'Lucida Console',
  'Segoe UI',
];

function FontSelector({ onFontChange }) {
  const [selectedFont, setSelectedFont] = useState('Arial');

  const handleFontChange = (event) => {
    setSelectedFont(event.target.value);
    onFontChange(event.target.value);
  };

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="font-selector-label">Font Family</InputLabel>
      <Select
        labelId="font-selector-label"
        value={selectedFont}
        onChange={handleFontChange}
        label="Font Family"
      >
        {fonts.map((font) => (
          <MenuItem key={font} value={font}>
            {font}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default FontSelector;
// const App = () => {
//   const [fontFamily, setFontFamily] = useState('Arial');

//   const theme = createTheme({
//     typography: {
//       fontFamily: fontFamily,
//     },
//   });

//   return (
//     <ThemeProvider theme={theme}>
//       <div style={{ padding: 20 }}>
//         <FontSelector onFontChange={setFontFamily} />
//         <div style={{ marginTop: 20, fontFamily: fontFamily }}>
//           <p>The quick brown fox jumps over the lazy dog.</p>
//         </div>
//       </div>
//     </ThemeProvider>
//   );
// };

// export default App;
