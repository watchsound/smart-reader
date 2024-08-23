/* eslint-disable prettier/prettier */
import * as React from 'react';
import { useTheme } from '@mui/material/styles';

import ButtonGroup from '@mui/material/ButtonGroup';


import { colorsMui as colors } from '../../../commons/utils/colors';
import SmallButton from '../Button/SmallButton';

function ColorPicker({ getInitialSelection, selectionCallback, orientation }) {
  const theme = useTheme();
  const onColorSelection = (markColor) => {
    selectionCallback(theme.palette[markColor].main);
  };

  const colorButtons = colors.map((color, i) => (
    <SmallButton
      key={i}
      onClick={() => {
        onColorSelection(color);
      }}
      variant="contained"
      color={color}
    >
      {getInitialSelection() === color ? '...' : '.'}
    </SmallButton>
  ));

  return (
    <ButtonGroup orientation={orientation} variant="contained">{colorButtons}</ButtonGroup>
  );
}

export default ColorPicker;
