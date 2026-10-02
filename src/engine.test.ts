import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SCHEMA_VERSION, TASK_VERSION, advanceToAnswer, advanceToRating,
  conditionSummary, elapsed, emptyStore, exportData, finishTrial,
  makeRound, newTrial, normalizedPassage, pauseTrial, restoreStore,
  resumeTrial, roundWarnings, scoreTrial, seededRandom, startTrial,
  type Condition, type Round, type Store, type Trial,
} from './engine';
import { TASKS, getTask } from './tasks';

const NOW = Date.UTC(2026, 9, 2, 9);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fresh = () => newTrial('initial-1', 'A');
const round = (seed = 1) => makeRound('initial', seed, NOW);
const correctAnswers = (trial: Trial) => getTask(trial.taskId).questions.map(q => q.correctIndex);
const wrongAnswers = (trial: Trial) => getTask(trial.taskId).questions.map(q => (q.correctIndex + 1) % 4);

function completed(trial: Trial, options: Partial<Trial> = {}): Trial {
  return {
    ...trial, phase: 'done', answers: correctAnswers(trial), readingMs: 1_000,
    answeringMs: 2_000, openedAt: new Date(NOW).toISOString(),
    finishedAt: new Date(NOW + 3_000).toISOString(), startedAt: null,
    effort: 4, preference: 5, ...options,
  };
}

function completedRound(seed = 1): Round {
  const value = round(seed);
  return {
    ...value, status: 'complete', index: 7,
    completedAt: new Date(NOW + 60_000).toISOString(),
    trials: value.trials.map(t => completed(t)),
  };
}

describe('task bank and invariant content', () => {
  it('contains two practice tasks and disjoint, eight-task initial and retest sets', () => {
    assert.equal(TASKS.length, 18);
    assert.equal(new Set(TASKS.map(t => t.id)).size, 18);
    for (const [set, count] of [['practice', 2], ['initial', 8], ['retest', 8]] as const) {
      const tasks = TASKS.filter(t => t.set === set);
      assert.equal(tasks.length, count, set);
      assert.deepEqual(new Set(tasks.map(t => t.id)), new Set(Array.from({ length: count }, (_, i) => `${set}-${i + 1}`)));
    }
  });

  it('has four two-task matched pairs in each measured set', () => {
    for (const set of ['initial', 'retest'] as const) {
      const tasks = TASKS.filter(t => t.set === set);
      const pairs = new Set(tasks.map(t => t.pairId));
      assert.equal(pairs.size, 4);
      for (const pair of pairs) assert.equal(tasks.filter(t => t.pairId === pair).length, 2, pair);
    }
  });

  it('provides exactly one retrieval and three application questions per task', () => {
    for (const task of TASKS) {
      assert.equal(task.questions.length, 4, task.id);
      assert.equal(task.questions.filter(q => q.kind === 'retrieval').length, 1, task.id);
      assert.equal(task.questions.filter(q => q.kind === 'application').length, 3, task.id);
      for (const question of task.questions) {
        assert.equal(question.options.length, 4, task.id);
        assert.equal(new Set(question.options).size, 4, task.id);
        assert.ok(question.prompt.trim().length > 0 && question.explanation.trim().length > 0, task.id);
        assert.equal(Number.isInteger(question.correctIndex), true, task.id);
        assert.ok(question.correctIndex >= 0 && question.correctIndex < 4, task.id);
      }
    }
  });

  it('keeps each passage identical after only whitespace segmentation', () => {
    for (const task of TASKS) {
      assert.ok(task.paragraphs.length > 1, task.id);
      assert.ok(task.paragraphs.every(paragraph => paragraph.trim().length > 0), task.id);
      const continuous = task.paragraphs.join('');
      const segmented = task.paragraphs.join('\n\n');
      assert.equal(normalizedPassage(task), continuous.replace(/\s/gu, ''), task.id);
      assert.equal(normalizedPassage(task), segmented.replace(/\s/gu, ''), task.id);
      assert.equal(normalizedPassage({ ...task, paragraphs: [` \t${segmented}\n　`] }), normalizedPassage(task));
    }
  });

  it('rejects unknown task IDs rather than silently selecting another task', () => {
    assert.throws(() => getTask('missing-task'));
    assert.throws(() => newTrial('missing-task', 'A'));
  });
});

