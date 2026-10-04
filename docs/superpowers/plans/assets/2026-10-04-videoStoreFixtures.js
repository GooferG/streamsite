// Dev and test data for /vods. /vods?fixture=<key> renders VideoStoreFront
// from these (VodsPage strips the lookup from production builds). The data is
// GooferG's real archive and clips on 2026-10-04, Helix-shaped; every fixture
// freezes the clock.

const DAY_MS = 86400000;
const TAIL = '💥communityhunts.gg / goofer.tv / beantwitch.com 💥 "HIGH" QUALITY  💥 EN/PT-BR 💥';
const vodThumb = (path) => `https://static-cdn.jtvnw.net/cf_vods/${path}//thumb/thumb0-%{width}x%{height}.jpg`;
const clipThumb = (uuid) =>
  `https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/${uuid}/landscape/thumb/thumb-0000000000-480x272.jpg`;

function vod(id, created_at, duration, view_count, title, thumb) {
  return {
    id,
    title,
    created_at,
    duration,
    view_count,
    thumbnail_url: vodThumb(thumb),
    url: `https://www.twitch.tv/videos/${id}`,
    muted_segments: null,
  };
}

function clip(id, created_at, duration, view_count, title, creator_name, game_name, video_id, vod_offset, thumb) {
  return {
    id,
    title,
    created_at,
    duration,
    view_count,
    creator_name,
    game_name,
    video_id,
    vod_offset,
    thumbnail_url: clipThumb(thumb),
    url: `https://www.twitch.tv/gooferg/clip/${id}`,
  };
}

