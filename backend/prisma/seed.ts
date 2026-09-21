/** Existing data is authoritative; no replacement seed dataset has been approved. */
export async function seed(): Promise<never> {
  throw new Error('Seeding is disabled: preserve existing data. See prisma/_doc.md.');
}

// Fail visibly when invoked by either the package script or Prisma 7 db seed.
void seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seeding is disabled.');
  process.exitCode = 1;
});
