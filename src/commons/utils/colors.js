


export const colors = [
  '#42a5f5',
  '#ba68c8',
  '#FF5733',
  '#FFFFFF',
  '#ff9800',
  '#4caf50',
];

export const colorsMui = [
  'primary',
  'secondary',
  'error',
  'warning',
  'white',
  'info',
  'success',
];

export function color2mui(color, theme) {
  const labels = colorsMui.filter((m) => theme.palette[m].main === color );
  return labels.length > 0 ? labels[0] : colorsMui[0];
}
