import { Injectable } from '@angular/core';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

export interface GolfRound {
  id: string;
  date: string;
  course: string;
  startingHole: 1 | 10;
  playerName: string;
  score: number;
  holes: (number | null)[];
  friends: GolfFriendScore[];
}

export function courseHoleIndex(
  parCount: number,
  holes: (number | null)[],
  startingHole: 1 | 10,
  scoreIndex: number
): number | null {
  if (parCount === 9) {
    return holes.length === 9 ? scoreIndex : null;
  }

  const courseHole = holes.length === 9 && startingHole === 10
    ? scoreIndex + 9
    : scoreIndex;
  return courseHole < parCount ? courseHole : null;
}

export interface GolfCourse {
  name: string;
  pars: number[];
  backgroundImagePath?: string | null;
  backgroundImageOpacity?: number;
  backgroundImageUrl?: string | null;
}

export interface GolfFriendScore {
  name: string;
  holes: (number | null)[];
}

export interface ImportedGolfRound {
  date: string;
  course: string;
  startingHole?: 1 | 10;
  playerName?: string;
  score: number;
  holes: (number | null)[];
  friends?: GolfFriendScore[];
}

export interface ParsedGolfImport {
  rounds: ImportedGolfRound[];
  skippedWithoutScores: number;
}

export interface GolfImportResult {
  added: number;
  merged: number;
  combined: number;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface DatabaseGolfRound {
  id: string;
  played_on: string;
  course: string;
  starting_hole: 1 | 10;
  player_name: string;
  total_strokes: number;
  hole_strokes: (number | null)[];
  friend_scores: GolfFriendScore[];
}

export function isGolfRoundData(value: unknown): value is { rounds: ImportedGolfRound[] } {
  if (typeof value !== 'object' || value === null || !('rounds' in value)) {
    return false;
  }

  return Array.isArray(value.rounds) && value.rounds.every((round: unknown) => {
    if (typeof round !== 'object' || round === null) {
      return false;
    }

    return (
      'date' in round &&
      typeof round.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(round.date) &&
      'course' in round &&
      typeof round.course === 'string' &&
      round.course.trim().length > 0 &&
      (!('playerName' in round) ||
        (typeof round.playerName === 'string' && round.playerName.trim().length > 0)) &&
      'score' in round &&
      typeof round.score === 'number' &&
      Number.isInteger(round.score) &&
      round.score > 0 &&
      'holes' in round &&
      Array.isArray(round.holes) &&
      [9, 18].includes(round.holes.length) &&
      round.holes.every(
        (strokes: unknown) =>
          strokes === null ||
          (typeof strokes === 'number' && Number.isInteger(strokes) && strokes > 0)
      )
    );
  });
}

export function parseGolfImportData(value: unknown): ParsedGolfImport {
  if (isGolfRoundData(value)) {
    let skippedWithoutScores = 0;
    const rounds = value.rounds.flatMap((round) => {
      const score = round.holes.reduce<number>((total, strokes) => total + (strokes ?? 0), 0);
      if (score < 1) {
        skippedWithoutScores++;
        return [];
      }
      return [{ ...round, score }];
    });
    return { rounds, skippedWithoutScores };
  }

  if (typeof value !== 'object' || value === null || !('myData' in value)) {
    throw new Error('Choose an 18Birdies JSON export or a sanitized golf rounds JSON file.');
  }

  const myData = value.myData;
  if (
    typeof myData !== 'object' ||
    myData === null ||
    !('activityData' in myData) ||
    typeof myData.activityData !== 'object' ||
    myData.activityData === null ||
    !('rounds' in myData.activityData) ||
    !Array.isArray(myData.activityData.rounds) ||
    !('clubData' in myData) ||
    typeof myData.clubData !== 'object' ||
    myData.clubData === null ||
    !('playedClubs' in myData.clubData) ||
    !Array.isArray(myData.clubData.playedClubs)
  ) {
    throw new Error('The 18Birdies file is missing its round or course data.');
  }

  const courses = new Map<string, string>();
  for (const club of myData.clubData.playedClubs) {
    if (
      typeof club === 'object' &&
      club !== null &&
      'clubId' in club &&
      typeof club.clubId === 'string' &&
      'name' in club &&
      typeof club.name === 'string' &&
      club.name.trim()
    ) {
      courses.set(club.clubId, club.name.trim());
    }
  }

  let playerName = 'You';
  if (
    'accountData' in myData &&
    typeof myData.accountData === 'object' &&
    myData.accountData !== null &&
    'userName' in myData.accountData &&
    typeof myData.accountData.userName === 'string' &&
    myData.accountData.userName.trim()
  ) {
    playerName = myData.accountData.userName.trim().slice(0, 80);
  }

  let skippedWithoutScores = 0;
  const rounds = myData.activityData.rounds.flatMap((round, index) => {
    if (typeof round !== 'object' || round === null) {
      throw new Error(`18Birdies round ${index + 1} has an unsupported format.`);
    }

    const timestamp = 'timestamp' in round ? round.timestamp : undefined;
    const courseId =
      'clubId' in round &&
      typeof round.clubId === 'object' &&
      round.clubId !== null &&
      'id' in round.clubId &&
      typeof round.clubId.id === 'string'
        ? round.clubId.id
        : undefined;
    const course = courseId ? courses.get(courseId) : undefined;
    const holeStrokes = 'holeStrokes' in round ? round.holeStrokes : undefined;
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(Number.NaN);

    if (
      !course ||
      !Number.isFinite(date.getTime()) ||
      !Array.isArray(holeStrokes) ||
      ![9, 18].includes(holeStrokes.length) ||
      !holeStrokes.every(
        (strokes: unknown) =>
          typeof strokes === 'number' && Number.isInteger(strokes) && strokes >= 0
      )
    ) {
      throw new Error(`18Birdies round ${index + 1} has missing or unsupported course, date, or hole scores.`);
    }

    const holes = holeStrokes.map((strokes) => (strokes === 0 ? null : strokes));
    const score = holes.reduce<number>((total, strokes) => total + (strokes ?? 0), 0);
    if (score < 1) {
      skippedWithoutScores++;
      return [];
    }

    return [{
      date: date.toISOString().slice(0, 10),
      course,
      playerName,
      score,
      holes
    }];
  });
  return { rounds, skippedWithoutScores };
}

@Injectable({ providedIn: 'root' })
export class GolfLogService {
  private clientPromise?: Promise<SupabaseClient>;