// The archive, newest first (Helix order).
export const LIVE_VIDEOS = [
  vod('2889109731', '2026-10-01T18:24:30Z', '4h37m20s', 237, 'Win Wednesdays 💥 Games and Gamba?  ' + TAIL, 'd2nvs31859zcd8/4536c9cf87ae1d1ac64e_gooferg_319419557079_1790879065'),
  vod('2888141530', '2026-09-30T16:07:42Z', '5h2m30s', 225, 'Win Wednesdays 💥 Games and Gamba?  ' + TAIL, 'd2nvs31859zcd8/0ce7c34f89d72cf347e1_gooferg_318249584856_1790784457'),
  vod('2886426857', '2026-09-28T16:00:08Z', '2h45m0s', 108, 'Monday Hunts and Twists' + TAIL, 'd2nvs31859zcd8/b39e5f109384ebffe064_gooferg_319385837015_1790611203'),
  vod('2883691078', '2026-09-25T16:17:05Z', '4h38m0s', 147, 'Fryday Hunts, Poker & Games' + TAIL, 'd2nvs31859zcd8/09f5bbf3b7dc5ef68295_gooferg_319349113559_1790353020'),
  vod('2883054967', '2026-09-24T21:01:32Z', '3h5m20s', 104, 'Chill Thursday - !giveaway After Hunt!' + TAIL, 'd2nvs31859zcd8/e1388e113be848e80f5e_gooferg_318201948376_1790283687'),
  vod('2881575909', '2026-09-23T02:00:52Z', '3h11m0s', 63, 'Money Monday? Guild BEAN Homie Hunt!' + TAIL, 'd2nvs31859zcd8/e4a809d1d6d2afd15548_gooferg_319321167191_1790128847'),
  vod('2880408776', '2026-09-21T19:04:26Z', '5h47m30s', 203, 'Money Monday? Guild BEAN Homie Hunt!' + TAIL, 'd2nvs31859zcd8/749aa9046ca71056a395_gooferg_317500082679_1790017461'),
  vod('2877697800', '2026-09-18T19:45:43Z', '3h12m30s', 104, 'Hunting w/ Guild BEAN!' + TAIL, 'd2nvs31859zcd8/10a0d8809bfedcebbb47_gooferg_318156223576_1789760738'),
  vod('2876957416', '2026-09-17T23:02:18Z', '2h31m10s', 73, 'Hunting w/ Guild BEAN!' + TAIL, 'd2nvs31859zcd8/2bac2ce2fa5d5961f401_gooferg_318150160088_1789686133'),
  vod('2876048403', '2026-09-16T22:06:31Z', '2h58m20s', 106, 'Hunting w/ Guild BEAN!' + TAIL, 'd2nvs31859zcd8/01a4fc20bdf0b718eeeb_gooferg_319250156503_1789596386'),
  vod('2876037965', '2026-09-16T21:53:54Z', '12m10s', 7, 'Hunting w/ Guild BEAN!' + TAIL, 'd2nvs31859zcd8/172c32aea4fbef2cf40e_gooferg_319250046679_1789595629'),
  vod('2874118314', '2026-09-14T17:17:11Z', '4h28m20s', 183, 'Hunting and Treadmilling' + TAIL, 'd2nvs31859zcd8/d8a3631a8aca12165092_gooferg_317451039991_1789406227'),
  vod('2872490178', '2026-09-12T20:08:50Z', '5h8m0s', 163, 'WARDOGS' + TAIL, 'd2nvs31859zcd8/8dd67d20d4d228594adc_gooferg_317437829751_1789243726'),
  vod('2869841760', '2026-09-09T21:00:36Z', '3h31m40s', 161, '!giveaway if we print! $ARS2500 tip for best slot call' + TAIL, 'd2nvs31859zcd8/2becda81f8ad4c995e2d_gooferg_319169106519_1788987632'),
  vod('2868064733', '2026-09-07T19:30:40Z', '6h47m10s', 281, '!giveaway if we print! $ARS2500 tip for best slot call' + TAIL, 'd2nvs31859zcd8/b296cb5ae1a25abb35ce_gooferg_319145337943_1788809435'),
  vod('2864413308', '2026-09-03T20:00:08Z', '4h18m0s', 110, 'A HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/c44c8e63427ea4086698_gooferg_317376205815_1788465604'),
  vod('2863486783', '2026-09-02T18:30:26Z', '3h36m23s', 118, 'A HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/9d698ac2c1ffb50c740c_gooferg_317369196151_1788373821'),
  vod('2861731872', '2026-08-31T18:00:19Z', '5h59m51s', 205, 'A HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/67db3d6c5a9ae606ce5d_gooferg_318018381016_1788199214'),
  vod('2857995886', '2026-08-27T17:30:42Z', '2h50m26s', 31, 'A HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/67649676d4a734d5a14b_gooferg_319005001303_1787851838'),
  vod('2857265043', '2026-08-26T21:00:28Z', '3h52m7s', 201, '!giveaway... a HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/19e4fa1b63d0cce6f67f_gooferg_317321388023_1787778023'),
  vod('2856325728', '2026-08-25T20:10:39Z', '2h37m43s', 105, '!giveaway... a HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/be3e829e0c8e7b93b433_gooferg_318980732503_1787688634'),
  vod('2855374051', '2026-08-24T18:54:05Z', '4h37m8s', 61, '!giveaway... a HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/958889606a98da5fdc12_gooferg_317307888503_1787597640'),
  vod('2851641948', '2026-08-20T18:19:32Z', '2h29m12s', 40, 'a HUNT a DAY KEEPS MY VIP OK' + TAIL, 'd2nvs31859zcd8/5b1fba435bba528db593_gooferg_318915115095_1787249967'),
  vod('2850636057', '2026-08-19T16:25:12Z', '2h14m56s', 42, 'DISCORD (hidden super) HUNT !giveaway' + TAIL, 'd2nvs31859zcd8/9392a93576ab705810ac_gooferg_317925376088_1787156707'),
  vod('2849770799', '2026-08-18T17:20:48Z', '3h37m27s', 40, 'IF I WIN YOU WIN! $ARS80,000 START' + TAIL, 'd2nvs31859zcd8/0a310d41622875d616d1_gooferg_318890391383_1787073643'),
  vod('2848973257', '2026-08-17T19:28:09Z', '3h44m25s', 74, 'IF I WIN YOU WIN! $ARS80,000 START' + TAIL, 'd2nvs31859zcd8/87eae2f2a76c5937a68b_gooferg_317909895512_1786994885'),
  vod('2848935685', '2026-08-17T18:44:33Z', '41m56s', 9, 'IF I WIN YOU WIN! $ARS80,000 START' + TAIL, 'd2nvs31859zcd8/b2eb890a94cacd94ab56_gooferg_318877905495_1786992269'),
];

