import('./dist/server.cjs').catch(err => {
  console.error("Failed to load server:", err);
  process.exit(1);
});
