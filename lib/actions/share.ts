'use server';

export async function createShareToken(entryId: string) {
  // TODO: Real DB later
  console.log('Sharing entry:', entryId);
  return 'demo-' + entryId.slice(-4);
}
