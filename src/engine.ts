import { TASKS, getTask, type Task } from './tasks';

export const SCHEMA_VERSION = 1;
export const TASK_VERSION = '2026-10-02.1';
export const STORAGE_KEY = 'explain-fit:v1';
export type Condition = 'A' | 'B';
export type Phase = 'reading' | 'answering' | 'rating' | 'done';
export type RoundSet = 'initial' | 'retest';
export type PauseReason = 'manual' | 'hidden' | 'reload' | 'exit';
export interface Interruption { at: string; reason: PauseReason; resumedAt?: string }
export interface Trial {
  taskId: string; condition: Condition; phase: Phase; answers: (number | null)[];
  readingMs: number; answeringMs: number; startedAt: number | null;
  paused: boolean; interruptions: Interruption[]; timingUncertain: boolean;
  effort: number | null; preference: number | null; skipped: boolean;
  openedAt: string | null; finishedAt: string | null;
}
export interface Round {
  id: string; set: RoundSet; seed: number; sequence: string; createdAt: string; completedAt: string | null;
  status: 'active' | 'complete' | 'stopped'; trials: Trial[]; index: number;
  overallPreference: Condition | 'same' | 'unsure' | null; familiarity: 'new' | 'some' | 'many';
  taskVersion: string; day: string; device: { width: number; height: number; language: string };
}
export interface Store { schemaVersion: 1; rounds: Round[] }
export const emptyStore = (): Store => ({ schemaVersion: 1, rounds: [] });
export function seededRandom(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy;
}
export function newTrial(taskId: string, condition: Condition): Trial {
  return { taskId, condition, phase: 'reading', answers: getTask(taskId).questions.map(() => null), readingMs: 0, answeringMs: 0, startedAt: null, paused: false, interruptions: [], timingUncertain: false, effort: null, preference: null, skipped: false, openedAt: null, finishedAt: null };
}
export function makeRound(set: RoundSet, seed: number, now: number, familiarity: Round['familiarity'] = 'new', priorTaskIds: string[] = [], device = { width: 0, height: 0, language: 'ja' }): Round {
  const random = seededRandom(seed);
  const sequence = random() < .5 ? 'ABBABAAB' : 'BAABABBA';
  const source = TASKS.filter(t => t.set === set && !priorTaskIds.includes(t.id));
  const pairIds = shuffle([...new Set(source.map(t => t.pairId))], random);
  if (pairIds.length !== 4 || source.length !== 8) throw new Error('未見の8課題を用意できません。すでに使用したセットは再利用できません。');
  // Each pair gets opposite conditions; pairs 1/2 appear in the first half and 3/4 in the second.
  const trials = pairIds.flatMap(pair => shuffle(source.filter(t => t.pairId === pair), random)).map((task, i) => newTrial(task.id, sequence[i] as Condition));
  const date = new Date(now);
  return { id: `${set}-${now}-${seed}`, set, seed, sequence, createdAt: date.toISOString(), completedAt: null, status: 'active', trials, index: 0, overallPreference: null, familiarity, taskVersion: TASK_VERSION, day: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, device };
}
export function startTrial(trial: Trial, now: number): Trial {
  if (trial.openedAt || trial.phase !== 'reading' || trial.paused) return trial;
  return { ...trial, startedAt: now, openedAt: new Date(now).toISOString() };
}
export function elapsed(trial: Trial, now: number): {readingMs:number; answeringMs:number; totalMs:number} {
  const delta = trial.startedAt !== null && !trial.paused ? Math.max(0, now - trial.startedAt) : 0;
  const readingMs = trial.readingMs + (trial.phase === 'reading' ? delta : 0);
  const answeringMs = trial.answeringMs + (trial.phase === 'answering' ? delta : 0);
  return { readingMs, answeringMs, totalMs: readingMs + answeringMs };
}
function settle(trial: Trial, now: number): Trial { const {readingMs, answeringMs} = elapsed(trial, now); return {...trial, readingMs, answeringMs, startedAt: null}; }
export function pauseTrial(trial: Trial, now: number, reason: PauseReason): Trial {
  if (trial.paused || trial.phase === 'done' || !trial.openedAt) return trial;
  return {...settle(trial, now), paused: true, interruptions: [...trial.interruptions, {at: new Date(now).toISOString(), reason}]};
}
export function resumeTrial(trial: Trial, now: number): Trial {
  if (!trial.paused || !trial.openedAt || trial.phase === 'done') return trial;
  const interruptions = trial.interruptions.map((event, i) => i === trial.interruptions.length - 1 ? {...event, resumedAt: new Date(now).toISOString()} : event);
  return {...trial, paused: false, interruptions, startedAt: trial.phase === 'reading' || trial.phase === 'answering' ? now : null};
}
export function advanceToAnswer(trial: Trial, now: number): Trial {
  if (trial.phase !== 'reading' || trial.paused || !trial.openedAt) return trial;
  return {...settle(trial, now), phase: 'answering', startedAt: now};
}
export function advanceToRating(trial: Trial, now: number, skipped = false): Trial {
  if (trial.paused || !trial.openedAt || trial.phase === 'done' || trial.phase === 'rating') return trial;
  return {...settle(trial, now), phase: 'rating', skipped};
}
export function finishTrial(trial: Trial, now: number): Trial {
  if (trial.phase !== 'rating' || trial.paused || !trial.openedAt) return trial;
  return {...trial, phase: 'done', startedAt: null, finishedAt: new Date(now).toISOString()};
}
export function scoreTrial(trial: Trial) {
  const task = getTask(trial.taskId);
  const score = (kind: 'retrieval' | 'application') => task.questions.reduce((acc, q, i) => {
    if (q.kind !== kind) return acc;
    acc.possible++; if (trial.answers[i] === null || trial.answers[i] === undefined) acc.missing++; else {acc.answered++; if (trial.answers[i] === q.correctIndex) acc.correct++;} return acc;
  }, {correct:0, answered:0, possible:0, missing:0});
  return {retrieval: score('retrieval'), application: score('application')};
}
export function conditionSummary(round: Round, condition: Condition) {
  const trials = round.trials.filter(t => t.condition === condition);
  const finished = trials.filter(t => t.phase === 'done');
  // Answers are committed before the rating screen, even if the session stops there.
  const confirmed = trials.filter(t => t.phase === 'rating' || t.phase === 'done');
  const applications = confirmed.map(t => scoreTrial(t).application);
  const retrievals = confirmed.map(t => scoreTrial(t).retrieval);
  const completeTrials = finished.filter(t => !t.skipped && scoreTrial(t).application.missing === 0 && scoreTrial(t).retrieval.missing === 0);
  const uninterrupted = completeTrials.filter(t => !t.timingUncertain && t.interruptions.length === 0);
  const mean = (values:number[]) => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
  return {condition, count: finished.length, planned: trials.length, applicationCorrect: applications.reduce((n,s)=>n+s.correct,0), applicationAnswered: applications.reduce((n,s)=>n+s.answered,0), applicationMissing: trials.length*3-applications.reduce((n,s)=>n+s.answered,0), retrievalCorrect: retrievals.reduce((n,s)=>n+s.correct,0), retrievalAnswered: retrievals.reduce((n,s)=>n+s.answered,0), effort: mean(finished.flatMap(t=>t.effort === null?[]:[t.effort])), effortN: finished.filter(t=>t.effort !== null).length, preference: mean(finished.flatMap(t=>t.preference === null?[]:[t.preference])), preferenceN: finished.filter(t=>t.preference !== null).length, readingMs: mean(uninterrupted.map(t=>t.readingMs)), answeringMs: mean(uninterrupted.map(t=>t.answeringMs)), totalMs: mean(uninterrupted.map(t=>t.readingMs+t.answeringMs)), timeN: uninterrupted.length, complete: completeTrials.length};
}
export function roundWarnings(round: Round): string[] {
  const finished = round.trials.filter(t=>t.phase === 'done');
  const complete = finished.filter(t=>!t.skipped && scoreTrial(t).application.missing === 0);
  const warnings: string[] = [];
  if (finished.length < 8 || finished.some(t=>t.skipped || scoreTrial(t).application.missing>0 || scoreTrial(t).retrieval.missing>0)) warnings.push('未完了・未回答があります。欠測は誤答に数えず、分母を分けて表示しています。');
  if (complete.length === 8 && complete.every(t=>scoreTrial(t).application.correct===3)) warnings.push('天井の可能性：応用問題が全問正解です。この課題の難しさでは形式差を捉えにくいかもしれません。');
  if (complete.length === 8 && complete.every(t=>scoreTrial(t).application.correct===0)) warnings.push('床の可能性：応用問題が全問不正解です。課題や説明の難しさを見直す必要があります。');
  if (finished.some(t=>t.interruptions.length>0 || t.timingUncertain)) warnings.push('中断のある課題は時間の平均から除外しました。正答と評定は別に表示しています。');
  return warnings;
}
export function restoreStore(raw: string | null, now: number): Store {
  if (!raw) return emptyStore();
  const data = JSON.parse(raw) as Store;
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.rounds)) throw new Error('保存データの版を読み込めません。');
  const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const rating = (value: unknown) => value === null || (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7);
  const seenTasks = new Set<string>();
  const seenRounds = new Set<string>();
  let initialComplete = false;
  for (const round of data.rounds) {
    if (!round || !Array.isArray(round.trials) || round.trials.length !== 8 || !['initial','retest'].includes(round.set) || !Number.isInteger(round.index) || round.index < 0 || round.index > 7
      || typeof round.id !== 'string' || !round.id || seenRounds.has(round.id) || !Number.isInteger(round.seed)
      || !['ABBABAAB','BAABABBA'].includes(round.sequence) || !['active','complete','stopped'].includes(round.status)
      || !['new','some','many'].includes(round.familiarity) || ![null,'A','B','same','unsure'].includes(round.overallPreference)
      || !validDate(round.createdAt) || (round.completedAt !== null && !validDate(round.completedAt))
      || typeof round.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(round.day) || round.taskVersion !== TASK_VERSION
      || !round.device || !nonnegative(round.device.width) || !nonnegative(round.device.height) || typeof round.device.language !== 'string') throw new Error('保存データの形式を読み込めません。');
    if (round.set === 'retest' && !initialComplete) throw new Error('再確認より前に、初回の完了記録が必要です。');
    seenRounds.add(round.id);
    for (let i=0;i<round.trials.length;i++) {
      const trial = round.trials[i];
      if (!trial || typeof trial.taskId !== 'string') throw new Error('課題の保存データが不正です。');
      const task = getTask(trial.taskId);
      if (task.set !== round.set || seenTasks.has(trial.taskId) || trial.condition !== round.sequence[i]
        || !['reading','answering','rating','done'].includes(trial.phase) || !Array.isArray(trial.answers) || trial.answers.length !== task.questions.length
        || trial.answers.some((answer, q) => answer !== null && (!Number.isInteger(answer) || answer < 0 || answer >= task.questions[q].options.length))
        || !nonnegative(trial.readingMs) || !nonnegative(trial.answeringMs) || (trial.startedAt !== null && !nonnegative(trial.startedAt))
        || typeof trial.paused !== 'boolean' || typeof trial.timingUncertain !== 'boolean' || typeof trial.skipped !== 'boolean'
        || !rating(trial.effort) || !rating(trial.preference) || !Array.isArray(trial.interruptions)
        || trial.interruptions.some(event => !event || !validDate(event.at) || !['manual','hidden','reload','exit'].includes(event.reason) || (event.resumedAt !== undefined && !validDate(event.resumedAt)))
        || (trial.openedAt !== null && !validDate(trial.openedAt)) || (trial.finishedAt !== null && !validDate(trial.finishedAt))
        || (trial.phase === 'done') !== (trial.finishedAt !== null)
        || ((trial.paused || trial.phase === 'rating' || trial.phase === 'done') && trial.startedAt !== null)
        || (trial.phase === 'done' && trial.paused)
        || (!trial.openedAt && (trial.phase !== 'reading' || trial.startedAt !== null || trial.paused || trial.readingMs !== 0 || trial.answeringMs !== 0 || trial.interruptions.length > 0 || trial.answers.some(answer => answer !== null) || trial.effort !== null || trial.preference !== null || trial.skipped || trial.timingUncertain))
        || (trial.openedAt && !trial.paused && ['reading','answering'].includes(trial.phase) && trial.startedAt === null)) throw new Error('課題の保存データが不正です。');
      if (round.status !== 'complete' && (
        (i < round.index && trial.phase !== 'done') || (i === round.index && trial.phase === 'done') || (i > round.index && trial.openedAt !== null)
      )) throw new Error('保存データの進行状態が不正です。');
      seenTasks.add(trial.taskId);
      if (trial.openedAt && trial.phase !== 'done' && !trial.paused) {
        // Never count an unknown offline interval as task time.
        trial.timingUncertain = trial.phase !== 'rating' || trial.timingUncertain;
        trial.startedAt = null; trial.paused = true;
        trial.interruptions.push({at:new Date(now).toISOString(), reason:'reload'});
      }
    }
    if ((round.status === 'complete') !== (round.completedAt !== null)
      || (round.status === 'complete' && (round.index !== 7 || round.trials.some(trial => trial.phase !== 'done')))) throw new Error('保存データの完了状態が不正です。');
    for (const pairId of new Set(round.trials.map(trial => getTask(trial.taskId).pairId))) {
      const pair = round.trials.filter(trial => getTask(trial.taskId).pairId === pairId);
      if (pair.length !== 2 || pair[0].condition === pair[1].condition) throw new Error('対応課題の表示形式の割り当てが不正です。');
    }
    if (round.set === 'initial') initialComplete = round.status === 'complete';
  }
  return data;
}
export function exportData(store: Store) {
  return JSON.stringify({schemaVersion:SCHEMA_VERSION, taskVersion:TASK_VERSION, exportedAt:new Date().toISOString(), purpose:'探索的な本人内の説明形式比較。検査・診断ではありません。', comparison:'A:連続した文章 / B:同一文を意味のまとまりで改行・空白。説明は回答中も表示。', timing:'読む時間=説明表示から問題に進むまで。解く時間=設問表示から回答確定まで（読み直しを含む）。計=この2区間。中断は除外。再読込中の時間は不明。評定時間は含めない。', missingPolicy:'nullは未回答。未着手・中断・スキップを誤答として扱わない。', tasks:TASKS, rounds:store.rounds.map(round=>({...round, scores:round.trials.map(t=>({taskId:t.taskId,...scoreTrial(t)})), summaries:([ 'A','B'] as const).map(c=>conditionSummary(round,c)), warnings:roundWarnings(round)}))},null,2);
}
export function normalizedPassage(task:Task): string { return task.paragraphs.join('').replace(/\s/gu,''); }
