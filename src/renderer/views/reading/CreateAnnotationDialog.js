import * as React from 'react';

import Popover from '@mui/material/Popover';

import CreateAnnotationPanel from './CreateAnnotationPanel';

/**
 * Popover wrapper around CreateAnnotationPanel. The panel owns its own
 * style/color/emoji state and invokes `handleWindowClose` directly with
 * its own selection — this wrapper doesn't need to mirror that state.
 */
function CreateAnnotationDialog({
  handleWindowClose,
  popupLoc,
  open,
  showImageOption,
  showPresentOption,
}) {
  // No-op stubs satisfy the panel's prop expectations without resurrecting
  // the dead mirrored state the wrapper used to hold.
  const noop = () => {};
  return (
    <Popover
      onClose={() => handleWindowClose(undefined)}
      open={open}
      anchorReference="anchorPosition"
      anchorPosition={popupLoc}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
    >
      <CreateAnnotationPanel
        handleWindowClose={handleWindowClose}
        showImageOption={showImageOption}
        showPresentOption={showPresentOption}
        setMarkColor={noop}
        setMarkType={noop}
        setEmoji={noop}
      />
    </Popover>
  );
}

export default CreateAnnotationDialog;
