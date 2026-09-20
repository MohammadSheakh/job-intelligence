// Neon already contains authoritative data. Seeding is deliberately disabled.
export async function seed(): Promise<never> {
  throw new Error('Seeding is disabled: use the existing Neon data.');
}
