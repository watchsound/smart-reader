/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
CREATE TABLE image (
  "id" TEXT,
  "data" TEXT,
  "hashcode" INTEGER
);
 *
 */
// import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

import db from './dbManager';
import { isPlainObject } from '../../commons/utils/CommonLangUtil';


export function stableValueHash(value) {
  return JSON.stringify(value, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key]
            return result
          }, {})
      : val
  )
}


export function hashCode(obj) {
  const str = stableValueHash(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
  // let hash = 0;
  // let i;
  // let chr;
  // if (str.length === 0) return hash;
  // for (i = 0; i < str.length; i++) {
  //   chr = str.charCodeAt(i);
  //   hash = (hash << 5) - hash + chr;
  //   hash |= 0; // Convert to 32bit integer
  // }
  // return hash;
}
/**
 *
 * @param {*} id
 * @returns null if failed
 */
export const getImage = (id) => {
  try {
    const stmt = db.prepare('SELECT * FROM image WHERE id = ? ');
    const image = stmt.get(id);
    return image ? image.data : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} id
 * @param {*} data
 * @returns 1 or -1
 */
export const createImage = ( image ) => {
  try {
    const hashcode = hashCode(image);
    const stmt = db.prepare(`SELECT * FROM image WHERE hashcode   = ? `);
    const itr = stmt.iterate(hashcode);
    for (const row of itr) {
       if (row.data === image) return row;
    }
   //  const id = uuid();
    const stmt2 = db.prepare(
      'INSERT INTO image ( data, hashcode) VALUES (?, ?) '
    );
    const result = stmt2.run(image, hashcode);
    const id = result.lastInsertRowid;

    return {
      id,
      image,
      hashcode,
    };
  } catch (err) {
    console.error(err);
  }
  return { id: -1 };
};