  async getClient(): Promise<SupabaseClient> {
    this.clientPromise ??= this.createConfiguredClient();
    return this.clientPromise;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await (await this.getClient()).auth.getSession();
    if (error) {
      throw error;
    }
    return data.session;
  }

  async onAuthStateChange(
    callback: (session: Session | null) => void
  ): Promise<() => void> {
    const { data } = (await this.getClient()).auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await (await this.getClient()).auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await (await this.getClient()).auth.signOut();
    if (error) {
      throw error;
    }
  }

  async isAdmin(): Promise<boolean> {
    const { data, error } = await (await this.getClient()).rpc('is_golf_log_admin');
    if (error) {
      throw error;
    }
    return data === true;
  }

  async getRounds(): Promise<GolfRound[]> {
    const { data, error } = await (await this.getClient())
      .from('golf_rounds')
      .select('id, played_on, course, starting_hole, player_name, total_strokes, hole_strokes, friend_scores')
      .order('played_on', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as DatabaseGolfRound[]).map((round) => {
      if (!Array.isArray(round.hole_strokes) || !Array.isArray(round.friend_scores)) {
        throw new Error(
          'A round has no scorecard data. Verify that the friends migration was applied in Supabase and reload the page.'
        );
      }

      return {
        id: round.id,
        date: round.played_on,
        course: round.course,
        startingHole: round.starting_hole,
        playerName: round.player_name,
        score: round.total_strokes,
        holes: round.hole_strokes,
        friends: round.friend_scores
      };
    });
  }

