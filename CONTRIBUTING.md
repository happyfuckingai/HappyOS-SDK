# Contributing to HappyOS SDK

Thank you for your interest in contributing to HappyOS SDK! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/HappyOS-SDK.git`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Install dependencies: `npm install`

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Linting

```bash
npm run lint
```

## Making Changes

1. Make your changes in your feature branch
2. Add tests for any new functionality
3. Ensure all tests pass
4. Ensure code passes linting
5. Update documentation as needed
6. Commit your changes with a clear message

## Commit Messages

Use clear and descriptive commit messages:

- `feat: Add new agent isolation feature`
- `fix: Resolve circuit breaker timeout issue`
- `docs: Update README with new examples`
- `test: Add tests for A2A communication`
- `refactor: Improve orchestrator performance`

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md with your changes
3. Ensure all tests pass and code is linted
4. Submit a pull request with a clear description of your changes
5. Wait for review from maintainers

## Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write tests for new functionality

## Questions?

Feel free to open an issue if you have questions or need help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
