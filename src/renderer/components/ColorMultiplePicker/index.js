// src/components/ColorPicker.js
import React, { useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const ColorBox = styled(Box)(({ color }) => ({
  width: 16,
  height: 16,
  backgroundColor: color,
  border: '1px solid #ccc',
  borderRadius: '4px',
  display: 'inline-block',
  marginRight: 4,
}));


const colorOptions = [
  ['#000000', '#FFFFFF', '#000000'], // Black border, White background, Black text
  ['#FFFFFF', '#000000', '#FFFFFF'],
  ['#FF5733', '#FFC300', '#900C3F'], // Bright Orange border, Bright Yellow background, Dark Magenta text
  ['#DAF7A6', '#FF5733', '#C70039'], // Light Green border, Bright Orange background, Dark Red text
  ['#FFC300', '#DAF7A6', '#581845'], // Bright Yellow border, Light Green background, Dark Purple text
  ['#FF5733', '#C70039', '#DAF7A6'], // Bright Orange border, Dark Red background, Light Green text
  ['#C70039', '#FF5733', '#DAF7A6'], // Dark Red border, Bright Orange background, Light Green text
  ['#900C3F', '#FFC300', '#FF5733'], // Dark Magenta border, Bright Yellow background, Bright Orange text
  ['#FF5733', '#900C3F', '#FFC300'], // Bright Orange border, Dark Magenta background, Bright Yellow text
  ['#DAF7A6', '#FFC300', '#C70039'], // Light Green border, Bright Yellow background, Dark Red text
  ['#FFC300', '#FF5733', '#DAF7A6'], // Bright Yellow border, Bright Orange background, Light Green text
  ['#C70039', '#DAF7A6', '#FF5733'], // Dark Red border, Light Green background, Bright Orange text
  ['#FF5733', '#FFC300', '#900C3F'], // Bright Orange border, Bright Yellow background, Dark Magenta text
  ['#DAF7A6', '#C70039', '#FF5733'], // Light Green border, Dark Red background, Bright Orange text
  ['#FFC300', '#900C3F', '#DAF7A6'], // Bright Yellow border, Dark Magenta background, Light Green text
  ['#C70039', '#FF5733', '#FFC300'], // Dark Red border, Bright Orange background, Bright Yellow text
  ['#900C3F', '#DAF7A6', '#C70039'], // Dark Magenta border, Light Green background, Dark Red text
  ['#FF5733', '#FFC300', '#DAF7A6'], // Bright Orange border, Bright Yellow background, Light Green text
  ['#DAF7A6', '#C70039', '#FFC300'], // Light Green border, Dark Red background, Bright Yellow text
  ['#FFC300', '#FF5733', '#900C3F'], // Bright Yellow border, Bright Orange background, Dark Magenta text
  ['#C70039', '#DAF7A6', '#FF5733'], // Dark Red border, Light Green background, Bright Orange text
  ['#900C3F', '#FFC300', '#DAF7A6'],  // Dark Magenta border, Bright Yellow background, Light Green text

  ['#FF0000', '#FFFFFF', '#000000'], // Red border, White background, Black text
  ['#FF6F61', '#6B5B95', '#88B04B'], // Bright Red, Bright Purple, Bright Green
  ['#F7CAC9', '#92A8D1', '#F7786B'], // Bright Pink, Bright Blue, Bright Coral
  ['#FF9E80', '#FF6E40', '#FF3D00'], // Bright Peach, Bright Orange, Bright Red-Orange
  ['#FFD700', '#FFAA1D', '#FFA500'], // Bright Yellow, Bright Gold, Bright Orange
  ['#B0E57C', '#86E3CE', '#75DDDD'], // Bright Lime, Bright Mint, Bright Cyan
  ['#00BFFF', '#1E90FF', '#6495ED'], // Bright Sky Blue, Bright Dodger Blue, Bright Cornflower Blue
  ['#FF69B4', '#FF1493', '#FF00FF'], // Bright Hot Pink, Bright Deep Pink, Bright Magenta
  ['#FFB6C1', '#FF6F61', '#FF4500'], // Bright Light Pink, Bright Red, Bright Orange-Red
  ['#ADFF2F', '#7FFF00', '#32CD32'], // Bright Green Yellow, Bright Chartreuse, Bright Lime Green
  ['#00FA9A', '#00FF7F', '#3CB371'], // Bright Medium Spring Green, Bright Spring Green, Bright Medium Sea Green
  ['#40E0D0', '#48D1CC', '#20B2AA'], // Bright Turquoise, Bright Medium Turquoise, Bright Light Sea Green
  ['#7B68EE', '#6A5ACD', '#483D8B'], // Bright Medium Slate Blue, Bright Slate Blue, Bright Dark Slate Blue
  ['#FF6347', '#FF4500', '#FF7F50'], // Bright Tomato, Bright Orange Red, Bright Coral
  ['#BA55D3', '#9932CC', '#9400D3'], // Bright Orchid, Bright Dark Orchid, Bright Dark Violet
  ['#FF1493', '#FF69B4', '#FFB6C1'], // Bright Deep Pink, Bright Hot Pink, Bright Light Pink
  ['#FFA07A', '#FA8072', '#E9967A'], // Bright Light Salmon, Bright Salmon, Bright Dark Salmon
  ['#EE82EE', '#DA70D6', '#DDA0DD'], // Bright Violet, Bright Orchid, Bright Plum
  ['#00CED1', '#40E0D0', '#48D1CC'], // Bright Dark Turquoise, Bright Turquoise, Bright Medium Turquoise
  ['#98FB98', '#90EE90', '#8FBC8F'], // Bright Pale Green, Bright Light Green, Bright Dark Sea Green
  ['#FFD700', '#FFA500', '#FF8C00'], // Bright Gold, Bright Orange, Bright Dark Orange
  ['#FF5733', '#C70039', '#900C3F'], // Border: Red-Orange, Background: Deep Pink, Text: Dark Magenta
  ['#3498DB', '#2980B9', '#2E4053'], // Border: Sky Blue, Background: Dark Sky Blue, Text: Dark Slate Gray
  ['#2ECC71', '#27AE60', '#145A32'], // Border: Green, Background: Dark Green, Text: Dark Olive Green
  ['#F1C40F', '#F39C12', '#7D6608'], // Border: Yellow, Background: Orange, Text: Dark Yellow
  ['#E74C3C', '#C0392B', '#641E16'], // Border: Red, Background: Dark Red, Text: Dark Maroon
  ['#9B59B6', '#8E44AD', '#4A235A'], // Border: Light Purple, Background: Dark Purple, Text: Dark Purple
  ['#1ABC9C', '#16A085', '#0E6251'], // Border: Light Sea Green, Background: Sea Green, Text: Dark Slate Gray
  ['#F5B041', '#D68910', '#7E5109'], // Border: Light Orange, Background: Dark Orange, Text: Dark Brown
  ['#E67E22', '#D35400', '#784212'], // Border: Orange, Background: Dark Orange, Text: Dark Orange Brown
  ['#EC7063', '#AF7AC5', '#76448A'], // Border: Light Red, Background: Light Purple, Text: Dark Purple
  ['#5DADE2', '#5499C7', '#1F618D'], // Border: Light Blue, Background: Medium Blue, Text: Dark Blue
  ['#48C9B0', '#45B39D', '#0B5345'], // Border: Light Green, Background: Medium Green, Text: Dark Green
  ['#F4D03F', '#F0B27A', '#784212'], // Border: Light Yellow, Background: Light Orange, Text: Dark Brown
  ['#EB984E', '#DC7633', '#5B2C6F'], // Border: Light Orange, Background: Medium Orange, Text: Dark Purple
  ['#AED6F1', '#5DADE2', '#21618C'], // Border: Light Blue, Background: Medium Blue, Text: Dark Blue
  ['#A3E4D7', '#48C9B0', '#0B5345'], // Border: Light Aqua, Background: Aqua, Text: Dark Aqua
  ['#F9E79F', '#F7DC6F', '#7D6608'], // Border: Light Yellow, Background: Medium Yellow, Text: Dark Yellow
  ['#EDBB99', '#E59866', '#784212'], // Border: Light Coral, Background: Coral, Text: Dark Coral
  ['#D7BDE2', '#C39BD3', '#5B2C6F'], // Border: Light Purple, Background: Medium Purple, Text: Dark Purple
  ['#A9DFBF', '#73C6B6', '#0E6251'], // Border: Light Green, Background: Medium Green, Text: Dark Green
  ['#0000FF', '#FFFFFF', '#000000'], // Blue border, White background, Black text
  ['#00FF00', '#FFFFFF', '#000000'], // Green border, White background, Black text
  ['#FFA500', '#FFFFFF', '#000000'], // Orange border, White background, Black text
  ['#800080', '#FFFFFF', '#000000'], // Purple border, White background, Black text
  ['#008080', '#FFFFFF', '#000000'], // Teal border, White background, Black text
  ['#FFC0CB', '#FFFFFF', '#000000'], // Pink border, White background, Black text
];


function ColorMultiplePicker({ onColorChange }) {
  const [selectedColors, setSelectedColors] = useState(colorOptions[0]);
  const [open, setOpen] = useState(false);

  const handleColorChange = (event) => {
    const newColors = event.target.value;
    setSelectedColors(newColors);
    onColorChange(newColors);
    setOpen(false);
  };

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="color-picker-label">Color Combination</InputLabel>
      <Select
        labelId="color-picker-label"
        value={selectedColors}
        onChange={handleColorChange}
        renderValue={(selected) => (
          <Box display="flex" alignItems="center">
            {selected.map((color, index) => (
              <ColorBox key={index} color={color} />
            ))}
          </Box>
        )}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 48 * 4.5 + 8,
              width: 250,
            },
          },
        }}
      >
        {colorOptions.map((colors, index) => (
          <MenuItem key={index} value={colors}>
            <Box display="flex" alignItems="center">
              {colors.map((color, idx) => (
                <ColorBox key={idx} color={color} />
              ))}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};


export default ColorMultiplePicker;