// App's top 20: all time, most viewed first.
export const LIVE_TOP_CLIPS = [
  clip('GeniusSmokyOpossumFrankerZ', '2018-08-09T19:51:33Z', 39.3, 219, 'What just happened', 'Moogle_Cat', 'Escape from Tarkov', '', null, '0e38f8d4-909b-49f2-a7a0-d7d5e638ed28'),
  clip('GiantCorrectMacaroniYee', '2018-12-19T23:22:37Z', 30, 85, '[EN/PT-BR] Zed Aint Dead.  🔥 | !trees | JOIN !discord | !social | free !bong hits | #GooferGang', 'GooferG', 'League of Legends', '', null, '14cadc25-1a0b-4d9f-adbd-8ace0269eb5b'),
  clip('ModernFuriousTomatoRedCoat', '2018-12-11T02:52:11Z', 30, 74, '[EN/PT-BR] Always Learning... JGL/TOP 🔥 | !trees | JOIN !discord | !social | free !bong hits | #GooferGang', 'GooferG', 'League of Legends', '', null, 'b6e9b8a9-caa1-4c54-8bcd-a09aa285fa0c'),
  clip('SmoggyFunnyChoughPeoplesChamp', '2018-06-28T04:40:31Z', 33.7, 69, '"I\'m not even triggered..."', 'GooferG', 'Nioh', '', null, '8bf5903a-d108-4e14-bcad-dbefe53609d8'),
  clip('YawningPoisedMilkRlyTho', '2016-11-13T00:54:55Z', 30, 57, '[ENG/PT-BR] Shoot everything/everyone Saturday! |  !asuh !help !currency | !ROAD TO 420 FOLLOWS (GIVEAWAY) <3', 'GooferG', '0', '', null, '4365587b-784e-465c-acb5-9874c200eed7'),
  clip('HappyFrigidDogMrDestructoid-A-7YRsa6jGBO_5VU', '2026-09-04T00:43:03Z', 59.9, 45, 'Leprecher max ARS', 'GooferG', 'Slots', '2864413308', 14922, 'a48c8a88-1de9-48b2-8a99-5992ddd97e07'),
  clip('CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4', '2026-10-01T18:16:03Z', 30, 41, '5 scat? pants off', 'GooferG', 'Slots', '2888141530', 14240, '03bc5c95-9d13-4caf-9c12-f49a52a3fbde'),
  clip('RockySourLeopardTF2John-3Sr41G7PWU-HgEP8', '2026-09-09T23:06:36Z', 30, 41, '500x hit', 'larrymenta', 'Slots', '2869841760', 7502, '527fe0a3-7520-47a2-9196-12e17ba1182e'),
  clip('SmallRelatedUdonImGlitch-yXltmsHNiOP6izNt', '2026-09-23T05:26:55Z', 60, 37, 'A couple yesses. W guild bean', 'GooferG', 'Slots', '2881575909', 10956, 'f718138c-cd63-41fe-a3a1-d8db2316130f'),
  clip('HealthyRamshackleClipsmomNerfRedBlaster-TLsCRAa_L-w_-i1j', '2026-02-27T01:50:55Z', 25.1, 36, 'Le Cowboy 90k', 'GooferG', 'Slots', '', null, '94e62e2e-852c-4557-a098-cbc0fe642f67'),
  clip('PrettyCourteousWeaselBrainSlug-7IVA4-H0cWZ4tlhT', '2025-07-13T19:03:33Z', 28.6, 33, 'Best word in racing', 'GooferG', 'iRacing', '', null, '38526b06-0c60-4f5d-9ccc-2c017898f6a0'),
  clip('ObliqueLaconicCockroachDerp', '2017-10-07T22:24:08Z', 30.1, 30, 'my first chiken dinner', 'Madam_Lilline', 'PUBG: BATTLEGROUNDS', '', null, '80691edf-aac4-428f-a0fb-7462b44c87e4'),
  clip('IcyScaryCheetahArgieB8', '2018-08-08T03:06:53Z', 25, 29, 'Cut the MUSIC', 'Gnomeacid', 'World of Warcraft', '', null, '410abf7d-14bd-49fd-9eca-6c97901cf54e'),
  clip('PoorElegantNuggetsBleedPurple-pXPyxooDW9GDS7RF', '2025-07-13T18:50:40Z', 55.2, 27, 'Some lapped racing', 'GooferG', 'iRacing', '', null, '9529f32a-cdcb-4480-b21b-43b6905a33fc'),
  clip('StrangeQuaintNigiriNomNom', '2018-01-11T07:20:27Z', 30, 27, 'KOBE', 'MrBoneman', 'Fortnite', '', null, '6eabd099-ec02-4a74-aa93-a946cbf33067'),
  clip('MushyRenownedPangolinDxAbomb-8-HTaw5O8J9vuT2q', '2025-10-16T02:30:01Z', 30, 26, 'ITS GONNA BE BIG!!!', 'GooferG', 'Slots', '', null, '3b5d98e3-9432-4ba3-b682-c9034df57103'),
  clip('ArborealSneakyOwlMoreCowbell', '2018-09-11T04:50:37Z', 11.6, 25, 'Lux ult?', 'Luckonme', 'League of Legends', '', null, 'a850a483-4ca5-4773-bd9d-b22cd9717506'),
  clip('FrozenCoweringWalrusPeoplesChamp', '2018-03-07T02:47:42Z', 7.8, 22, 'ghost?', 'GooferG', 'Escape from Tarkov', '', null, '7b0d9c7f-7c6d-4932-9e1a-b1cc24348423'),
  clip('FrailColdChimpanzeeOpieOP', '2017-12-13T18:54:46Z', 15, 21, 'Baited.', 'Tanner_Metro', 'Fortnite', '', null, '4955c2f0-7e43-43f5-a72c-0fb4576def3b'),
  clip('TameDifficultDadDuDudu', '2017-08-24T15:39:30Z', 29.8, 20, 'The clutch. 10 kill dubs win.', 'GooferG', 'PUBG: BATTLEGROUNDS', '', null, '1959e4c5-c7a2-4b06-8311-f0ce0a273622'),
];

