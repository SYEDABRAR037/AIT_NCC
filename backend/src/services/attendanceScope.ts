export const attendanceCadetInScope = (authorizedCadetIds: string[] | null, cadetId: string): boolean =>
  authorizedCadetIds === null || authorizedCadetIds.includes(cadetId);
