/**
 * Tests for getJumpToSourcePath — the pure routing rules extracted from
 * CardHeaderNoSwitch.tryToJumpToSource.
 *
 * Pins the fix for a long-standing bug: the previous implementation
 * branched on `note.type` but every createNote caller in the codebase
 * (Browser, MessageItem, HeaderQuickActions, QuickNoteDialog,
 * InteractiveList, LearnAboutDetailPanel, CreateNotePanel,
 * MoodBoardOrganizerService) writes `sourceType`. So the menu item
 * silently no-op'd for every note. This test would fail under the old
 * code, which is the point.
 */

import { getJumpToSourcePath } from '../../renderer/components/note/CardHeaderNoSwitch';
import { NoteType } from '../../commons/model/Note';

describe('getJumpToSourcePath', () => {
  it('returns null for missing note', () => {
    expect(getJumpToSourcePath(null)).toBeNull();
    expect(getJumpToSourcePath(undefined)).toBeNull();
  });

  it('returns null when sourceType is unknown / not set', () => {
    expect(getJumpToSourcePath({ sourceKey: 'k' })).toBeNull();
    expect(getJumpToSourcePath({ sourceType: 'something-else', sourceKey: 'k' })).toBeNull();
    // The bug-this-test-pins: notes have `sourceType`, not `type`. If a
    // future refactor reverts to reading `.type` this assertion fails.
    expect(
      getJumpToSourcePath({ type: NoteType.Book, sourceKey: 'b1' }),
    ).toBeNull();
  });

  describe('Book sourceType', () => {
    it('returns /reading path when sourceKey + cfi present', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Book,
          sourceKey: 'book42',
          cfi: 'epubcfi(/6/8!/4/2)',
          id: 100,
        }),
      ).toBe('/reading/book42/100');
    });

    it('returns /reading path when sourceKey + position present', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Book,
          sourceKey: 'book42',
          position: [1, 2, 3],
          id: 100,
        }),
      ).toBe('/reading/book42/100');
    });

    it('returns null when sourceKey missing', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Book,
          cfi: 'cfi',
          id: 100,
        }),
      ).toBeNull();
    });

    it('returns null when neither cfi nor position present', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Book,
          sourceKey: 'book42',
          id: 100,
        }),
      ).toBeNull();
    });

    it('returns null when position is an empty array (no jump anchor)', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Book,
          sourceKey: 'book42',
          position: [],
          id: 100,
        }),
      ).toBeNull();
    });
  });

  describe('Url sourceType', () => {
    it('returns /browser path when sourceKey present', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Url,
          sourceKey: 'bookmark_5',
        }),
      ).toBe('/browser/bookmark_5');
    });

    it('returns null when sourceKey missing', () => {
      expect(getJumpToSourcePath({ sourceType: NoteType.Url })).toBeNull();
    });
  });

  describe('Chat sourceType', () => {
    it('returns /chat path when sourceKey present', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Chat,
          sourceKey: 'chat_abc',
        }),
      ).toBe('/chat/chat_abc');
    });

    it('returns null when sourceKey missing', () => {
      expect(getJumpToSourcePath({ sourceType: NoteType.Chat })).toBeNull();
    });
  });

  describe('Note + LearningPoint sourceTypes (no jump rule yet)', () => {
    it('returns null for plain Note', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.Note,
          sourceKey: 'whatever',
        }),
      ).toBeNull();
    });

    it('returns null for LearningPoint (no route exists yet)', () => {
      expect(
        getJumpToSourcePath({
          sourceType: NoteType.LearningPoint,
          sourceKey: 'lp_1',
        }),
      ).toBeNull();
    });
  });
});
