export interface SeniorProfile {
  name: string;
  rank: string;
  platoon?: string;
  photo?: string;
}

// Keep this ordered roster limited to verified public details and supplied photos.
export const seniors: SeniorProfile[] = [];
