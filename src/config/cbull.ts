export interface CbullConfig {
  isLive: boolean;
  ticker: string;
  name: string;
  buyUrl: string;
  tokenSlug: string;
  tokenAddress: string;
  tokenAdmin: string;
}

export const CBULL: CbullConfig = {
  isLive: true,
  ticker: '$CBULL',
  name: 'BULL ON CANTON',
  buyUrl: 'https://launch.supanova.app/coin/bull-on-canton-28d7b99386?ref=nova_navigator_95',
  tokenSlug: 'bull-on-canton-28d7b99386',
  tokenAddress: 'CBULL-F8530CA370CAEDE0368E84E1',
  tokenAdmin: 'supa-registrar::12205c9e7df3ce671bc5e285120cb6e4dfae5ee3029c04fa82f1cd828c5e7197d882',
};
