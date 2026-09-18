export const VIP_FEATURE_KEYS = [
  'unlimited_likes',
  'unlimited_rewinds',
  'global_passport',
  'ai_translation',
  'see_who_liked',
  'top_stack',
  'weekly_super_likes',
  'hd_video_call',
  'vip_gold_badge',
  'priority_verification',
  'vip_concierge',
  'global_visibility',
] as const;

export type VipFeatureKey = typeof VIP_FEATURE_KEYS[number];

export const DEFAULT_VIP_PLAN_FEATURES: Record<string, VipFeatureKey[]> = {
  plan_vip_free_1m: [
    'unlimited_likes',
    'unlimited_rewinds',
    'global_passport',
  ],
  plan_vip_1m: [
    'unlimited_likes',
    'unlimited_rewinds',
    'global_passport',
    'ai_translation',
    'see_who_liked',
    'top_stack',
    'weekly_super_likes',
    'hd_video_call',
    'vip_gold_badge',
  ],
  plan_vip_2m: [...VIP_FEATURE_KEYS],
};

export function parseFeatureKeys(raw: unknown): VipFeatureKey[] {
  let values: unknown = raw;
  if (typeof raw === 'string') {
    try {
      values = JSON.parse(raw);
    } catch {
      values = [];
    }
  }
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is VipFeatureKey =>
    typeof value === 'string' && (VIP_FEATURE_KEYS as readonly string[]).includes(value)
  ))];
}

export function isLegacyFeatureList(raw: unknown): boolean {
  if (!raw) return true;
  let values: unknown = raw;
  if (typeof raw === 'string') {
    try {
      values = JSON.parse(raw);
    } catch {
      return true;
    }
  }
  return !Array.isArray(values) || values.some((value) =>
    typeof value !== 'string' || !(VIP_FEATURE_KEYS as readonly string[]).includes(value)
  );
}