  async getCourseConfigs(): Promise<GolfCourse[]> {
    const { data, error } = await (await this.getClient())
      .from('golf_courses')
      .select('name, pars, background_image_path, background_image_opacity')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const client = await this.getClient();
    return data.map((course) => ({
      name: course.name,
      pars: course.pars,
      backgroundImagePath: course.background_image_path,
      backgroundImageOpacity: course.background_image_opacity,
      backgroundImageUrl: course.background_image_path
        ? client.storage.from('golf-course-images').getPublicUrl(course.background_image_path).data.publicUrl
        : null
    }));
  }

  async saveCourseConfig(name: string, pars: number[]): Promise<void> {
    const { error } = await (await this.getClient())
      .from('golf_courses')
      .upsert({ name: name.trim(), pars }, { onConflict: 'name' });

    if (error) {
      throw error;
    }
  }

  async uploadCourseBackground(name: string, file: File, opacity: number): Promise<void> {
    const client = await this.getClient();
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.slice('image/'.length);
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from('golf-course-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data, error: updateError } = await client
      .from('golf_courses')
      .update({
        background_image_path: path,
        background_image_opacity: opacity
      })
      .eq('name', name.trim())
      .select('background_image_path')
      .maybeSingle();

    if (updateError || !data) {
      const { error: cleanupError } = await client.storage
        .from('golf-course-images')
        .remove([path]);
      const reason = updateError?.message
        ?? 'Course configuration was not found. Save its pars before uploading an image.';
      if (cleanupError) {
        throw new Error(`${reason} The uploaded file could not be cleaned up: ${cleanupError.message}`);
      }
      throw new Error(reason);
    }
  }

  async updateCourseBackgroundOpacity(name: string, opacity: number): Promise<void> {
    const { data, error } = await (await this.getClient())
      .from('golf_courses')
      .update({ background_image_opacity: opacity })
      .eq('name', name.trim())
      .select('name')
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('Course configuration was not found. Save its pars before changing image opacity.');
    }
  }

  async addRound(round: ImportedGolfRound): Promise<void> {
    const { error } = await (await this.getClient()).from('golf_rounds').insert({
      played_on: round.date,
      course: round.course.trim(),
      starting_hole: round.startingHole ?? 1,
      player_name: round.playerName?.trim() || 'You',
      total_strokes: round.score,
      hole_strokes: round.holes,
      friend_scores: round.friends ?? []
    });

    if (error) {
      throw error;
    }
  }

