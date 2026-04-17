import { BharatPaysProvider } from './bharatpays.provider';
import { SetuProvider } from './setu.provider';
import { RechargeProvider, RechargeProviderId } from './types';

const providers: Record<RechargeProviderId, RechargeProvider> = {
  bharatpays: new BharatPaysProvider(),
  setu: new SetuProvider(),
};

export function getRechargeProvider(providerId: RechargeProviderId): RechargeProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unsupported recharge provider: ${providerId}`);
  }

  return provider;
}

export function listRechargeProviders(): RechargeProvider[] {
  return Object.values(providers);
}
