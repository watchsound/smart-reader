/**
 * graphTest.js
 *
 * Simple test script to verify Neo4j connection and basic operations.
 * Run this from the main process console to test the GraphManager.
 *
 * Usage (from Electron main process):
 *   const graphTest = require('./utils/graphTest');
 *   graphTest.runTests();
 */

import graphManager from './GraphManager';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  uri: 'bolt://localhost:7687',
  user: 'neo4j',
  password: 'password', // Change to your Neo4j password
};

/**
 * Mock store for testing
 */
const mockStore = {
  data: {},
  get: function (key) {
    if (key === 'neo4j_uri') return TEST_CONFIG.uri;
    if (key === 'neo4j_user') return TEST_CONFIG.user;
    if (key === 'neo4j_password') return TEST_CONFIG.password;
    return this.data[key];
  },
  set: function (key, value) {
    this.data[key] = value;
  },
};

/**
 * Mock token for testing
 * This creates a simple mock that returns userId: 1
 */
const MOCK_TOKEN = 'test-token-12345';

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n=== Neo4j GraphManager Tests ===\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Test 1: Connection
  await runTest('Connection', async () => {
    const connected = await graphManager.connect(mockStore);
    if (!connected) throw new Error('Failed to connect');
    return graphManager.checkConnection();
  }, results);

  // Test 2: Create User
  await runTest('Create User', async () => {
    const user = await graphManager.upsertUser({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      readerLevel: 'middle',
      studyMode: 'general',
      preferredProvider: 'chatGPT',
      preferredModel: 'gpt-4o-mini',
    });
    if (!user) throw new Error('Failed to create user');
    return user.email === 'test@example.com';
  }, results);

  // Test 3: Create Book
  await runTest('Create Book', async () => {
    // We need to mock getUserIdFromToken - for now just test the connection
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {id: '1'})
        CREATE (b:Book {
          id: 'test-book-001',
          name: 'Test Book',
          format: 'epub',
          userId: '1',
          createdAt: datetime()
        })
        CREATE (u)-[:OWNS]->(b)
        RETURN b
      `);
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }, results);

  // Test 4: Create Note
  await runTest('Create Note', async () => {
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {id: '1'})
        CREATE (n:Note {
          id: 'test-note-001',
          sourceType: 'book',
          sourceKey: 'test-book-001',
          title: 'Test Note',
          cards: '[]',
          tags: ['test', 'demo'],
          rate: 5,
          userId: '1',
          createdAt: datetime(),
          eventTime: datetime(),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null,
          leitnerBox: 1,
          leitnerNextReview: null,
          leitnerFullyLearned: false
        })
        CREATE (u)-[:OWNS]->(n)
        RETURN n
      `);
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }, results);

  // Test 5: Create Relationship
  await runTest('Create ANNOTATES Relationship', async () => {
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (n:Note {id: 'test-note-001'})
        MATCH (b:Book {id: 'test-book-001'})
        MERGE (n)-[r:ANNOTATES]->(b)
        ON CREATE SET
          r.createdAt = datetime(),
          r.weight = 1.0
        RETURN r
      `);
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }, results);

  // Test 6: Query with Traversal
  await runTest('Query with Relationship Traversal', async () => {
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {id: '1'})-[:OWNS]->(n:Note)-[:ANNOTATES]->(b:Book)
        RETURN n.title AS noteTitle, b.name AS bookName
      `);
      if (result.records.length === 0) throw new Error('No results found');
      const noteTitle = result.records[0].get('noteTitle');
      const bookName = result.records[0].get('bookName');
      return noteTitle === 'Test Note' && bookName === 'Test Book';
    } finally {
      await session.close();
    }
  }, results);

  // Test 7: Create Vocabulary with Leitner
  await runTest('Create Vocabulary', async () => {
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (u:User {id: '1'})
        CREATE (v:Vocabulary {
          id: 'test-vocab-001',
          word: 'serendipity',
          definition: 'the occurrence of events by chance in a happy way',
          example: 'Finding that book was pure serendipity.',
          userId: '1',
          createdAt: datetime(),
          eventTime: datetime(),
          leitnerBox: 1,
          leitnerNextReview: datetime(),
          leitnerFullyLearned: false,
          leitnerSkips: 0,
          leitnerFlips: 0
        })
        CREATE (u)-[:OWNS]->(v)
        RETURN v
      `);
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }, results);

  // Test 8: Temporal Query
  await runTest('Temporal Query (Notes created today)', async () => {
    const session = graphManager.getSession();
    try {
      const result = await session.run(`
        MATCH (n:Note)
        WHERE n.eventTime >= datetime() - duration({hours: 1})
        RETURN count(n) AS count
      `);
      const count = result.records[0].get('count');
      return count >= 1;
    } finally {
      await session.close();
    }
  }, results);

  // Test 9: Cleanup test data
  await runTest('Cleanup Test Data', async () => {
    const session = graphManager.getSession();
    try {
      await session.run(`
        MATCH (n)
        WHERE n.id IN ['test-note-001', 'test-book-001', 'test-vocab-001']
           OR n.email = 'test@example.com'
        DETACH DELETE n
      `);
      return true;
    } finally {
      await session.close();
    }
  }, results);

  // Test 10: Disconnect
  await runTest('Disconnect', async () => {
    await graphManager.disconnect();
    return !graphManager.checkConnection();
  }, results);

  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.passed}/${results.passed + results.failed}`);
  console.log(`Failed: ${results.failed}/${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results;
}

/**
 * Run a single test
 */
async function runTest(name, testFn, results) {
  try {
    const result = await testFn();
    if (result) {
      console.log(`✓ ${name}`);
      results.passed++;
      results.tests.push({ name, passed: true });
    } else {
      throw new Error('Test returned false');
    }
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
  }
}

/**
 * Quick connection test
 */
async function quickTest() {
  console.log('Testing Neo4j connection...');
  try {
    const connected = await graphManager.connect(mockStore);
    if (connected) {
      console.log('✓ Connected to Neo4j');
      const stats = await graphManager.getMigrationStats();
      console.log('Node counts:', stats);
      await graphManager.disconnect();
      console.log('✓ Disconnected');
      return true;
    } else {
      console.log('✗ Failed to connect');
      return false;
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
    return false;
  }
}

export { runTests, quickTest };
export default { runTests, quickTest };