describe('deterministic, counterbalanced assignment', () => {
  it('produces repeatable random values in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 1_000; i++) {
      const sample = a();
      assert.equal(sample, b());
      assert.ok(sample >= 0 && sample < 1);
    }
    assert.notEqual(seededRandom(42)(), seededRandom(43)());
  });

  it('balances A/B in both halves and assigns opposite conditions within every pair across 1,000 seeds', () => {
    const seenSequences = new Set<string>();
    const orders = new Set<string>();
    const taskConditions = new Map<string, Set<Condition>>();
    for (let seed = -100; seed < 900; seed++) {
      for (const set of ['initial', 'retest'] as const) {
        const value = makeRound(set, seed, NOW);
        seenSequences.add(value.sequence);
        orders.add(value.trials.map(t => t.taskId).join(','));
        assert.ok(['ABBABAAB', 'BAABABBA'].includes(value.sequence));
        assert.equal(value.trials.map(t => t.condition).join(''), value.sequence);
        assert.equal(value.trials.length, 8);
        assert.equal(new Set(value.trials.map(t => t.taskId)).size, 8);
        assert.ok(value.trials.every(t => getTask(t.taskId).set === set));
        for (const condition of ['A', 'B'] as const) {
          assert.equal(value.trials.filter(t => t.condition === condition).length, 4);
          assert.equal(value.trials.slice(0, 4).filter(t => t.condition === condition).length, 2);
          assert.equal(value.trials.slice(4).filter(t => t.condition === condition).length, 2);
        }
        for (const pair of new Set(value.trials.map(t => getTask(t.taskId).pairId))) {
          const matched = value.trials.filter(t => getTask(t.taskId).pairId === pair);
          assert.equal(matched.length, 2);
          assert.deepEqual(new Set(matched.map(t => t.condition)), new Set(['A', 'B']));
        }
        for (const trial of value.trials) {
          const conditions = taskConditions.get(trial.taskId) ?? new Set<Condition>();
          conditions.add(trial.condition);
          taskConditions.set(trial.taskId, conditions);
        }
      }
    }
    assert.equal(seenSequences.size, 2);
    assert.ok(orders.size > 100, 'task order varies across seeds');
    for (const [id, conditions] of taskConditions) assert.equal(conditions.size, 2, id);
  });

  it('recreates the full assignment for an identical seed without mutating the task bank', () => {
    const before = JSON.stringify(TASKS);
    assert.deepEqual(round(12345), round(12345));
    assert.equal(JSON.stringify(TASKS), before);
  });

  it('keeps initial and retest content unseen and refuses reuse within a set', () => {
    const initial = round();
    const prior = initial.trials.map(t => t.taskId);
    const retest = makeRound('retest', 5, NOW + 86_400_000, 'some', prior);
    assert.ok(retest.trials.every(t => !prior.includes(t.taskId)));
    assert.throws(() => makeRound('initial', 5, NOW, 'new', prior), /未見/);
    assert.throws(() => makeRound('initial', 5, NOW, 'new', [prior[0]]), /未見/);
    assert.throws(() => makeRound('retest', 5, NOW, 'new', retest.trials.map(t => t.taskId)), /未見/);
  });

  it('retains seed, dates, familiarity, version and device context', () => {
    const device = { width: 1024, height: 768, language: 'ja-JP' };
    const value = makeRound('initial', 27, NOW, 'many', [], device);
    assert.equal(value.seed, 27);
    assert.equal(value.createdAt, new Date(NOW).toISOString());
    assert.equal(value.familiarity, 'many');
    assert.equal(value.taskVersion, TASK_VERSION);
    assert.deepEqual(value.device, device);
    assert.equal(value.status, 'active');
    assert.equal(value.index, 0);
    assert.equal(value.completedAt, null);
    assert.equal(value.overallPreference, null);
    assert.match(value.day, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('trial timing and state transitions', () => {
  it('starts with unmeasured, unanswered data and starts the timer only once', () => {
    const initial = fresh();
    assert.deepEqual(initial.answers, [null, null, null, null]);
    assert.deepEqual(elapsed(initial, NOW), { readingMs: 0, answeringMs: 0, totalMs: 0 });
    assert.equal(initial.openedAt, null);
    assert.equal(initial.startedAt, null);
    const started = startTrial(initial, NOW);
    assert.equal(started.openedAt, new Date(NOW).toISOString());
    assert.equal(started.startedAt, NOW);
    assert.equal(startTrial(started, NOW + 50_000), started);
    assert.equal(initial.startedAt, null, 'input remains unchanged');
  });

  it('cannot advance an unopened trial into an unpausable timed phase', () => {
    const trial = fresh();
    assert.equal(advanceToAnswer(trial, NOW), trial);
    assert.equal(advanceToRating(trial, NOW), trial);
    assert.equal(advanceToRating(trial, NOW, true), trial);
    assert.equal(finishTrial(trial, NOW), trial);
    const malformed = { ...trial, paused: true };
    assert.equal(resumeTrial(malformed, NOW), malformed);
    assert.equal(startTrial(malformed, NOW), malformed);
  });

  it('separates reading and answering time and excludes all rating time', () => {
    const started = startTrial(fresh(), NOW);
    assert.deepEqual(elapsed(started, NOW + 1_200), { readingMs: 1_200, answeringMs: 0, totalMs: 1_200 });
    const answering = advanceToAnswer(started, NOW + 1_200);
    assert.equal(answering.phase, 'answering');
    assert.equal(answering.readingMs, 1_200);
    assert.deepEqual(elapsed(answering, NOW + 3_700), { readingMs: 1_200, answeringMs: 2_500, totalMs: 3_700 });
    const rating = advanceToRating(answering, NOW + 3_700);
    assert.equal(rating.startedAt, null);
    assert.deepEqual(elapsed(rating, NOW + 60_000), { readingMs: 1_200, answeringMs: 2_500, totalMs: 3_700 });
    const done = finishTrial(rating, NOW + 120_000);
    assert.equal(done.phase, 'done');
    assert.equal(done.finishedAt, new Date(NOW + 120_000).toISOString());
    assert.deepEqual(elapsed(done, NOW + 3_600_000), { readingMs: 1_200, answeringMs: 2_500, totalMs: 3_700 });
  });

  it('excludes paused intervals from both reading and answering, without double counting', () => {
    let trial = startTrial(fresh(), NOW);
    trial = pauseTrial(trial, NOW + 1_000, 'manual');
    assert.equal(trial.readingMs, 1_000);
    assert.equal(trial.startedAt, null);
    assert.deepEqual(elapsed(trial, NOW + 20_000), { readingMs: 1_000, answeringMs: 0, totalMs: 1_000 });
    assert.equal(pauseTrial(trial, NOW + 2_000, 'hidden'), trial);
    trial = resumeTrial(trial, NOW + 20_000);
    assert.equal(trial.interruptions[0].resumedAt, new Date(NOW + 20_000).toISOString());
    trial = advanceToAnswer(trial, NOW + 21_000);
    assert.equal(trial.readingMs, 2_000);
    trial = pauseTrial(trial, NOW + 23_000, 'hidden');
    trial = resumeTrial(trial, NOW + 30_000);
    trial = advanceToRating(trial, NOW + 33_000);
    assert.deepEqual(elapsed(trial, NOW + 40_000), { readingMs: 2_000, answeringMs: 5_000, totalMs: 7_000 });
    assert.deepEqual(trial.interruptions.map(i => i.reason), ['manual', 'hidden']);
  });

  it('blocks transitions while paused and keeps repeated/invalid transitions idempotent', () => {
    const reading = startTrial(fresh(), NOW);
    const paused = pauseTrial(reading, NOW + 1_000, 'manual');
    assert.equal(advanceToAnswer(paused, NOW + 2_000), paused);
    assert.equal(advanceToRating(paused, NOW + 2_000, true), paused);
    assert.equal(finishTrial(paused, NOW + 2_000), paused);
    assert.equal(resumeTrial(reading, NOW + 2_000), reading);
    assert.equal(finishTrial(reading, NOW + 2_000), reading);
    const answering = advanceToAnswer(reading, NOW + 2_000);
    assert.equal(advanceToAnswer(answering, NOW + 3_000), answering);
    const rating = advanceToRating(answering, NOW + 3_000);
    assert.equal(advanceToRating(rating, NOW + 4_000), rating);
    assert.equal(advanceToAnswer(rating, NOW + 4_000), rating);
    const done = finishTrial(rating, NOW + 4_000);
    assert.equal(startTrial(done, NOW + 5_000), done);
    assert.equal(pauseTrial(done, NOW + 5_000, 'manual'), done);
    assert.equal(advanceToAnswer(done, NOW + 5_000), done);
    assert.equal(advanceToRating(done, NOW + 5_000), done);
    assert.equal(finishTrial(done, NOW + 5_000), done);
    assert.equal(pauseTrial(fresh(), NOW, 'manual').openedAt, null);
  });

  it('can skip from reading or answering without converting missing answers to incorrect answers', () => {
    for (const phase of ['reading', 'answering'] as const) {
      let trial = startTrial(fresh(), NOW);
      if (phase === 'answering') trial = advanceToAnswer(trial, NOW + 1_000);
      trial = advanceToRating(trial, NOW + 2_000, true);
      assert.equal(trial.phase, 'rating');
      assert.equal(trial.skipped, true);
      assert.equal(scoreTrial(trial).application.missing, 3);
      assert.equal(scoreTrial(trial).application.answered, 0);
    }
  });

  it('does not restart a measurement clock when resuming a paused rating screen', () => {
    let trial = advanceToRating(advanceToAnswer(startTrial(fresh(), NOW), NOW + 1_000), NOW + 3_000);
    trial = pauseTrial(trial, NOW + 50_000, 'hidden');
    trial = resumeTrial(trial, NOW + 60_000);
    assert.equal(trial.startedAt, null);
    assert.deepEqual(elapsed(trial, NOW + 70_000), { readingMs: 1_000, answeringMs: 2_000, totalMs: 3_000 });
  });

  it('does not report negative elapsed time if the system clock moves backwards', () => {
    const reading = startTrial(fresh(), NOW);
    assert.deepEqual(elapsed(reading, NOW - 1_000), { readingMs: 0, answeringMs: 0, totalMs: 0 });
  });
});

describe('scoring and separate condition summaries', () => {
  it('scores every task as 1 retrieval plus 3 application points', () => {
    for (const task of TASKS) {
      const trial = newTrial(task.id, 'A');
      const score = scoreTrial({ ...trial, answers: correctAnswers(trial) });
      assert.deepEqual(score.retrieval, { correct: 1, answered: 1, possible: 1, missing: 0 });
      assert.deepEqual(score.application, { correct: 3, answered: 3, possible: 3, missing: 0 });
    }
  });

  it('distinguishes null/undefined missing responses from incorrect and index-zero responses', () => {
    const trial = fresh();
    assert.deepEqual(scoreTrial(trial), {
      retrieval: { correct: 0, answered: 0, possible: 1, missing: 1 },
      application: { correct: 0, answered: 0, possible: 3, missing: 3 },
    });
    const wrong = scoreTrial({ ...trial, answers: wrongAnswers(trial) });
    assert.equal(wrong.application.correct, 0);
    assert.equal(wrong.application.answered, 3);
    assert.equal(wrong.application.missing, 0);
    const zeros = scoreTrial({ ...trial, answers: [0, 0, 0, 0] });
    assert.equal(zeros.application.answered, 3);
    assert.equal(zeros.retrieval.answered, 1);
    const absent = scoreTrial({ ...trial, answers: [] });
    assert.equal(absent.application.missing, 3);
    assert.equal(absent.retrieval.missing, 1);
  });

  it('counts partial answers independently by question role', () => {
    const trial = fresh();
    const task = getTask(trial.taskId);
    const applications = task.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.kind === 'application');
    const answers = [...trial.answers];
    answers[applications[0].i] = applications[0].q.correctIndex;
    answers[applications[1].i] = (applications[1].q.correctIndex + 1) % 4;
    const result = scoreTrial({ ...trial, answers });
    assert.deepEqual(result.application, { correct: 1, answered: 2, possible: 3, missing: 1 });
    assert.deepEqual(result.retrieval, { correct: 0, answered: 0, possible: 1, missing: 1 });
  });

  it('does not report an unstarted round as zero-percent performance or zero-duration timing', () => {
    for (const condition of ['A', 'B'] as const) {
      const summary = conditionSummary(round(), condition);
      assert.equal(summary.count, 0);
      assert.equal(summary.planned, 4);
      assert.equal(summary.applicationAnswered, 0);
      assert.equal(summary.applicationMissing, 12);
      assert.equal(summary.retrievalAnswered, 0);
      assert.equal(summary.readingMs, null);
      assert.equal(summary.answeringMs, null);
      assert.equal(summary.totalMs, null);
      assert.equal(summary.effort, null);
      assert.equal(summary.preference, null);
      assert.equal(summary.timeN, 0);
    }
  });

  it('separates A/B scores, time, effort, preference and their denominators', () => {
    const value = completedRound();
    value.trials = value.trials.map(t => t.condition === 'A' ? completed(t, {
      readingMs: 1_000, answeringMs: 2_000, effort: 2, preference: 6,
    }) : completed(t, { answers: wrongAnswers(t), readingMs: 3_000, answeringMs: 4_000, effort: 6, preference: 2 }));
    const a = conditionSummary(value, 'A');
    const b = conditionSummary(value, 'B');
    assert.equal(a.applicationCorrect, 12);
    assert.equal(b.applicationCorrect, 0);
    assert.equal(a.applicationAnswered, 12);
    assert.equal(b.applicationAnswered, 12);
    assert.equal(a.retrievalCorrect, 4);
    assert.equal(b.retrievalCorrect, 0);
    assert.equal(a.totalMs, 3_000);
    assert.equal(b.totalMs, 7_000, 'fully answered incorrect trials remain in timing');
    assert.equal(a.effort, 2);
    assert.equal(b.effort, 6);
    assert.equal(a.preference, 6);
    assert.equal(b.preference, 2);
    assert.equal(a.timeN, 4);
    assert.equal(b.timeN, 4);
    assert.equal(a.complete, 4);
    assert.equal(a.effortN, 4);
    assert.equal(a.preferenceN, 4);
  });

  it('excludes interrupted, uncertain, incomplete and skipped trials only from eligible timing', () => {
    const value = completedRound();
    const a = value.trials.filter(t => t.condition === 'A');
    a[0].interruptions = [{ at: new Date(NOW).toISOString(), reason: 'hidden' }];
    a[1].timingUncertain = true;
    a[2].answers[0] = null;
    a[3].skipped = true;
    const summary = conditionSummary(value, 'A');
    assert.equal(summary.count, 4);
    assert.equal(summary.timeN, 0);
    assert.equal(summary.totalMs, null);
    assert.equal(summary.applicationAnswered + summary.retrievalAnswered, 15);
    assert.equal(summary.effortN, 4);
    assert.equal(summary.preferenceN, 4);
    assert.equal(conditionSummary(value, 'B').timeN, 4);
  });

  it('ignores unfinished responses and treats absent ratings as missing, not zero', () => {
    const value = completedRound();
    const a = value.trials.filter(t => t.condition === 'A');
    a[0].phase = 'answering';
    a[1].effort = null;
    a[2].preference = null;
    const summary = conditionSummary(value, 'A');
    assert.equal(summary.count, 3);
    assert.equal(summary.applicationCorrect, 9);
    assert.equal(summary.applicationAnswered, 9);
    assert.equal(summary.applicationMissing, 3);
    assert.equal(summary.effort, 4);
    assert.equal(summary.effortN, 2);
    assert.equal(summary.preference, 5);
    assert.equal(summary.preferenceN, 2);
  });

  it('includes confirmed rating-phase answers without counting unfinished ratings, completion or timing', () => {
    const value = round();
    const a = value.trials.filter(t => t.condition === 'A');
    Object.assign(a[0], completed(a[0], {
      phase: 'rating', finishedAt: null, readingMs: 10_000, answeringMs: 20_000,
      effort: 7, preference: 1,
    }));
    Object.assign(a[1], completed(a[1], { effort: 2, preference: 6 }));
    Object.assign(a[2], completed(a[2], { phase: 'answering', finishedAt: null }));
    const summary = conditionSummary(value, 'A');
    assert.equal(summary.applicationCorrect, 6);
    assert.equal(summary.applicationAnswered, 6);
    assert.equal(summary.applicationMissing, 6);
    assert.equal(summary.retrievalCorrect, 2);
    assert.equal(summary.retrievalAnswered, 2);
    assert.equal(summary.count, 1);
    assert.equal(summary.complete, 1);
    assert.equal(summary.timeN, 1);
    assert.equal(summary.readingMs, 1_000);
    assert.equal(summary.answeringMs, 2_000);
    assert.equal(summary.totalMs, 3_000);
    assert.equal(summary.effort, 2);
    assert.equal(summary.effortN, 1);
    assert.equal(summary.preference, 6);
    assert.equal(summary.preferenceN, 1);
  });

  it('keeps confirmed partial answers when stopped during rating, with genuine missing answers separate', () => {
    const value = round();
    const trial = value.trials[0];
    const applicationIndex = getTask(trial.taskId).questions.findIndex(q => q.kind === 'application');
    const answers = correctAnswers(trial);
    const partial: (number | null)[] = [...answers];
    partial[applicationIndex] = null;
    Object.assign(trial, completed(trial, {
      phase: 'rating', answers: partial, finishedAt: null, paused: true,
      interruptions: [{ at: new Date(NOW).toISOString(), reason: 'exit' }],
    }));
    value.status = 'stopped';
    const summary = conditionSummary(value, trial.condition);
    assert.equal(summary.applicationCorrect, 2);
    assert.equal(summary.applicationAnswered, 2);
    assert.equal(summary.applicationMissing, 10);
    assert.equal(summary.retrievalAnswered, 1);
    assert.equal(summary.count, 0);
    assert.equal(summary.timeN, 0);
    assert.equal(summary.totalMs, null);
    assert.equal(summary.effortN, 0);
    assert.equal(summary.preferenceN, 0);
  });
});

describe('cautious round warnings', () => {
  it('warns about incomplete and missing answers without calling them incorrect', () => {
    assert.ok(roundWarnings(round()).some(w => w.includes('未完了・未回答')));
    const value = completedRound();
    value.trials[0].answers[0] = null;
    assert.ok(roundWarnings(value).some(w => w.includes('欠測は誤答に数えず')));
  });

  it('flags full application ceilings and floors only when all application items were answered', () => {
    const ceiling = completedRound();
    assert.ok(roundWarnings(ceiling).some(w => w.includes('天井')));
    assert.ok(!roundWarnings(ceiling).some(w => w.includes('床')));
    const floor = completedRound();
    floor.trials = floor.trials.map(t => completed(t, { answers: wrongAnswers(t) }));
    assert.ok(roundWarnings(floor).some(w => w.includes('床')));
    assert.ok(!roundWarnings(floor).some(w => w.includes('天井')));
    floor.trials[0].answers = [null, null, null, null];
    assert.ok(!roundWarnings(floor).some(w => w.includes('床')));
    ceiling.trials[0].phase = 'rating';
    assert.ok(!roundWarnings(ceiling).some(w => w.includes('天井')));
  });

  it('does not infer floor/ceiling from mixed performance', () => {
    const value = completedRound();
    value.trials[0].answers = wrongAnswers(value.trials[0]);
    assert.deepEqual(roundWarnings(value), []);
  });

  it('treats an explicitly skipped task as incomplete even if answers were entered before skipping', () => {
    const value = completedRound();
    value.trials[0].skipped = true;
    const warnings = roundWarnings(value);
    assert.ok(warnings.some(w => w.includes('未完了・未回答')));
    assert.ok(!warnings.some(w => w.includes('天井')));
    assert.equal(conditionSummary(value, value.trials[0].condition).complete, 3);
  });

  it('reports exclusions when timing is interrupted or uncertain', () => {
    for (const options of [
      { timingUncertain: true },
      { interruptions: [{ at: new Date(NOW).toISOString(), reason: 'manual' as const }] },
    ]) {
      const value = completedRound();
      Object.assign(value.trials[0], options);
      assert.ok(roundWarnings(value).some(w => w.includes('時間の平均から除外')));
    }
  });
});

describe('reload-safe local persistence', () => {
  it('creates a new empty store for absent storage and preserves completed records', () => {
    assert.deepEqual(restoreStore(null, NOW), emptyStore());
    assert.deepEqual(restoreStore('', NOW), emptyStore());
    const store: Store = { schemaVersion: 1, rounds: [completedRound()] };
    assert.deepEqual(restoreStore(JSON.stringify(store), NOW + 86_400_000), store);
  });

  it('never inflates reading or answering time with an unknown offline interval', () => {
    for (const phase of ['reading', 'answering'] as const) {
      const value = round();
      let trial = startTrial(value.trials[0], NOW);
      trial = pauseTrial(trial, NOW + 1_000, 'manual');
      trial = resumeTrial(trial, NOW + 2_000);
      if (phase === 'answering') trial = advanceToAnswer(trial, NOW + 3_000);
      value.trials[0] = trial;
      const before = { readingMs: trial.readingMs, answeringMs: trial.answeringMs };
      const restored = restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW + 86_400_000);
      const recovered = restored.rounds[0].trials[0];
      assert.equal(recovered.paused, true);
      assert.equal(recovered.startedAt, null);
      assert.equal(recovered.timingUncertain, true);
      assert.equal(recovered.interruptions.at(-1)?.reason, 'reload');
      assert.deepEqual(elapsed(recovered, NOW + 172_800_000), { ...before, totalMs: before.readingMs + before.answeringMs });
      const resumed = resumeTrial(recovered, NOW + 172_800_000);
      const measured = elapsed(resumed, NOW + 172_801_000);
      assert.equal(measured.totalMs, before.readingMs + before.answeringMs + 1_000);
      assert.equal(resumed.timingUncertain, true, 'resuming cannot restore unknown timing');
    }
  });

  it('does not add duplicate reload interruptions for already-paused or unstarted trials', () => {
    const value = round();
    value.trials[0] = pauseTrial(startTrial(value.trials[0], NOW), NOW + 1_000, 'exit');
    const restored = restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW + 50_000);
    assert.deepEqual(restored.rounds[0].trials[0], value.trials[0]);
    assert.deepEqual(restored.rounds[0].trials.slice(1), value.trials.slice(1));
    const again = restoreStore(JSON.stringify(restored), NOW + 100_000);
    assert.deepEqual(again, restored);
  });

  it('pauses a restored rating screen without marking already-recorded task time uncertain', () => {
    const value = round();
    value.trials[0] = advanceToRating(advanceToAnswer(startTrial(value.trials[0], NOW), NOW + 1_000), NOW + 3_000);
    const recovered = restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW + 50_000).rounds[0].trials[0];
    assert.equal(recovered.phase, 'rating');
    assert.equal(recovered.paused, true);
    assert.equal(recovered.timingUncertain, false);
    assert.deepEqual(elapsed(recovered, NOW + 100_000), { readingMs: 1_000, answeringMs: 2_000, totalMs: 3_000 });
  });

  it('rejects malformed JSON, schema, round, unknown-task and trial shapes', () => {
    assert.throws(() => restoreStore('{', NOW));
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 2, rounds: [] }), NOW));
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: {} }), NOW));
    const invalid: ((value: Round) => void)[] = [
      value => { value.trials.pop(); },
      value => { value.index = 8; },
      value => { value.index = -1; },
      value => { value.index = 1.5; },
      value => { (value as unknown as { set: string }).set = 'practice'; },
      value => { value.trials[0].taskId = 'unknown'; },
      value => { (value.trials[0] as unknown as { condition: string }).condition = 'C'; },
      value => { (value.trials[0] as unknown as { phase: string }).phase = 'invalid'; },
      value => { value.trials[0].answers.pop(); },
      value => { (value.trials[0] as unknown as { interruptions: null }).interruptions = null; },
    ];
    for (const corrupt of invalid) {
      const value = clone(round());
      corrupt(value);
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW));
    }
  });

  it('rejects invalid numbers, answers, ratings, flags, timestamps and interruption records', () => {
    const cases: Partial<Trial>[] = [
      { readingMs: -1 }, { answeringMs: -1 }, { readingMs: Number.NaN },
      { answeringMs: Number.POSITIVE_INFINITY }, { startedAt: -1 },
      { answers: [-1, null, null, null] }, { answers: [4, null, null, null] },
      { answers: [0.5, null, null, null] },
      { effort: 0 }, { preference: 8 }, { effort: 1.5 },
      { openedAt: 'not-a-date' }, { finishedAt: 'not-a-date' },
      { interruptions: [{ at: 'invalid', reason: 'manual' }] },
      { interruptions: [{ at: new Date(NOW).toISOString(), reason: 'manual', resumedAt: 'invalid' }] },
    ];
    for (const invalid of cases) {
      const value = round();
      value.trials[0] = { ...startTrial(value.trials[0], NOW), ...invalid };
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW + 1_000), JSON.stringify(invalid));
    }
    for (const [field, invalid] of [['paused', 'yes'], ['skipped', 1], ['timingUncertain', null], ['preference', '3'], ['readingMs', '100']] as const) {
      const value = round();
      Object.assign(value.trials[0], { [field]: invalid });
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW));
    }
  });

  it('rejects inconsistent measured state and fabricated completion', () => {
    const cases: Partial<Trial>[] = [
      { phase: 'answering' }, { startedAt: NOW }, { readingMs: 1 },
      { paused: true }, { answers: [0, null, null, null] },
      { phase: 'done', finishedAt: new Date(NOW).toISOString() },
      { finishedAt: new Date(NOW).toISOString() },
      { openedAt: new Date(NOW).toISOString(), startedAt: null },
    ];
    for (const invalid of cases) {
      const value = round();
      Object.assign(value.trials[0], invalid);
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value] }), NOW), JSON.stringify(invalid));
    }
    for (const invalid of [
      { status: 'complete', completedAt: new Date(NOW).toISOString() },
      { status: 'complete', completedAt: null },
      { status: 'active', completedAt: new Date(NOW).toISOString() },
    ]) {
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [{ ...round(), ...invalid }] }), NOW));
    }
  });

  it('rejects task reuse, changed condition assignment and an obsolete task version', () => {
    const value = round();
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [value, value] }), NOW));
    const duplicateTask = clone(value);
    duplicateTask.trials[1].taskId = duplicateTask.trials[0].taskId;
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [duplicateTask] }), NOW));
    const wrongSet = clone(value);
    wrongSet.trials[0].taskId = 'retest-1';
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [wrongSet] }), NOW));
    const wrongCondition = clone(value);
    wrongCondition.trials[0].condition = wrongCondition.trials[0].condition === 'A' ? 'B' : 'A';
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [wrongCondition] }), NOW));
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [{ ...value, taskVersion: 'obsolete' }] }), NOW));
  });

  it('restores a legitimate midpoint break and separate completed initial/retest records', () => {
    const midpoint = round();
    midpoint.index = 4;
    midpoint.trials = midpoint.trials.map((trial, i) => i < 4 ? completed(trial) : trial);
    assert.deepEqual(restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [midpoint] }), NOW), { schemaVersion: 1, rounds: [midpoint] });
    const initial = completedRound();
    const retest = makeRound('retest', 99, NOW + 86_400_000, 'some', initial.trials.map(t => t.taskId));
    retest.trials[0] = startTrial(retest.trials[0], NOW + 86_400_000);
    const restored = restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [initial, retest] }), NOW + 172_800_000);
    assert.deepEqual(restored.rounds[0], initial);
    assert.equal(restored.rounds[1].trials[0].paused, true);
    assert.equal(restored.rounds[1].trials[0].timingUncertain, true);
  });

  it('rejects a completed active trial, unfinished earlier trial, or already-started future trial', () => {
    const activeDone = round();
    activeDone.trials[0] = completed(activeDone.trials[0]);
    const earlierUnfinished = round();
    earlierUnfinished.index = 1;
    earlierUnfinished.trials[1] = startTrial(earlierUnfinished.trials[1], NOW);
    const futureStarted = round();
    futureStarted.trials[1] = startTrial(futureStarted.trials[1], NOW);
    const stoppedDone = { ...activeDone, status: 'stopped' as const };
    for (const invalid of [activeDone, earlierUnfinished, futureStarted, stoppedDone]) {
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [invalid] }), NOW));
    }
    const valid = round();
    valid.index = 1;
    valid.trials[0] = completed(valid.trials[0]);
    valid.trials[1] = startTrial(valid.trials[1], NOW);
    const restored = restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [valid] }), NOW + 1_000);
    assert.equal(restored.rounds[0].index, 1);
    assert.equal(restored.rounds[0].trials[1].paused, true);
  });

  it('rejects same-condition matched pairs even when the overall A/B sequence is intact', () => {
    const invalid = round();
    const pairId = getTask(invalid.trials[0].taskId).pairId;
    const mate = invalid.trials.findIndex((trial, i) => i > 0 && getTask(trial.taskId).pairId === pairId);
    const swap = invalid.trials.findIndex(trial => getTask(trial.taskId).pairId !== pairId && trial.condition === invalid.trials[0].condition);
    [invalid.trials[mate].taskId, invalid.trials[swap].taskId] = [invalid.trials[swap].taskId, invalid.trials[mate].taskId];
    assert.equal(invalid.trials.map(trial => trial.condition).join(''), invalid.sequence);
    assert.equal(new Set(invalid.trials.map(trial => trial.taskId)).size, 8);
    assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds: [invalid] }), NOW), /割り当て/);
  });

  it('requires a completed initial record before the retest record', () => {
    const retest = makeRound('retest', 99, NOW + 86_400_000);
    for (const rounds of [[retest], [retest, completedRound()], [round(), retest]]) {
      assert.throws(() => restoreStore(JSON.stringify({ schemaVersion: 1, rounds }), NOW), /初回の完了記録/);
    }
    const rounds = [completedRound(), retest];
    assert.deepEqual(restoreStore(JSON.stringify({ schemaVersion: 1, rounds }), NOW), { schemaVersion: 1, rounds });
  });
});

