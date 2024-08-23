import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';

const MyCard = styled((props) => {
  const { isActive, ...other } = props;
  return <Card {...other} />;
})(({ theme, isActive }) => ({
  cursor: 'pointer',
  height: '100%',
  borderColor: isActive ? "blue' !important" : undefined,
  borderRadius: 4,
  padding: 4, // theme.spacing.lg,
  // boxShadow: theme.shadows.xs,
  ':hover': {
    borderColor: "red' !important",
  },
}));

function CharacterCard({
  character,
  onClick,
  selectedIndex,
  i,
}: {
  character: { name: string; description: string };
  onClick: any;
  selectedIndex: number;
  i: number;
}) {
  const isActive = selectedIndex === i;
  return (
    <Grid xs={6} md={4}>
      <MyCard isActive={isActive} component="a" onClick={onClick}>
        <CardHeader>
          <Typography>{character.name}</Typography>
        </CardHeader>

        <CardContent>
          <Typography>{character.description}</Typography>
        </CardContent>
      </MyCard>
    </Grid>
  );
}

export default CharacterCard;
