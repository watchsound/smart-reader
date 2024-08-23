/* eslint-disable prettier/prettier */
export function dateToSQLiteString(date) {
  // Takes a JavaScript Date object and converts it to a string in SQLite format
  const year = date.getFullYear();
  const month = `0${date.getMonth() + 1}`.slice(-2); // Months are 0-based
  const day = `0${date.getDate()}`.slice(-2);
  const hours = `0${date.getHours()}`.slice(-2);
  const minutes = `0${date.getMinutes()}`.slice(-2);
  const seconds = `0${date.getSeconds()}`.slice(-2);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function sqliteStringToDate(str) {
  // Takes a string in SQLite format and converts it to a JavaScript Date object
  return new Date(str);
}

// Example usage:
// const currentDate = new Date();
// const sqliteDateString = dateToSQLiteString(currentDate);
// console.log('SQLite Date String:', sqliteDateString);

// const jsDate = sqliteStringToDate(sqliteDateString);
// console.log('JavaScript Date Object:', jsDate);
