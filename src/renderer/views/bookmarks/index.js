import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Grid, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { v4 as uuid } from 'uuid';
import { useSelector, useDispatch } from 'react-redux';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';

import customStorage from '../../store/customStorage';
import BookmarkUI from './BookmarkUI';
import TextSearchRow from '../../components/TextSearchRow';

function RenderTree(node, onClick) {
  let label = node.bookmarkCount > 0 ? `${node.name} [${node.bookmarkCount}]`  : node.name;
  return (
    <TreeItem
      key={node.id}
      onClick={() => onClick(node)}
      itemId={node.id.toString()}
      label={ label || 'Not Classified Yet'}
      collapseicon={<ExpandMoreIcon />}
      expandicon={<ChevronRightIcon />}
    >
      {Array.isArray(node.children)
        ? node.children.map((childNode) => RenderTree(childNode, onClick))
        : null}
    </TreeItem>
  );
}

function BookmarksPage() {
  const [treeData, setTreeData] = React.useState(null);
  const [bookmarks, setBookmarks] = React.useState([]);
  const [expandedItems, setExpandedItems] = React.useState([]);
  const navigate = useNavigate();

  const handleExpandedItemsChange = (event, itemIds) => {
    setExpandedItems(itemIds);
  };

  const searchBookmark = async (text) => {
    const r = await customStorage.getBookmarkByQuery(text);
    if (r) setBookmarks(r);
  };

  React.useEffect(() => {
    async function t() {
      const d = await customStorage.jsonBookmarkGroupStructure();
      setTreeData(d);
      setExpandedItems([d.id.toString()]);
    }
    t();
  }, []);

  const handleNodeClick = async (node) => {
    console.log('Clicked node', node.id);
    const b = await customStorage.getBookmarksByGroupId(node.id);
    setBookmarks(b);
  };

  const handleBookmarkClick = (note) => {
    const urlString = encodeURIComponent(note.sourceKey);
    const escapedUrl = urlString.replace(/\//g, '\\/');
    navigate(`/browser/${escapedUrl}`);
  };

  return (
    <Grid container spacing={2} sx={{ width: '100%', height: '100vh' }}>
      {/* Left Column */}
      <Grid item xs={9}>
        <Grid container spacing={2}>
          {bookmarks.length > 0 &&
            bookmarks.map((note) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                sx={{ minWidth: '360px' }}
                key={note.id}
              >
                <BookmarkUI
                  key={note.id}
                  curBookmark={note}
                  cardWidth="100%"
                  cardHeight="200px"
                  selectHandler={() => {
                    handleBookmarkClick(note);
                  }}
                />
              </Grid>
            ))}
        </Grid>
      </Grid>
      {/* Right Column - Collapsible */}
      <Grid item xs={3} style={{ width: '300px' }}>
        <TextSearchRow
          placeHolder="Search"
          label="content"
          sx={{ width: '320px', borderStyle: 'none' }}
          searchAction={(text) => searchBookmark(text)}
        />
        <Box sx={{ width: '100%' }}>
          {treeData && (
            <SimpleTreeView
              expandedItems={expandedItems}
              onExpandedItemsChange={handleExpandedItemsChange}
            >
              {RenderTree(treeData, handleNodeClick)}
            </SimpleTreeView>
          )}
        </Box>
      </Grid>
    </Grid>
  );
}
export default BookmarksPage;
