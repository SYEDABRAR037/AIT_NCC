const PREVIEW_CONTEXTS = new Set(['deploy-preview', 'branch-deploy']);
const PREVIEW_BRANCHES = new Set(['codex/ncc-release-candidate-20261028']);

export const isPublicPreview = (environment = process.env) =>
  environment.SITE_NAME === 'ait-ncc-public-preview'
  || environment.NCC_PUBLIC_PREVIEW_MODE === 'true'
  || PREVIEW_CONTEXTS.has((environment.CONTEXT || '').trim().toLowerCase())
  || PREVIEW_BRANCHES.has((environment.BRANCH || '').trim());
