import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputArgument = process.argv[2];

if (!inputArgument || process.argv.length > 3) {
  console.error('Usage: npm run import:golf -- <path-to-18Birdies-JSON>');
  process.exit(1);
}

const inputPath = resolve(process.cwd(), inputArgument);
const outputPath = resolve(process.cwd(), 'scripts', 'data', 'golf-rounds.json');

try {
  const source = JSON.parse(await readFile(inputPath, 'utf8'));
  const myData = source?.myData;
  const rounds = myData?.activityData?.rounds;
  const clubs = myData?.clubData?.playedClubs;

  if (!Array.isArray(rounds) || !Array.isArray(clubs)) {
    throw new Error('The file does not contain 18Birdies round and club data.');
  }

  const courseNames = new Map(
    clubs
      .filter((club) => typeof club?.clubId === 'string' && typeof club?.name === 'string')
      .map((club) => [club.clubId, club.name.trim()])
  );
  const playerName = myData.accountData?.userName?.trim().slice(0, 80) || 'You';

  let skippedWithoutScores = 0;
  const publicRounds = rounds.flatMap((round, index) => {
    const courseId = round?.clubId?.id;
    const course = courseNames.get(courseId);
    const date = new Date(round?.timestamp);
    const holes = round?.holeStrokes;

    if (
      !course ||
      !Number.isFinite(date.getTime()) ||
      !Array.isArray(holes) ||
      ![9, 18].includes(holes.length) ||
      !holes.every((strokes) => Number.isInteger(strokes) && strokes >= 0)
    ) {
      throw new Error(`Round ${index + 1} has missing or unsupported course, date, or score data.`);
    }

    const normalizedHoles = holes.map((strokes) => strokes || null);
    const score = normalizedHoles.reduce((total, strokes) => total + (strokes || 0), 0);
    if (score < 1) {
      skippedWithoutScores++;
      return [];
    }

    return [{
      date: date.toISOString().slice(0, 10),
      course,
      playerName,
      score,
      holes: normalizedHoles
    }];
  });

  publicRounds.sort((left, right) => right.date.localeCompare(left.date));

  await mkdir(resolve(process.cwd(), 'scripts', 'data'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ rounds: publicRounds }, null, 2)}\n`, 'utf8');
  console.log(`Prepared ${publicRounds.length} rounds in scripts/data/golf-rounds.json.`);
  console.log(`Skipped ${skippedWithoutScores} rounds with no recorded hole scores.`);
  console.log('Only player name, round dates, course names, calculated totals, and hole scores were included.');
} catch (error) {
  console.error(`Golf log import failed: ${error.message}`);
  process.exitCode = 1;
}
