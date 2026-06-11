import AsyncStorage from "@react-native-async-storage/async-storage";

import { LeaderboardEntry } from "../types/game";

const LEADERBOARD_KEY = "ssb_leaderboard_v1";

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function saveLeaderboardEntry(
  entry: LeaderboardEntry,
): Promise<LeaderboardEntry[]> {
  try {
    const current = await getLeaderboard();
    const updated = [...current, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    await AsyncStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [entry];
  }
}
