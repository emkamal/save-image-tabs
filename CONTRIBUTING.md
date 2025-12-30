# Contributing to Chrome Extension Template

Thank you for your interest in contributing! This template aims to help developers create Chrome extensions with well-documented, production-ready code.

## Ways to Contribute

### 1. Documentation Improvements
- Fix typos or unclear explanations
- Add more examples
- Improve code comments
- Translate documentation

### 2. Code Improvements
- Fix bugs in the template code
- Add new example features
- Improve code organization
- Optimize performance

### 3. New Features
- Add new component examples
- Create additional templates
- Add testing utilities
- Improve developer tooling

### 4. Community Support
- Answer questions in Issues
- Help other developers
- Share your extensions built with this template
- Write blog posts or tutorials

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/save-image-tabs.git
   cd save-image-tabs
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes**
5. **Test thoroughly** (see TESTING.md)
6. **Commit with clear messages**
   ```bash
   git commit -m "Add: Brief description of changes"
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request**

## Code Style Guidelines

### JavaScript
- Use ES6+ features (async/await, arrow functions, etc.)
- Add JSDoc comments for functions
- Use meaningful variable names
- Follow existing code structure

Example:
```javascript
/**
 * Get all image tabs from the browser
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of tab objects
 */
async function getImageTabs(options = {}) {
  // Implementation
}
```

### HTML
- Use semantic HTML5 elements
- Include ARIA labels for accessibility
- Keep structure clean and organized

### CSS
- Use CSS custom properties for theming
- Follow BEM naming convention (optional)
- Keep specificity low
- Support dark mode

### Comments
- Explain **why**, not **what**
- Use JSDoc for function documentation
- Add section headers in large files
- Keep comments up to date

## Documentation Standards

### Code Comments
- All functions should have JSDoc comments
- Complex logic should be explained
- Include examples where helpful
- Note any browser-specific behavior

### README Updates
- Keep instructions clear and concise
- Use proper markdown formatting
- Include code examples
- Test all instructions

### Changelog
- Document all changes
- Use semantic versioning
- Group by type (Added, Changed, Fixed, etc.)

## Testing Requirements

Before submitting:

1. **Load the extension** in Chrome without errors
2. **Test all features** work as expected
3. **Check console** for errors in all contexts
4. **Test in incognito** if relevant
5. **Verify documentation** matches code

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** if adding functionality
3. **Follow code style** guidelines
4. **Write clear PR description**:
   - What changes were made
   - Why they were made
   - How to test them

5. **Be responsive** to review feedback
6. **Keep PRs focused** - one feature/fix per PR

## Commit Message Format

Use clear, descriptive commit messages:

```
Type: Brief description

Longer explanation if needed
- Detail 1
- Detail 2

Closes #123
```

**Types:**
- `Add:` New feature or file
- `Fix:` Bug fix
- `Update:` Change to existing feature
- `Docs:` Documentation only
- `Style:` Formatting, no code change
- `Refactor:` Code restructuring
- `Test:` Adding tests
- `Chore:` Maintenance tasks

## Code Review Process

All submissions require review. We'll:
- Check code quality and style
- Verify functionality
- Review documentation
- Suggest improvements
- Provide constructive feedback

## Questions?

- **General questions**: Open a Discussion
- **Bug reports**: Open an Issue
- **Feature requests**: Open an Issue with "Feature Request" label
- **Security issues**: Email privately (don't open public issue)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Thanked in the community

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, experience level, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity.

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards others

**Unacceptable behavior:**
- Trolling, insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Unprofessional conduct

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by opening an issue or contacting the maintainers. All complaints will be reviewed and investigated.

---

**Thank you for contributing! 🎉**
