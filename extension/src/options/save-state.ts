import type { Profile } from '@youtube-note/shared';
export function profileSignature(profile: Profile): string {
  return JSON.stringify([
    profile.name,
    profile.kind,
    profile.connection ?? 'api',
    profile.baseUrl,
    profile.model,
  ]);
}
export function isProfileSaved(
  profile: Profile,
  saved: Profile | undefined,
  temporaryKey = '',
): boolean {
  return (
    !!saved &&
    !temporaryKey &&
    profileSignature(profile) === profileSignature(saved)
  );
}
