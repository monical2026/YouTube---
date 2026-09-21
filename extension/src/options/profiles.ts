import type { Profile, Settings } from '@youtube-note/shared';
import { providerByName } from './providers';
export function renameProfile(profile: Profile, name: string): Profile {
  const provider = providerByName(name);
  return {
    ...profile,
    name,
    ...(provider && provider.baseUrl !== profile.baseUrl
      ? { baseUrl: provider.baseUrl, model: provider.model }
      : {}),
  };
}
export function removeProfile(settings: Settings, id: string): Settings {
  return {
    ...settings,
    profiles: settings.profiles.filter((p) => p.id !== id),
    translateProfile:
      settings.translateProfile === id ? '' : settings.translateProfile,
    analyzeProfile:
      settings.analyzeProfile === id ? '' : settings.analyzeProfile,
    subtitleProfile:
      settings.subtitleProfile === id ? '' : settings.subtitleProfile,
  };
}

export function profileLabel(profile: Profile): string {
  return profile.kind === 'llm'
    ? `${profile.name} · ${profile.model || '未选择模型'}`
    : profile.name;
}
export function hasCodexConnection(settings: Settings): boolean {
  return settings.profiles.some((profile) => profile.connection === 'codex');
}
