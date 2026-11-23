import { BiometricProvider } from './providerTypes';
import { validateBiometricProviderStartup } from './providerStartupPolicy';

/**
 * This application factory intentionally has no mock import or mock creation
 * path. A future real provider must be added explicitly after separate review.
 */
export function createBiometricProvider(): BiometricProvider {
  const mode = validateBiometricProviderStartup(process.env);
  if (mode === 'DISABLED') throw new Error('BIOMETRIC_PROVIDER_CONFIG_MISSING');
  throw new Error('BIOMETRIC_PROVIDER_UNSUPPORTED');
}
