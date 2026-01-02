# Contributing

Contributions are welcome! Here's how to get started.

## Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** changes: `git commit -m 'feat: add your feature'`
4. **Push** to branch: `git push origin feature/your-feature`
5. **Open** a Pull Request

## Code Style

- **JavaScript**: ES6+ modules, named exports
- **CSS**: Use variables from `styles/variables.css`
- **Structure**: Place new UI code in `src/ui/`, utilities in `src/utils/`

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code restructuring
- `docs:` Documentation only
- `style:` Formatting (no code change)

## Testing

Run the dev server and manually verify:

```bash
npm run dev
```

Check: autocomplete, layover add/remove, drag-drop, collapse/expand, flight tracking.
