import { getUserIdFromToken } from './dbManager';
import {
  getTopBookmarkGroup,
  createBookmarkGroup,
} from './BookmarkGroupManager';
import { createBookshelf, getAllBookshelf } from './BookshelfManager';

const initialDatabase = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return;
  // check if table is initialized.
  const tops = getTopBookmarkGroup(token);

  /**
   * 1. Work/Professional
2. Personal
3. News
4. Shopping
5. Reference
6. Social Media
7. Entertainment
8. Health and Wellness
9. Technology
9.1 Computers
9.2 Artificial Intelligence
9.3 Cognitive Theory
10. Education
10.1 STEM
10.2 Social Science
10.3 College Applications
10.4 Educational Theory
   *
   */
  if (tops.length === 0) {
    createBookmarkGroup(null, 'Personal', token);
    createBookmarkGroup(null, 'News', token);
    createBookmarkGroup(null, 'Shopping', token);
    createBookmarkGroup(null, 'Reference', token);
    createBookmarkGroup(null, 'Social Media', token);
    createBookmarkGroup(null, 'Entertainment', token);
    createBookmarkGroup(null, 'Health and Wellness', token);
    const tech = createBookmarkGroup(null, 'Technology', token);
    // If the parent insert silently failed (createBookmarkGroup echoes input
    // without an id on DB error), skip the children — inserting them with
    // parent_group_id=undefined would silently promote them to top-level.
    if (tech?.id != null) {
      createBookmarkGroup(tech.id, 'Computer', token);
      createBookmarkGroup(tech.id, 'Artificial Intelligence', token);
      createBookmarkGroup(tech.id, 'Cognitive Theory', token);
    } else {
      console.warn(
        '[DatabaseInitializer] Technology group insert failed; skipping children',
      );
    }
    const edu = createBookmarkGroup(null, 'Education', token);
    if (edu?.id != null) {
      createBookmarkGroup(edu.id, 'STEM', token);
      createBookmarkGroup(edu.id, 'Social Science', token);
      createBookmarkGroup(edu.id, 'College Applications', token);
      createBookmarkGroup(edu.id, 'Educational Theory', token);
    } else {
      console.warn(
        '[DatabaseInitializer] Education group insert failed; skipping children',
      );
    }
    createBookmarkGroup(null, 'Work/Professional', token);
  }

  const bs = getAllBookshelf(token);
  if (bs.length === 0) {
    createBookshelf('Common', token);
    createBookshelf('Novel', token);
    createBookshelf('Research Paper', token);
    createBookshelf('Math', token);
    createBookshelf('Computer Science', token);
  }
};

export default initialDatabase;
