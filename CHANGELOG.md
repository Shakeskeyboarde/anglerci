# Changelog

## v0.0.19

### Chore

- Removed debug logs.

## v0.0.18

### Fixes

- Fixed base-ref from tag not detected because of shallow fetch.

## v0.0.17

### Fixes

- Published status was accidentally double checked.

## v0.0.16

### Fixes

- Ignored files not working correctly for detecting uncommitted change and modifications.

### Other

- Print list of uncommitted files when uncommitted changes are detected.

## v0.0.15

### Chores

- Serialize build pipeline runs using the github actions `concurrency` setting.

## v0.0.14

### Fixes

- Uncommitted changes were always detected.
- Always ignore changes to .npmrc and CHANGELOG.md