describe('portable, scored JSON export', () => {
  it('exports schema/version, methods, raw trials, task definitions, scores, summaries and warnings', () => {
    const value = completedRound();
    value.trials[0].answers[0] = null;
    const store: Store = { schemaVersion: 1, rounds: [value] };
    const exported = JSON.parse(exportData(store));
    assert.equal(exported.schemaVersion, SCHEMA_VERSION);
    assert.equal(exported.taskVersion, TASK_VERSION);
    assert.ok(Number.isFinite(Date.parse(exported.exportedAt)));
    assert.match(exported.purpose, /検査・診断ではありません/);
    assert.match(exported.comparison, /同一文/);
    assert.match(exported.timing, /評定時間は含めない/);
    assert.match(exported.missingPolicy, /nullは未回答/);
    assert.deepEqual(exported.tasks, TASKS);
    assert.deepEqual(exported.rounds[0].trials, value.trials);
    assert.equal(exported.rounds[0].scores.length, 8);
    value.trials.forEach((trial, index) => {
      assert.deepEqual(exported.rounds[0].scores[index], { taskId: trial.taskId, ...scoreTrial(trial) });
    });
    assert.deepEqual(exported.rounds[0].summaries, ['A', 'B'].map(c => conditionSummary(value, c as Condition)));
    assert.deepEqual(exported.rounds[0].warnings, roundWarnings(value));
    assert.equal(exported.rounds[0].trials[0].answers[0], null);
  });

  it('supports no-result and interrupted exports without mutating the source store', () => {
    assert.deepEqual(JSON.parse(exportData(emptyStore())).rounds, []);
    const value = round();
    value.trials[0] = pauseTrial(startTrial(value.trials[0], NOW), NOW + 1_000, 'manual');
    const store: Store = { schemaVersion: 1, rounds: [value] };
    const before = clone(store);
    const exported = JSON.parse(exportData(store));
    assert.deepEqual(store, before);
    assert.equal(exported.rounds[0].status, 'active');
    assert.equal(exported.rounds[0].scores[0].application.answered, 0);
    assert.equal(exported.rounds[0].summaries[0].totalMs, null);
  });
});
