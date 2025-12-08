// Twitch Configuration
export const TWITCH_USERNAME = 'GooferG';
export const TWITCH_CLIENT_ID = '6t0kocnv2iyqathfkgbn60tit8x12b';
export const TWITCH_CLIENT_SECRET = '8hmx5yuuk3nrlt74q9wq4os5r9y198';

export const SOCIAL_LINKS = {
  twitch: 'https://twitch.tv/GooferG',
  youtube: 'https://youtube.com/@Goofer-G',
  twitter: 'https://twitter.com/Goofer_G',
};

export const SCHEDULE = [
  {
    day: 'MONDAY',
    time: '5:00 PM - 11:00 PM EST',
    content: 'Yakuza: Like a Dragon Infinite Wealth',
    status: 'regular',
    gameName: 'Like a Dragon: Infinite Wealth', // For IGDB search
    // coverUrl:
    //   'https://images.igdb.com/igdb/image/upload/t_cover_big/co7rmd.jpg', // Hardcoded cover
  },
  {
    day: 'TUESDAY',
    time: '4:20 PM - 9:00 PM EST',
    content: 'Games And Chilling',
    status: 'regular',
    gameName: 'PlateUp', // No specific game
  },
  {
    day: 'WEDNESDAY',
    time: '4:20 PM - 9:00 PM EST',
    content: 'Variety Gaming',
    status: 'regular',
    gameName: 'TingusGoose', // Variety = no specific game
  },
  {
    day: 'THURSDAY',
    time: 'OFF',
    content: 'Rest Day',
    status: 'off',
    gameName: null,
  },
  {
    day: 'FRY-DAY',
    time: '4:20 PM - 11:00 PM EST',
    content: 'Late Night Vibes - React Content',
    status: 'special',
    gameName: null, // Just chatting content
  },
  {
    day: 'SATURDAY',
    time: '4:00 PM - 10:00 PM EST',
    content: 'Community Game Day',
    status: 'special',
    gameName: null, // Variety community games
  },
  {
    day: 'SUNDAY',
    time: '5:00 PM - 10:00 PM EST',
    content: 'Chill Sunday - Just Chatting',
    status: 'regular',
    gameName: null, // Just chatting
  },
];
