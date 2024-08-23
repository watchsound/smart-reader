import { IconButton, Radio, Tooltip } from '@mui/material';
import QuizIcon from '@mui/icons-material/Quiz';

function PageSwitcher({
  selectedNote,
  edit,
  selectedSide,
  handleSideChange,
  openQuizView,
}) {
  const hasCard1 =
    selectedNote.cards[1] &&
    (selectedNote.cards[1].text ||
      selectedNote.cards[1].image ||
      selectedNote.cards[1].data);
  const hasCard2 =
    selectedNote.cards[2] &&
    (selectedNote.cards[2].text ||
      selectedNote.cards[2].image ||
      selectedNote.cards[2].data);
  if (edit || hasCard1 || hasCard2 || selectedNote.hasQuiz)
    return (
      <>
        <Radio
          checked={selectedSide == 0}
          onChange={handleSideChange}
          value="0"
          name="radio-buttons"
          size="small"
          disabled={selectedSide > 1}
          inputProps={{ 'aria-label': '0' }}
        />
        {(edit || hasCard1) && (
          <Radio
            checked={selectedSide == 1}
            onChange={handleSideChange}
            value="1"
            name="radio-buttons"
            size="small"
            inputProps={{ 'aria-label': '1' }}
          />
        )}
        {(edit || hasCard2) && (
          <Radio
            checked={selectedSide == 2}
            onChange={handleSideChange}
            value="2"
            size="small"
            name="radio-buttons"
            disabled={selectedSide < 1}
            inputProps={{ 'aria-label': '2' }}
          />
        )}
        {selectedNote.hasQuiz && openQuizView && (
          <Tooltip title="Quiz">
            <IconButton
              size="small"
              onClick={() => {
                openQuizView();
              }}
              aria-label="edit"
            >
              <QuizIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </>
    );
  return <div />;
}

export default PageSwitcher;
