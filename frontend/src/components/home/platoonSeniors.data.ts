export interface PlatoonSeniorProfile {
  name: string;
  rank: string;
  platoon?: string;
  photo?: string;
}

// Populate only with the verified details and photos supplied by the NCC unit.
export const platoonSeniors: PlatoonSeniorProfile[] = [];