// useRecentClips: the last 60 days.
export const LIVE_RECENT_CLIPS = [
  clip('HappyFrigidDogMrDestructoid-A-7YRsa6jGBO_5VU', '2026-09-04T00:43:03Z', 59.9, 45, 'Leprecher max ARS', 'GooferG', 'Slots', '2864413308', 14922, 'a48c8a88-1de9-48b2-8a99-5992ddd97e07'),
  clip('CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4', '2026-10-01T18:16:03Z', 30, 41, '5 scat? pants off', 'GooferG', 'Slots', '2888141530', 14240, '03bc5c95-9d13-4caf-9c12-f49a52a3fbde'),
  clip('RockySourLeopardTF2John-3Sr41G7PWU-HgEP8', '2026-09-09T23:06:36Z', 30, 41, '500x hit', 'larrymenta', 'Slots', '2869841760', 7502, '527fe0a3-7520-47a2-9196-12e17ba1182e'),
  clip('SmallRelatedUdonImGlitch-yXltmsHNiOP6izNt', '2026-09-23T05:26:55Z', 60, 37, 'A couple yesses. W guild bean', 'GooferG', 'Slots', '2881575909', 10956, 'f718138c-cd63-41fe-a3a1-d8db2316130f'),
  clip('UglyEsteemedSushiWow-WV1J2SwDU9bzkMs5', '2026-10-01T18:17:15Z', 24.2, 17, 'That\'s a whole lot of bombs aint it?', 'GooferG', 'Slots', '2888141530', 14744, '3933b91c-ff2d-4bb3-9f70-33f99cd61792'),
  clip('FamousBlindingAlmondOSkomodo-jvd8g9Ok0a4EkTUz', '2026-09-02T20:02:57Z', 10.8, 5, 'goofer voice', 'AmazingToilet', 'Slots', '2863486783', 5491, 'fcfe03ec-1293-44fe-a228-15761e59d329'),
  clip('GiantViscousFerretNinjaGrumpy-0S22YNqMADX44pfl', '2026-09-28T18:30:40Z', 30, 2, 'Monday Hunts and Twists' + TAIL, 'GooferG', 'Slots', '2886426857', 9039, '845708cf-a2a0-4f13-b0fb-49ab063d5133'),
  clip('UglyPoisedManateeItsBoshyTime-hG8qQnbHv_kJ0dTH', '2026-09-28T17:41:32Z', 30, 2, 'Monday Hunts and Twists' + TAIL, 'GooferG', 'Slots', '2886426857', 6091, '8a36cbd3-871d-40bf-bf4f-4bdfbaea45c0'),
  clip('KnottySingleEmuPanicBasket-rXfbHFIE2B6hIt_D', '2026-09-21T22:21:16Z', 30, 2, 'Money Monday? Guild BEAN Homie Hunt!' + TAIL, 'GooferG', 'Slots', '2880408776', 11815, '23248217-e926-44f1-961a-631661ba55ba'),
  clip('AbstruseEntertainingCaterpillarTBTacoRight-Yl5BeQZlHqiKmCId', '2026-09-28T18:21:25Z', 30, 2, 'Monday Hunts and Twists' + TAIL, 'GooferG', 'Slots', '2886426857', 8484, 'f36e9435-2d3b-4658-8121-50ac6b58a9d8'),
  clip('SquareBlazingSkunkHassaanChop-RHLQvRjqd4e-R-4S', '2026-09-28T18:42:38Z', 60, 1, 'Le preacher max', 'GooferG', 'Slots', '2886426857', 9742, '0bf602bb-3ec8-40b0-9eb9-118349e4dbc3'),
  clip('VivaciousBlueSheepEagleEye-o_WQsEAFJmmslXll', '2026-09-28T18:17:42Z', 30, 1, 'Monday Hunts and Twists' + TAIL, 'GooferG', 'Slots', '2886426857', 8261, 'cf344591-2a12-48b2-b9ab-a554b25d8303'),
];

