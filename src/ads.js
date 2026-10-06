import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents } from '@capacitor-community/admob';

// ===== SETTINGS =====
// true  = Google's sample (test) ads. Safe. Use this while testing.
// false = your real ads. Turn this off only for the final release,
//         and never tap your own real ads.
const USE_TEST_ADS = true;

const REAL = {
  rewarded: 'ca-app-pub-4491823835774613/9753200030',
  interstitial: 'ca-app-pub-4491823835774613/6787380484'
};
const TEST = {
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712'
};
const IDS = USE_TEST_ADS ? TEST : REAL;

if (Capacitor.isNativePlatform()) {
  let initPromise = null;
  const init = () => {
    if (!initPromise) {
      initPromise = AdMob.initialize({ initializeForTesting: USE_TEST_ADS }).catch(e => console.log('AdMob init failed', e));
    }
    return initPromise;
  };
  init();

  let busy = false;
  const once = fn => { let called = false; return (...a) => { if (called) return; called = true; fn(...a); }; };
  const listen = async (handles, event, cb) => { handles.push(await AdMob.addListener(event, cb)); };
  const clean = handles => { handles.forEach(h => { try { h.remove(); } catch (e) {} }); handles.length = 0; };

  window.AdsBridge = {
    async showRewarded(onReward, onFail) {
      if (busy) { if (onFail) onFail(); return; }
      busy = true;
      const handles = []; let earned = false; let timer = null;
      const finish = once(ok => {
        clean(handles); busy = false; clearTimeout(timer);
        if (ok) { if (onReward) onReward(); } else if (onFail) onFail();
      });
      timer = setTimeout(() => finish(false), 20000);   // only guards the loading time
      try {
        await init();
        await listen(handles, RewardAdPluginEvents.Showed, () => clearTimeout(timer));
        await listen(handles, RewardAdPluginEvents.Rewarded, () => { earned = true; });
        await listen(handles, RewardAdPluginEvents.Dismissed, () => finish(earned));
        await listen(handles, RewardAdPluginEvents.FailedToLoad, () => finish(false));
        await listen(handles, RewardAdPluginEvents.FailedToShow, () => finish(false));
        await AdMob.prepareRewardVideoAd({ adId: IDS.rewarded, isTesting: USE_TEST_ADS });
        await AdMob.showRewardVideoAd();
      } catch (e) { finish(false); }
    },

    async showInterstitial(done) {
      if (busy) { if (done) done(); return; }
      busy = true;
      const handles = []; let timer = null;
      const finish = once(() => { clean(handles); busy = false; clearTimeout(timer); if (done) done(); });
      timer = setTimeout(finish, 12000);               // only guards the loading time
      try {
        await init();
        await listen(handles, InterstitialAdPluginEvents.Showed, () => clearTimeout(timer));
        await listen(handles, InterstitialAdPluginEvents.Dismissed, finish);
        await listen(handles, InterstitialAdPluginEvents.FailedToLoad, finish);
        await listen(handles, InterstitialAdPluginEvents.FailedToShow, finish);
        await AdMob.prepareInterstitial({ adId: IDS.interstitial, isTesting: USE_TEST_ADS });
        await AdMob.showInterstitial();
      } catch (e) { finish(); }
    }
  };
}