  async updateRound(id: string, round: ImportedGolfRound): Promise<void> {
    const { error } = await (await this.getClient())
      .from('golf_rounds')
      .update({
        played_on: round.date,
        course: round.course.trim(),
        starting_hole: round.startingHole ?? 1,
        player_name: round.playerName?.trim() || 'You',
        total_strokes: round.score,
        hole_strokes: round.holes,
        friend_scores: round.friends ?? []
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async deleteRound(id: string): Promise<void> {
    const { data, error } = await (await this.getClient())
      .from('golf_rounds')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('The round was not deleted. It may no longer exist or you may not have permission.');
    }
  }

  async importRounds(rounds: ImportedGolfRound[]): Promise<GolfImportResult> {
    const existing = await this.getRounds();
    const groups = this.groupRounds([...existing, ...rounds]);
    let added = 0;
    let merged = 0;
    let combined = 0;

    for (const group of groups) {
      const groupExisting = group.filter(this.isStoredRound);
      const groupImported = group.filter(this.isImportedRound);
      if (groupImported.length === 0) {
        continue;
      }

      try {
        const mergedRound = this.mergeRoundCards(groupExisting, groupImported);
        if (groupExisting.length === 0) {
          await this.addRound(mergedRound);
          added++;
          continue;
        }

        await this.saveMergedRound(groupExisting, mergedRound);
        merged++;
        combined += Math.max(0, groupExisting.length - 1);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Import stopped after adding ${added} rounds and merging ${merged} matching rounds. ${reason}`
        );
      }
    }

    return { added, merged, combined };
  }

  private groupRounds(rounds: (GolfRound | ImportedGolfRound)[]): (GolfRound | ImportedGolfRound)[][] {
    const groups = new Map<string, (GolfRound | ImportedGolfRound)[]>();
    for (const round of rounds) {
      const key = [
        round.date,
        round.course.trim().toLocaleLowerCase(),
        round.startingHole ?? 1,
        round.holes.length
      ].join('|');
      const group = groups.get(key) ?? [];
      group.push(round);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private isStoredRound(round: GolfRound | ImportedGolfRound): round is GolfRound {
    return 'id' in round;
  }

  private isImportedRound(round: GolfRound | ImportedGolfRound): round is ImportedGolfRound {
    return !('id' in round);
  }

  private mergeRoundCards(
    existing: GolfRound[],
    incoming: ImportedGolfRound[]
  ): ImportedGolfRound {
    const cards = new Map<string, GolfFriendScore>();
    const orderedExisting = [...existing].reverse();

    for (const round of orderedExisting) {
      cards.set(round.playerName.trim().toLocaleLowerCase(), {
        name: round.playerName.trim(),
        holes: round.holes
      });
      for (const friend of round.friends) {
        cards.set(friend.name.trim().toLocaleLowerCase(), friend);
      }
    }
    for (const round of incoming) {
      cards.set((round.playerName?.trim() || 'You').toLocaleLowerCase(), {
        name: round.playerName?.trim() || 'You',
        holes: round.holes
      });
      for (const friend of round.friends ?? []) {
        cards.set(friend.name.trim().toLocaleLowerCase(), friend);
      }
    }

    const preferredPrimaryName = existing[0]?.playerName
      ?? incoming[0]?.playerName?.trim()
      ?? 'You';
    const primaryKey = preferredPrimaryName.toLocaleLowerCase();
    const primary = cards.get(primaryKey) ?? [...cards.values()][0];
    if (!primary) {
      throw new Error('Cannot merge a round without at least one player scorecard.');
    }

    const source = existing[0] ?? incoming[0];
    if (!source) {
      throw new Error('Cannot merge an empty round group.');
    }

    return {
      date: source.date,
      course: source.course,
      startingHole: source.startingHole ?? 1,
      playerName: primary.name,
      score: primary.holes.reduce<number>((total, strokes) => total + (strokes ?? 0), 0),
      holes: primary.holes,
      friends: [...cards.entries()]
        .filter(([name]) => name !== primaryKey)
        .map(([, card]) => card)
    };
  }

  private async saveMergedRound(
    existing: GolfRound[],
    mergedRound: ImportedGolfRound
  ): Promise<void> {
    const keeper = existing[0];
    if (!keeper) {
      throw new Error('Cannot save a merged round without an existing round.');
    }

    const stagedRound: ImportedGolfRound = {
      ...mergedRound,
      playerName: keeper.playerName,
      score: keeper.score,
      holes: keeper.holes,
      startingHole: keeper.startingHole,
      friends: (mergedRound.friends ?? []).filter(
        (friend) => friend.name.trim().toLocaleLowerCase() !== keeper.playerName.trim().toLocaleLowerCase()
      )
    };
    await this.updateRound(keeper.id, stagedRound);

    for (const duplicate of existing.slice(1)) {
      await this.deleteRound(duplicate.id);
    }

    await this.updateRound(keeper.id, mergedRound);
  }

  private async createConfiguredClient(): Promise<SupabaseClient> {
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error(`Could not load site configuration (HTTP ${response.status}).`);
    }

    const config: unknown = await response.json();
    if (
      typeof config !== 'object' ||
      config === null ||
      !('url' in config) ||
      typeof config.url !== 'string' ||
      !('anonKey' in config) ||
      typeof config.anonKey !== 'string' ||
      !config.url.trim() ||
      !config.anonKey.trim()
    ) {
      throw new Error('Supabase is not configured. Set the project URL and anon key in config.json.');
    }

    return createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    });
  }
}
