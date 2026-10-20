import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 40_000,
    hookTimeout: 20_000,
    // One file at a time: the labs share a single world object and a drop box on
    // disk, and watching them interleave is not the lesson.
    fileParallelism: false,
    reporters: 'default',
  },
});
