# Testing Documentation

Test reports and coverage analysis for SmartReader.

## Contents

### Test Reports

| Document | Date | Description |
|----------|------|-------------|
| [ACTUAL_TEST_FAILURES.md](ACTUAL_TEST_FAILURES.md) | 2024-02-25 | Test failure analysis |
| [BUG_FIX_AND_TEST_SUMMARY.md](BUG_FIX_AND_TEST_SUMMARY.md) | 2024-02-25 | Bug fixes and test results |
| [FINAL_TEST_STATUS.md](FINAL_TEST_STATUS.md) | 2024-02-25 | Final test status report |
| [TEST_COVERAGE_ANALYSIS.md](TEST_COVERAGE_ANALYSIS.md) | 2024-02-25 | Test coverage analysis |

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=graph
npm test -- --testPathPattern=brain
npm test -- --testPathPattern=skills

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Test Structure

```
src/__tests__/
├── graph/             # Graph database tests (240 tests)
├── brain/             # Brain/memory tests (76+ tests)
├── skills/            # Skill system tests (500+ tests)
├── ipc/               # IPC handler tests
├── learning/          # Learning system tests
├── renderer/          # Component tests
└── setup.js           # Test configuration
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Main workflows tested

## Related Documentation

- [Architecture Overview](../technical/ARCHITECTURE.md#testing)
- [Development Guide](../../CLAUDE.md#testing)

---

*For current test status, run `npm test` in the project root.*
