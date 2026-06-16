/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**

CREATE TABLE "bookmark_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "parent_group_id" INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER,
  FOREIGN KEY ("parent_group_id") REFERENCES "bookmark_group"("id")
);



 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt , } from './dbManager';

/**
 *
 * @param {*} name
 * @param {*} token
 * @returns  if failed null.
 */
export const getBookmarkGroupByName= (name, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM bookmark_group WHERE group_name = ? AND user_id = ?');
    const group = stmt.get(name, userId);
    if (group) return {
      id : group.id,
      groupName:  group.group_name || '',
      parentGroupId: group.parent_group_id,
      createdAt : group.created_at,
      userId: group.user_id,
    };
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} parentGroupId
 * @param {*} name
 * @param {*} token
 * @returns { groupName: name, parentGroupId }; if success , add id field
 */
export const createBookmarkGroup= (parentGroupId, name, token) => {
  const group = { groupName: name, parentGroupId };
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return group;
  }
  addUserIdCreatedAt(group, userId);
  const createdAt =  group.createdAt || '';
  try {
    const stmt = db.prepare(
      'INSERT INTO bookmark_group (group_name, parent_group_id, created_at, user_id) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(name, parentGroupId, createdAt, userId);
    group.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return group;
};

/**
 *
 * @param {*} token
 * @returns []
 */
export const getTopBookmarkGroup = (token) => {
  const bookmarkGroups = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmarkGroups;
  }
  try {
    const stmt = db.prepare('SELECT * FROM bookmark_group WHERE parent_group_id IS NULL AND user_id = ?')
                   .bind(userId);
    for (const card of stmt.iterate()) {
       bookmarkGroups.push({
          id : card.id,
          groupName:  card.group_name || '',
          parentGroupId: card.parent_group_id,
          createdAt: card.created_at,
          userId: card.user_id,
       });
    }
    return bookmarkGroups;
  } catch (err) {
    console.error(err);
    return bookmarkGroups;
  }
};

/**
 *
 * @param {*} id
 * @param {*} name
 * @param {*} token
 * @returns 1 or -1
 */
export function renameBookmarkGroup(id, name, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        UPDATE bookshelf SET group_name = '${name}'
        WHERE id = ${id} AND user_id = ${userId}
    `;
    const query = db.prepare(sql);
    query.run();
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

const recursiveDepthQuery = `
  WITH RECURSIVE GroupTree AS (
      SELECT id, group_name, parent_group_id, 0 AS depth
      FROM bookmark_group
      WHERE parent_group_id IS NULL
      UNION ALL
      SELECT g.id, g.group_name, g.parent_group_id, gt.depth + 1
      FROM bookmark_group g
      JOIN GroupTree gt ON g.parent_group_id = gt.id
  )
  SELECT id, group_name, depth FROM GroupTree ORDER BY depth, id;

`;

/**
 *
 * @param {*} token
 * @returns string content or ''
 */
export const printBookmarkGroupStructure = (gapChar, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return '';
  }
   try {
    const stmt = db.prepare(recursiveDepthQuery);
    const rows = stmt.all();
    const rs = [];
    rows.forEach(({ id, group_name, depth }) => {
        const indent = (gapChar|| '-').repeat(depth);  // Using repeat() for indentation
        rs.push(`${indent}${group_name}`);
    });
    return rs.join('\n');
  } catch (err) {
    console.error(err);
    return '';
  }
};

// const recursiveJsonQuery = `
//   WITH RECURSIVE GroupTree AS (
//       SELECT id, group_name, parent_group_id
//       FROM bookmark_group
//       WHERE parent_group_id IS NULL
//       UNION ALL
//       SELECT g.id, g.group_name, g.parent_group_id
//       FROM bookmark_group g
//       JOIN GroupTree gt ON g.parent_group_id = gt.id
//   )
//   SELECT id, group_name, parent_group_id FROM GroupTree ORDER BY parent_group_id, id;

// `;

// /**
//  *
//  * @param {*} token
//  * @returns json object or Null
//  */
// export const jsonBookmarkGroupStructure = ( token) => {
//   const userId = getUserIdFromToken(token);
//   if( userId < 0) {
//     console.warn('session is invalid, userid not found')
//     return null;
//   }
//    try {
//     const stmt = db.prepare(recursiveJsonQuery);
//     const rows = stmt.all();
//     const tree = {
//         id: -1,
//         name: 'Common Tags',
//         children: []
//     };
//     const nodeMap = new Map();
//     nodeMap.set(null, tree);

//     rows.forEach(({ id, group_name, parent_group_id }) => {
//         const node = {
//             id: id,
//             name: group_name,
//             children: []
//         };
//          const parent = nodeMap.get(parent_group_id);
//          if(  parent  ) {
//             const c =parent.children.find((item) => item.id === id);
//             if (!c) parent.children.push(node);
//          } else {
//            console.log('error for ' + group_name)
//          }
//          nodeMap.set(id, node);
//     });
//     console.log( JSON.stringify(tree));
//     return tree;
//   } catch (err) {
//     console.error(err);
//     return null;
//   }
// };

const recursiveJsonQueryWithCount = `
  WITH RECURSIVE GroupTree AS (
      SELECT id, group_name, parent_group_id
      FROM bookmark_group
      WHERE parent_group_id IS NULL
      UNION ALL
      SELECT g.id, g.group_name, g.parent_group_id
      FROM bookmark_group g
      JOIN GroupTree gt ON g.parent_group_id = gt.id
  ),
  BookmarkCounts AS (
      SELECT group_id, COUNT(*) as bookmark_count
      FROM bookmark
      GROUP BY group_id
  )
  SELECT gt.id, gt.group_name, gt.parent_group_id, IFNULL(bc.bookmark_count, 0) as bookmark_count
  FROM GroupTree gt
  LEFT JOIN BookmarkCounts bc ON gt.id = bc.group_id
  ORDER BY gt.parent_group_id, gt.id;
`;
/**
 *
 * @param {*} token
 * @returns json object or Null
 */
export const jsonBookmarkGroupStructure = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return null;
  }
  try {
    const stmt = db.prepare(recursiveJsonQueryWithCount);
    const rows = stmt.all();
    const tree = {
      id: -1,
      name: 'Common Tags',
      bookmark_count: 0,
      children: []
    };
    const nodeMap = new Map();
    nodeMap.set(null, tree);

    rows.forEach(({ id, group_name, parent_group_id, bookmark_count }) => {
      const node = {
        id: id,
        name: group_name,
        bookmarkCount: bookmark_count,
        children: []
      };
      const parent = nodeMap.get(parent_group_id);
      if (parent) {
        const c = parent.children.find((item) => item.id === id);
        if (!c) parent.children.push(node);
      } else {
        console.log('error for ' + group_name);
      }
      nodeMap.set(id, node);
    });
    console.log(JSON.stringify(tree));
    return tree;
  } catch (err) {
    console.error(err);
    return null;
  }
};
