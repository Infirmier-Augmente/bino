import { aiConfigFromEnv, createAiServices } from '@infirmier/ai';
import { formatClock, PRIORITY_LABELS } from '@infirmier/domain';
import { getScenario, initialState, SCENARIOS } from '@infirmier/simulation';
import { createApp } from '../app';
import { type DictationEval, evaluateDictation, summarize } from '../eval/evaluate';
import { HospitalStore } from '../store/store';

/**
 * CLI du simulateur.
 *   pnpm sim list                 scénarios disponibles
 *   pnpm sim run <id>             rejoue un scénario, affiche la vue service et les fiches
 *   pnpm sim eval [id…] [--json]  évalue la structuration IA (utilise la config IA du .env)
 */
const [command = 'list', ...args] = process.argv.slice(2);

function makeApp(scenarioId: string) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.error(`Scénario inconnu : ${scenarioId}. Voir « pnpm sim list ».`);
    process.exit(1);
  }
  const store = HospitalStore.inMemory(initialState(scenario));
  const ai = createAiServices(aiConfigFromEnv(process.env));
  return { ...createApp({ store, ai }), scenario, ai };
}

async function list() {
  for (const s of SCENARIOS) {
    console.log(`${s.id.padEnd(22)} ${s.events.length.toString().padStart(3)} évén.  ${s.title}`);
  }
}

async function run(id: string) {
  const { simulation, hospital, scenario } = makeApp(id);
  simulation.onStep = ({ event, transmission }) => {
    const time = formatClock(event.at, 'Europe/Paris');
    const extra = transmission
      ? ` → ${transmission.content.targets.map((t) => t.label).join(', ') || 'sans cible'} [${transmission.engine.structuring}${transmission.engine.degraded ? ', dégradé' : ''}]`
      : '';
    console.log(`  ${time.padStart(5)}  ${event.label ?? event.type}${extra}`);
  };
  console.log(`\n▶ ${scenario.title}\n`);
  await simulation.load(id, 'end');
  const board = hospital.unitBoard(scenario.unitId);
  console.log(`\n■ Vue service (${board.shift.label})\n`);
  for (const row of board.rows) {
    console.log(
      `  ${row.priority.starred ? '★' : ' '} ${PRIORITY_LABELS[row.priority.level].padEnd(6)} ${row.patient.roomLabel.padEnd(11)} ${row.patient.displayName.padEnd(16)} ${row.headline[0]?.text ?? ''}`,
    );
  }
  for (const row of board.rows) {
    const sheet = hospital.handover(row.patient.id);
    console.log(
      `\n── ${sheet.patient.roomLabel} · ${sheet.patient.displayName}, ${sheet.patient.age} ans · ${sheet.patient.dayOfStay} · ${sheet.patient.admissionReason}`,
    );
    for (const h of sheet.headline) console.log(`   À retenir  ${h.text}`);
    for (const s of sheet.sections) {
      if (s.items.length)
        console.log(
          `   ${s.title.padEnd(10).slice(0, 10)} ${s.items.map((i) => i.text).join(' ')}`,
        );
    }
    for (const l of sheet.transverse.filter((x) => x.status === 'renseigne'))
      console.log(`   ${l.label} : ${l.summary}`);
    for (const t of sheet.todos) console.log(`   À faire    ${t.text}`);
    for (const f of sheet.openFlags) console.log(`   ?          ${f.question}`);
  }
}

async function evaluate(ids: string[], json: boolean) {
  const targets = ids.length ? ids : SCENARIOS.map((s) => s.id);
  const results: DictationEval[] = [];
  let engineInfo = '';
  for (const id of targets) {
    const { simulation, scenario, ai } = makeApp(id);
    engineInfo = `${ai.config.llm.provider}${ai.config.llm.model ? `:${ai.config.llm.model}` : ''} · classifieur ${ai.classifier.id}`;
    simulation.onStep = ({ event, transmission }) => {
      if (event.type === 'dictation' && transmission)
        results.push(evaluateDictation(scenario.id, event, transmission));
    };
    await simulation.load(id, 'end');
  }
  const summary = summarize(results);
  if (json) {
    console.log(JSON.stringify({ engine: engineInfo, summary, results }, null, 2));
  } else {
    console.log(`\nÉvaluation — ${engineInfo}\n`);
    for (const r of results) {
      const failed = r.checks.filter((c) => !c.ok);
      console.log(
        `${failed.length ? '✖' : '✔'} ${r.scenarioId} ${formatClock(r.at, 'Europe/Paris').padStart(5)} ${r.label} (${r.durationMs} ms${r.degraded ? ', dégradé' : ''}${r.rejected ? `, ${r.rejected} rejet(s)` : ''})`,
      );
      for (const c of failed) console.log(`     ✖ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
    const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)} %`);
    console.log(`
  Dictées                 ${summary.dictations}
  Vérifications réussies  ${summary.passed}/${summary.checks}
  Bon patient             ${pct(summary.patientAccuracy)}
  Inventions détectées    ${summary.inventions}
  Éléments rejetés        ${summary.rejectedStatements} (écartés par l’ancrage des sources)
  Mode dégradé            ${summary.degraded}
  Temps moyen             ${summary.avgDurationMs} ms
`);
  }
  if (summary.inventions > 0) process.exitCode = 1;
}

switch (command) {
  case 'list':
    await list();
    break;
  case 'run':
    if (!args[0]) {
      console.error('Usage : pnpm sim run <scénario>');
      process.exit(1);
    }
    await run(args[0]);
    break;
  case 'eval':
    await evaluate(
      args.filter((a) => !a.startsWith('--')),
      args.includes('--json'),
    );
    break;
  default:
    console.error(
      `Commande inconnue : ${command}. Commandes : list, run <id>, eval [id…] [--json]`,
    );
    process.exit(1);
}