// Sunday 2026-10-04, noon in Arizona.
export const FIXTURE_NOW = Date.parse('2026-10-04T19:00:00Z');
const cutoff = FIXTURE_NOW - 60 * DAY_MS;

const base = {
  videos: LIVE_VIDEOS,
  topClips: LIVE_TOP_CLIPS,
  recentClips: LIVE_RECENT_CLIPS,
  now: FIXTURE_NOW,
  timeZone: 'America/Phoenix',
  statusReady: true,
};

// The newest tape with a muted stretch, so the timeline's static band shows.
const WITH_MUTED = LIVE_VIDEOS.map((v, i) => (i === 0 ? { ...v, muted_segments: [{ offset: 5400, duration: 600 }] } : v));

export const VIDEO_STORE_FIXTURES = {
  rich: { ...base, videos: WITH_MUTED },
  live: { ...base, isLive: true },
  // Only clips from the last 60 days: no Cult classics aisle.
  fresh: { ...base, topClips: LIVE_TOP_CLIPS.filter((c) => Date.parse(c.created_at) >= cutoff) },
  // No recent clips at all: no Fresh picks aisle.
  classics: {
    ...base,
    recentClips: [],
    topClips: LIVE_TOP_CLIPS.filter((c) => Date.parse(c.created_at) < cutoff),
  },
  // Friday 2026-10-16, 8 AM in Arizona: the Aug 17 tapes are due today.
  expiring: { ...base, now: Date.parse('2026-10-16T15:00:00Z') },
  noclips: { ...base, topClips: [], recentClips: [] },
  nothumb: {
    ...base,
    videos: LIVE_VIDEOS.map((v, i) => {
      if (i === 0) return { ...v, thumbnail_url: '' };
      if (i === 1) return { ...v, thumbnail_url: 'https://vod-secure.twitch.tv/_404/404_processing_%{width}x%{height}.png' };
      return v;
    }),
  },
  empty: { ...base, videos: [], topClips: [], recentClips: [] },
  loading: { ...base, videos: [], topClips: [], recentClips: [], loading: true, statusReady: false },
};
