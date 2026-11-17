/**
 * Curated line-up for the "Guide" view — a traditional cable-guide-style
 * list of major networks, instead of the full "All TV" catalog (12k+
 * channels across every affiliate market). Verified against this
 * provider's real channel names.
 *
 * Local broadcast picks are the Denver, CO market (matched by FCC call
 * sign, which is far more stable across catalog refreshes than the
 * decorative text around it — e.g. "TV: DENVER, CO KCNC CBS 4 A3 HD
 * (D11) DENVER ᶜᶦᵗʸ ᴿᴬᵂ"). Channel numbers for locals match their real
 * Denver over-the-air numbers; cable networks get a grouped 100s/200s/
 * 300s/400s block (sports/news/entertainment/kids) like a real guide.
 */
export interface GuideSlot {
  num: number;
  network: string;
  pattern: RegExp;
}

export const GUIDE_CHANNELS: GuideSlot[] = [
  // Denver, CO local broadcast (by call sign)
  { num: 2, network: 'CW (KWGN)', pattern: /\bKWGN\b/i },
  { num: 4, network: 'CBS (KCNC)', pattern: /\bKCNC\b/i },
  { num: 6, network: 'PBS (KRMA)', pattern: /\bKRMA\b/i },
  { num: 7, network: 'ABC (KMGH)', pattern: /\bKMGH\b/i },
  { num: 9, network: 'NBC (KUSA)', pattern: /\bKUSA\b/i },
  { num: 20, network: 'MyNetworkTV (KTVD)', pattern: /\bKTVD\b/i },
  { num: 31, network: 'FOX (KDVR)', pattern: /\bKDVR\b/i },

  // Sports
  { num: 100, network: 'ESPN', pattern: /^US:\s*ESPN\s*HD$/i },
  { num: 101, network: 'ESPN2', pattern: /^US:\s*ESPN\s*2\s*HD$/i },
  { num: 102, network: 'ESPNU', pattern: /^US:\s*ESPN\s*U\s*HD$/i },
  { num: 103, network: 'FOX Sports 1', pattern: /^US:\s*FOX SPORTS 1\s*HD$/i },
  { num: 104, network: 'NFL Network', pattern: /^US:\s*NFL NETWORK\s*HD$/i },
  { num: 105, network: 'Golf Channel', pattern: /^US:\s*GOLF CHANNEL\s*HD$/i },
  { num: 106, network: 'Altitude Sports', pattern: /^US:\s*ALTITUDE SPORTS\s*HD$/i },
  { num: 107, network: 'AT&T SportsNet Rocky Mountain', pattern: /^US:\s*AT&T SPORTSNET ROCKY MOUNTAIN\s*HD$/i },
  { num: 108, network: 'CBS Sports Network', pattern: /^US:\s*CBS SPORTS NETWORK\s*HD$/i },

  // News
  { num: 200, network: 'CNN', pattern: /^US:\s*CNN\s*HD$/i },
  { num: 201, network: 'FOX News', pattern: /^US:\s*FOX NEWS\s*HD$/i },
  { num: 202, network: 'MSNBC', pattern: /^US:\s*MSNBC\s*HD$/i },
  { num: 203, network: 'CNBC', pattern: /^US:\s*CNBC\s*HD$/i },
  { num: 204, network: 'The Weather Channel', pattern: /^US:\s*THE WEATHER CHANNEL\s*HD$/i },

  // Entertainment
  { num: 300, network: 'USA Network', pattern: /^US:\s*USA NETWORK\s*HD$/i },
  { num: 301, network: 'TNT', pattern: /^US:\s*TNT\s*HD$/i },
  { num: 302, network: 'TBS', pattern: /^US:\s*TBS\s*HD$/i },
  { num: 303, network: 'FX', pattern: /^US:\s*FX\s*HD$/i },
  { num: 304, network: 'AMC', pattern: /^US:\s*AMC\s*HD$/i },
  { num: 305, network: 'Comedy Central', pattern: /^US:\s*COMEDY CENTRAL\s*HD$/i },
  { num: 306, network: 'Bravo', pattern: /^US:\s*BRAVO\s*HD$/i },
  { num: 307, network: 'A&E', pattern: /^US:\s*A&E\s*HD$/i },
  { num: 308, network: 'History', pattern: /^US:\s*HISTORY\s*HD$/i },
  { num: 309, network: 'Discovery', pattern: /^US:\s*DISCOVERY\s*HD$/i },
  { num: 310, network: 'HGTV', pattern: /^US:\s*HGTV\s*HD$/i },
  { num: 311, network: 'Food Network', pattern: /^US:\s*FOOD NETWORK\s*HD$/i },
  { num: 312, network: 'TLC', pattern: /^US:\s*TLC\s*HD$/i },
  { num: 313, network: 'Hallmark', pattern: /^US:\s*HALLMARK\s*HD$/i },

  // Kids
  { num: 400, network: 'Disney Channel', pattern: /^US:\s*DISNEY CHANNEL\s*HD$/i },
  { num: 401, network: 'Nickelodeon', pattern: /^US:\s*NICKELODEON\s*HD$/i },
  { num: 402, network: 'Cartoon Network', pattern: /^US:\s*CARTOON NETWORK\s*HD$/i },
  { num: 403, network: 'Disney Jr', pattern: /^US:\s*DISNEY JR\s*HD$/i },
];
