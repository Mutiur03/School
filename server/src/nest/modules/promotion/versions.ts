import { v1Engine } from './v1/session-result.js';

// Each rules version lives in its own folder (v1/, v2/, ...) and exports the same engine shape.
export const PROMOTION_VERSIONS = { v1: v1Engine };

export type PromotionVersion = keyof typeof PROMOTION_VERSIONS;

export const getPromotionEngine = (version: string | null | undefined) =>
  version && Object.hasOwn(PROMOTION_VERSIONS, version)
    ? PROMOTION_VERSIONS[version as PromotionVersion]
    : PROMOTION_VERSIONS.v1;
