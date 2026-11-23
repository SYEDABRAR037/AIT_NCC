/**
 * Application-runtime provider startup policy.
 *
 * Environment values are deny signals only; none of them attests that a host is
 * local. The application has no mock provider option. The mock is test-harness
 * only and is not imported by this module or the application provider factory.
 */

export type BiometricProviderStartupMode = 'DISABLED';

const PROVIDER_CONFIGURATION_KEYS = [
  'BIOMETRIC_PROVIDER',
  'BIOMETRIC_MOCK_PROVIDER_ENABLED',
  'BIOMETRIC_PROTOTYPE_MODE',
  'BIOMETRIC_SYNTHETIC_ID_ALLOWLIST',
  'NCC_BIOMETRIC_TEST_HARNESS',
] as const;

const DEPLOYMENT_MARKERS = [
  'RENDER',
  'RENDER_SERVICE_ID',
  'VERCEL',
  'VERCEL_ENV',
  'NETLIFY',
  'CONTEXT',
  'AWS_EXECUTION_ENV',
  'AWS_LAMBDA_FUNCTION_NAME',
  'K_SERVICE',
  'GAE_ENV',
  'DYNO',
  'WEBSITE_INSTANCE_ID',
  'FLY_APP_NAME',
  'RAILWAY_ENVIRONMENT',
] as const;
const HOST_CONTEXT_KEYS = ['VERCEL_ENV', 'CONTEXT', 'RAILWAY_ENVIRONMENT'] as const;
const NON_PRODUCTION_HOST_CONTEXTS = new Set(['development', 'test', 'preview', 'deploy-preview', 'staging']);

const hasValue = (value: string | undefined): boolean => Boolean(value?.trim());

const hasProviderConfiguration = (
  env: Readonly<Record<string, string | undefined>>,
): boolean => PROVIDER_CONFIGURATION_KEYS.some((key) => env[key] !== undefined);

const activeDeploymentMarkers = (
  env: Readonly<Record<string, string | undefined>>,
): string[] => DEPLOYMENT_MARKERS.filter((key) => hasValue(env[key]));

/**
 * Validate application startup configuration before opening the HTTP listener.
 * With no provider-related settings, the current app stays biometric-provider
 * disabled. Any attempted selection is rejected until an approved real
 * provider exists. In particular, mock is never selectable in app runtime,
 * regardless of NODE_ENV or test-looking environment settings.
 */
export function validateBiometricProviderStartup(
  env: Readonly<Record<string, string | undefined>>,
): BiometricProviderStartupMode {
  const nodeEnvironment = env.NODE_ENV?.trim().toLowerCase();
  if (nodeEnvironment === 'production'
    && (env.PURE_MOCK_TEST === 'true' || env.NCC_BIOMETRIC_TEST_HARNESS === 'true')) {
    throw new Error('BIOMETRIC_RUNTIME_MARKER_CONFLICT');
  }
  if (!hasProviderConfiguration(env)) return 'DISABLED';

  if (!nodeEnvironment || !['production', 'development', 'test'].includes(nodeEnvironment)) {
    throw new Error('BIOMETRIC_RUNTIME_ENVIRONMENT_UNKNOWN');
  }

  const deploymentMarkers = activeDeploymentMarkers(env);
  const conflictingHostedContext = HOST_CONTEXT_KEYS.some((key) =>
    NON_PRODUCTION_HOST_CONTEXTS.has(env[key]?.trim().toLowerCase() || ''));
  if ((deploymentMarkers.length > 0 && nodeEnvironment !== 'production')
    || (nodeEnvironment === 'production' && conflictingHostedContext)) {
    throw new Error('BIOMETRIC_RUNTIME_MARKER_CONFLICT');
  }

  const selected = env.BIOMETRIC_PROVIDER?.trim().toLowerCase();
  if (!selected) throw new Error('BIOMETRIC_PROVIDER_CONFIG_MISSING');
  if (selected === 'mock') throw new Error('BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN');
  throw new Error('BIOMETRIC_PROVIDER_UNSUPPORTED');
}

