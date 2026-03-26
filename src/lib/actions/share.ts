"use server";

export async function createShareToken(entryId: string) {
  console.log('Sharing entry:', entryId);
  return "demo-" + entryId.slice(-4);
}
