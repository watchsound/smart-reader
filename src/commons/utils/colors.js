// Slack-style color palette
export const colors = [
  '#1d9bd1',  // Slack blue
  '#2eb67d',  // Slack green
  '#e01e5a',  // Slack red/pink
  '#ecb22e',  // Slack yellow
  '#611f69',  // Slack aubergine
  '#1d1c1d',  // Slack dark
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
