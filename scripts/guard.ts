// Explicit mode, independent of development/task/release branch names.
if (process.env.E2E_MANIFEST_DEV !== '1') {
  console.error('Manifest changes require E2E_MANIFEST_DEV=1. Publishing still requires a separate user instruction.');
  process.exitCode = 1;
}
