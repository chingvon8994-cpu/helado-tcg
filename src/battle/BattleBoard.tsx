import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ELEMENT_META } from '../cards/elements';
import { getCard, getCreature } from '../cards/registry';
import { attackText } from '../cards/text';
import type { CardDef } from '../cards/types';
import { canPay, determinize, finalDamage, maxHp, retreatCost, type Action, type GameEvent, type GameState, type InPlayCreature, type PlayerIndex, type PlayerView } from '../engine';
import { CardBack, CardView, ElementIcon } from '../ui/Card';
import { Avatar, Confirm, Modal } from '../ui/kit';
import type { BattleController } from './controllers';
import { CreatureToken, EmptySlot, STATUS_STYLE, type Fx } from './Creature';

type Sel =
  | null
  | { kind: 'hand'; uid: string }
  | { kind: 'essence' }
  | { kind: 'creature'; uid: string }
  | { kind: 'attack'; index: number }
  | { kind: 'retreat' }
  | { kind: 'ability'; uid: string };

function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(get);
  useEffect(() => {
    const f = () => setV(get());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return v;
}

const name = (id: string) => (id === '__hidden__' ? 'a card' : getCard(id).name);

function describe(e: GameEvent, me: PlayerIndex, opp: string): string | null {
  const who = e.player === me ? 'You' : opp;
  switch (e.t) {
    case 'turnStart': return e.player === me ? `Turn ${e.amount} — your turn` : `Turn ${e.amount} — ${opp}’s turn`;
    case 'attack': return `${who === 'You' ? 'Your' : `${opp}’s`} ${name(e.cardId!)} used ${e.text}!`;
    case 'damage': return `${e.amount} damage${e.weakness ? ' (weakness!)' : ''}`;
    case 'heal': return `Healed ${e.amount}`;
    case 'ko': return e.text ?? 'Knocked out!';
    case 'points': return `${e.player === me ? 'You take' : `${opp} takes`} ${e.amount} point${e.amount === 1 ? '' : 's'}`;
    case 'trainer': return `${who} played ${name(e.cardId!)}`;
    case 'evolve': return e.text ?? 'Evolved!';
    case 'playBasic': return `${who} benched ${name(e.cardId!)}`;
    case 'status': return `${STATUS_STYLE[e.status!].label}!`;
    case 'statusClear': return e.status ? `No longer ${STATUS_STYLE[e.status].label.toLowerCase()}` : 'Status cleared';
    case 'coin': return `Coin: ${e.coins!.map((c) => (c ? 'Heads' : 'Tails')).join(', ')}`;
    case 'retreat': return `${who} retreated`;
    case 'promote': return `${who} sent out ${name(e.cardId!)}`;
    case 'attach': return e.player === me ? null : `${opp} attached Essence`;
    case 'search': return `${who} found: ${e.text}`;
    case 'ability': return `${who} used ${e.text}`;
    case 'info': return e.text ?? null;
    case 'gameOver': return 'Match over!';
    default: return null;
  }
}

export function BattleBoard({ ctl, onExit, extraOver, myAvatar = 'axolitl' }: { ctl: BattleController; onExit: () => void; extraOver?: ReactNode; myAvatar?: string }) {
  const v = ctl.view!;
  const me = v.me;
  const { w: width, h: height } = useViewport();
  // Size the field from both dimensions so it fills phones and large desktop screens alike.
  // Vertical budget: two fields of (active + bench) tokens (~1.06× width tall) plus bars, hand peek and midline.
  const fieldBudget = (height - 330) / (2 * 1.06 * 1.74);
  const activeSize = Math.round(Math.max(92, Math.min(width * 0.3, fieldBudget, 200)));
  const benchSize = Math.round(Math.max(64, Math.min(width * 0.22, activeSize * 0.74)));
  const [sel, setSel] = useState<Sel>(null);
  const [inspect, setInspect] = useState<CardDef | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [fx, setFx] = useState<Record<string, Fx>>({});
  const [coins, setCoins] = useState<boolean[] | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number; big?: boolean } | null>(null);
  const [ticker, setTicker] = useState<string[]>([]);
  const [oppCard, setOppCard] = useState<string | null>(null);
  const det: GameState = useMemo(() => determinize(v, 1), [v]);

  // ── Event playback ──────────────────────────────────────────────────────────
  const queue = useRef<GameEvent[]>([]);
  const running = useRef(false);
  useEffect(() => {
    if (!ctl.events.list.length) return;
    queue.current.push(...ctl.events.list);
    if (running.current) return;
    running.current = true;
    let k = Date.now();
    const step = () => {
      const e = queue.current.shift();
      if (!e) { running.current = false; return; }
      let delay = 120;
      const line = describe(e, me, ctl.meta.opponentName);
      if (line) setTicker((t) => [...t.slice(-30), line]);
      if (e.t === 'attack' && e.uid) { setFx((f) => ({ ...f, [e.uid!]: { lunge: e.player === me ? 'up' : 'down', key: k++ } })); setBanner({ text: `${name(e.cardId!)} · ${e.text}`, key: k++ }); delay = 520; }
      else if (e.t === 'damage' && e.uid) { setFx((f) => ({ ...f, [e.uid!]: { damage: e.amount, key: k++ } })); delay = 650; }
      else if (e.t === 'heal' && e.uid) { setFx((f) => ({ ...f, [e.uid!]: { heal: e.amount, key: k++ } })); delay = 420; }
      else if (e.t === 'coin') { setCoins(e.coins!); delay = 1100; setTimeout(() => setCoins(null), 1050); }
      else if (e.t === 'turnStart') { setBanner({ text: e.player === me ? 'Your turn!' : `${ctl.meta.opponentName}’s turn`, key: k++, big: true }); delay = 700; }
      else if (e.t === 'ko') { setBanner({ text: e.text ?? 'Knocked out!', key: k++ }); delay = 700; }
      else if (e.t === 'trainer' && e.player !== me) { setOppCard(e.cardId!); delay = 1100; setTimeout(() => setOppCard(null), 1050); }
      else if (e.t === 'evolve' || e.t === 'status') { setBanner({ text: describe(e, me, ctl.meta.opponentName) ?? '', key: k++ }); delay = 450; }
      setTimeout(step, delay);
    };
    step();
  }, [ctl.events, me, ctl.meta.opponentName]);
  useEffect(() => { if (banner) { const t = setTimeout(() => setBanner(null), 1300); return () => clearTimeout(t); } }, [banner]);

  // ── Derived interaction targets ─────────────────────────────────────────────
  const legal = ctl.legal;
  const myTurn = v.phase === 'main' && !v.pending.length && v.current === me;
  const pendingMine = v.pending.length > 0 && v.pending[0].player === me;
  const setup = v.phase === 'setup';
  useEffect(() => setSel(null), [v.version]);

  const targets = useMemo(() => {
    const t = new Map<string, Action>(); // uid | 'bench' | 'active' → action
    if (!sel) return t;
    if (sel.kind === 'hand') {
      for (const a of legal) {
        if ('handUid' in a && a.handUid === sel.uid) {
          if (a.type === 'playBasic' || a.type === 'setupBench') t.set('bench', a);
          else if (a.type === 'setupActive') t.set('active', a);
          else if ((a.type === 'evolve' || a.type === 'playTrainer') && a.targetUid) t.set(a.targetUid, a);
        }
      }
    } else if (sel.kind === 'essence') {
      for (const a of legal) if (a.type === 'attachEssence') t.set(a.targetUid, a);
    } else if (sel.kind === 'attack') {
      for (const a of legal) if (a.type === 'attack' && a.index === sel.index && a.targetUid) t.set(a.targetUid, a);
    } else if (sel.kind === 'retreat') {
      for (const a of legal) if (a.type === 'retreat') t.set(a.benchUid, a);
    } else if (sel.kind === 'ability') {
      for (const a of legal) if (a.type === 'useAbility' && a.creatureUid === sel.uid && a.targetUid) t.set(a.targetUid, a);
    }
    return t;
  }, [sel, legal]);

  const send = async (a: Action) => {
    setSel(null);
    await ctl.send(a);
  };
  const clickTarget = (key: string) => {
    const a = targets.get(key);
    if (a) { send(a); return true; }
    return false;
  };

  const handNoTargetPlay = sel?.kind === 'hand' ? legal.find((a) => a.type === 'playTrainer' && a.handUid === sel.uid && !a.targetUid) : undefined;
  const opp = v.opponent;
  const you = v.you;

  const clickOwnCreature = (c: InPlayCreature) => {
    if (clickTarget(c.uid)) return;
    if (pendingMine) { const a = legal.find((x) => x.type === 'promote' && x.benchUid === c.uid); if (a) send(a); return; }
    if (!myTurn) { setInspect(getCard(c.cardId)); return; }
    setSel(sel?.kind === 'creature' && sel.uid === c.uid ? null : { kind: 'creature', uid: c.uid });
  };
  const clickOppCreature = (c: InPlayCreature) => {
    if (clickTarget(c.uid)) return;
    setInspect(getCard(c.cardId));
  };

  // ── Panels ──────────────────────────────────────────────────────────────────
  const selCreature = sel?.kind === 'creature' ? [you.active, ...you.bench].find((c) => c?.uid === sel.uid) ?? null : null;
  const isActiveSel = !!selCreature && selCreature.uid === you.active?.uid;

  const instruction = (() => {
    if (setup) {
      if (you.setupDone) return 'Waiting for your opponent to get ready…';
      if (!you.active) return 'Choose a Basic creature from your hand to be your Active creature.';
      return 'Add Basic creatures to your Bench (optional), then press Ready.';
    }
    if (pendingMine) return 'Choose a Benched creature to become your new Active creature.';
    if (v.pending.length) return `Waiting for ${ctl.meta.opponentName} to choose a new Active creature…`;
    if (sel?.kind === 'hand' && !targets.size && !handNoTargetPlay) return 'That card can’t be played right now.';
    if (sel?.kind === 'hand' && targets.size) return 'Tap a glowing spot to play this card.';
    if (sel?.kind === 'essence') return 'Tap one of your creatures to attach Essence.';
    if (sel?.kind === 'attack' || sel?.kind === 'ability') return 'Choose a target.';
    if (sel?.kind === 'retreat') return 'Choose a Benched creature to switch in.';
    if (myTurn) return null;
    return `${ctl.meta.opponentName} is thinking…`;
  })();

  const deadline = ctl.meta.deadline ? new Date(ctl.meta.deadline).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!deadline) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [deadline]);
  const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
  const waitingOnOpp = !myTurn && !pendingMine && !(setup && !you.setupDone);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,#4a2a1c,#1d100b_70%)]">
      {/* Opponent bar */}
      <PlayerBar
        name={ctl.meta.opponentName} avatar={ctl.meta.opponentAvatar ?? 'kappish'} subtitle={ctl.meta.opponentTitle ?? (ctl.meta.difficulty ? `AI · ${ctl.meta.difficulty}` : 'Opponent')}
        side={opp} pointsToWin={v.rules.pointsToWin} isTurn={v.current !== me && v.phase === 'main'} top
        right={<button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setConfirmForfeit(true)} disabled={v.phase === 'over'}>⚑</button>}
      />
      <div className="flex justify-center gap-1 py-1">{Array.from({ length: Math.min(opp.handCount, 10) }, (_, i) => <CardBack key={i} width={22} />)}</div>

      <LayoutGroup>
        {/* Opponent field */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <Row>
            {[0, 1, 2].map((i) => {
              const c = opp.bench[i];
              return c ? <CreatureToken key={c.uid} c={c} hp={hpFor(det, (1 - me) as PlayerIndex, c)} size={benchSize} fx={fx[c.uid]} targetable={targets.has(c.uid)} onClick={() => clickOppCreature(c)} /> : <EmptySlot key={i} size={benchSize} />;
            })}
          </Row>
          <div className="flex items-center gap-4">
            {opp.active ? <CreatureToken c={opp.active} hp={hpFor(det, (1 - me) as PlayerIndex, opp.active)} size={activeSize} active fx={fx[opp.active.uid]} targetable={targets.has(opp.active.uid)} onClick={() => clickOppCreature(opp.active!)} /> : <EmptySlot size={activeSize} label={setup ? 'Opponent is choosing…' : ''} />}
          </div>
        </div>

        {/* Midline */}
        <div className="relative flex items-center justify-center gap-3 px-3 py-1">
          {v.terrain && (
            <button onClick={() => setInspect(getCard(v.terrain!.card.cardId))} className="chip bg-[#2fa57a]/80 text-white">⛰ {getCard(v.terrain.card.cardId).name}</button>
          )}
          {v.buffs.filter((b) => b.turn === v.turn).map((b, i) => <span key={i} className="chip bg-berry-500/70">{b.kind === 'damageBoost' ? `+${b.amount} dmg` : `-${b.amount} retreat`}</span>)}
          {secondsLeft !== null && v.phase !== 'over' && <span className={`chip ${secondsLeft < 15 ? 'bg-red-500/80' : 'bg-black/40'}`}>⏱ {secondsLeft}s</span>}
          {ctl.claimTimeout && waitingOnOpp && secondsLeft === 0 && v.phase !== 'over' && <button className="btn-ghost !py-1 text-xs" onClick={ctl.claimTimeout}>Opponent idle — force turn</button>}
        </div>

        {/* My field */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-4">
            {you.active
              ? <CreatureToken c={you.active} hp={hpFor(det, me, you.active)} size={activeSize} active fx={fx[you.active.uid]} selected={sel?.kind === 'creature' && sel.uid === you.active.uid} targetable={targets.has(you.active.uid)} onClick={() => clickOwnCreature(you.active!)} />
              : <EmptySlot size={activeSize} targetable={targets.has('active')} onClick={() => clickTarget('active')} label={setup ? 'Active' : ''} />}
          </div>
          <Row>
            {[0, 1, 2].map((i) => {
              const c = you.bench[i];
              const promotable = pendingMine && !!c;
              return c
                ? <CreatureToken key={c.uid} c={c} hp={hpFor(det, me, c)} size={benchSize} fx={fx[c.uid]} selected={sel?.kind === 'creature' && sel.uid === c.uid} targetable={targets.has(c.uid) || promotable} onClick={() => clickOwnCreature(c)} />
                : <EmptySlot key={i} size={benchSize} targetable={targets.has('bench') && i === you.bench.length} onClick={() => clickTarget('bench')} label={targets.has('bench') && i === you.bench.length ? 'Bench' : ''} />;
            })}
          </Row>
        </div>
      </LayoutGroup>

      {/* My bar */}
      <PlayerBar
        name="You" avatar={myAvatar} subtitle={setup ? 'Setup' : myTurn ? 'Your turn' : 'Waiting'} side={you} pointsToWin={v.rules.pointsToWin} isTurn={myTurn}
        essence={
          <EssenceZone
            current={you.essenceCurrent} next={you.essenceNext} attached={you.attachedThisTurn}
            active={sel?.kind === 'essence'} usable={legal.some((a) => a.type === 'attachEssence')}
            onClick={() => setSel(sel?.kind === 'essence' ? null : { kind: 'essence' })}
          />
        }
        right={
          setup
            ? <button className="btn-mint !py-2" disabled={!legal.some((a) => a.type === 'setupDone') || ctl.busy} onClick={() => send({ type: 'setupDone' })}>Ready</button>
            : <button className="btn-primary !py-2" disabled={!myTurn || ctl.busy} onClick={() => send({ type: 'endTurn' })}>End turn</button>
        }
      />

      {/* Instruction / ticker */}
      <div className="pointer-events-none absolute inset-x-0 top-[46%] z-20 flex justify-center px-4">
        <AnimatePresence>
          {instruction && (
            <motion.div key={instruction} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-black/60 px-4 py-1.5 text-center text-xs font-bold text-white/90 backdrop-blur">
              {instruction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button onClick={() => setShowLog(true)} className="absolute left-2 top-[40%] z-20 max-w-[34%] truncate rounded-xl bg-black/50 px-2 py-1 text-left text-[11px] text-white/80 backdrop-blur md:max-w-[22%]">
        📜 {ticker.at(-1) ?? 'Battle log'}
      </button>

      {/* Hand */}
      <Hand
        hand={you.hand ?? []} legal={legal} selected={sel?.kind === 'hand' ? sel.uid : null}
        onSelect={(uid) => setSel(sel?.kind === 'hand' && sel.uid === uid ? null : { kind: 'hand', uid })}
        cardWidth={Math.round(Math.min(130, Math.max(84, width * 0.2, height * 0.13)))}
        viewportWidth={width}
      />

      {/* Selected hand card preview */}
      <AnimatePresence>
        {sel?.kind === 'hand' && (you.hand ?? []).some((h) => h.uid === sel.uid) && (
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="absolute right-2 top-[18%] z-30 flex flex-col items-center gap-2">
            <CardView card={getCard(you.hand!.find((h) => h.uid === sel.uid)!.cardId)} width={Math.min(200, width * 0.42)} />
            <div className="flex gap-2">
              {handNoTargetPlay && <button className="btn-mint !py-2" onClick={() => send(handNoTargetPlay)}>Play</button>}
              <button className="btn-ghost !py-2" onClick={() => setSel(null)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Creature action sheet */}
      <AnimatePresence>
        {selCreature && (
          <CreatureSheet
            c={selCreature} isActive={isActiveSel} legal={legal} state={det} me={me}
            onAttack={(index) => {
              const opts = legal.filter((a) => a.type === 'attack' && a.index === index);
              if (opts.length === 1) send(opts[0]); else setSel({ kind: 'attack', index });
            }}
            onAbility={() => {
              const opts = legal.filter((a) => a.type === 'useAbility' && a.creatureUid === selCreature.uid);
              if (opts.length === 1 && !(opts[0] as { targetUid?: string }).targetUid) send(opts[0]); else setSel({ kind: 'ability', uid: selCreature.uid });
            }}
            onRetreat={() => setSel({ kind: 'retreat' })}
            onInspect={() => setInspect(getCard(selCreature.cardId))}
            onClose={() => setSel(null)}
          />
        )}
      </AnimatePresence>

      {/* FX overlays */}
      <AnimatePresence>
        {banner && (
          <motion.div key={banner.key} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="pointer-events-none absolute inset-x-0 top-[34%] z-40 flex justify-center">
            <span className={`drip rounded-2xl px-6 py-2 font-display font-extrabold shadow-card ${banner.big ? 'bg-berry-400 text-3xl text-[#2a1710]' : 'bg-cone-100 text-xl text-cone-800'}`}>{banner.text}</span>
          </motion.div>
        )}
        {coins && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center gap-3 bg-black/30">
            {coins.map((h, i) => (
              <motion.div key={i} initial={{ rotateY: 0, y: 0 }} animate={{ rotateY: 720 + (h ? 0 : 180), y: [0, -60, 0] }} transition={{ duration: 0.8, delay: i * 0.08 }} className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-sm font-extrabold shadow-card ring-4 ${h ? 'bg-[#ffd36f] text-[#5a3f0b] ring-[#c99a2e]' : 'bg-[#cfc6b8] text-[#3b2216] ring-[#8f887a]'}`} style={{ transformStyle: 'preserve-3d' }}>
                {h ? 'HEADS' : 'TAILS'}
              </motion.div>
            ))}
          </motion.div>
        )}
        {oppCard && (
          <motion.div initial={{ opacity: 0, y: -30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="pointer-events-none absolute left-1/2 top-[12%] z-40 -translate-x-1/2">
            <CardView card={getCard(oppCard)} width={170} />
          </motion.div>
        )}
      </AnimatePresence>

      {ctl.error && <div className="absolute inset-x-0 top-16 z-50 mx-auto w-fit rounded-xl bg-red-500/90 px-3 py-1.5 text-sm font-bold">{ctl.error}</div>}

      {/* Game over */}
      <Modal open={v.phase === 'over'}>
        <div className="text-center">
          <p className="font-display text-5xl font-extrabold">{v.winner === 'draw' ? 'Draw!' : v.winner === me ? 'Victory!' : 'Defeat'}</p>
          <p className="mt-1 text-white/70">{reasonText(v, me)}</p>
          <p className="mt-3 font-display text-2xl">{you.points} – {opp.points}</p>
          {extraOver}
          <button className="btn-primary mt-5 w-full" onClick={onExit}>Continue</button>
        </div>
      </Modal>

      <Modal open={!!inspect} onClose={() => setInspect(null)} bare>
        {inspect && <div onClick={() => setInspect(null)}><CardView card={inspect} width={Math.min(340, width - 40)} tilt /></div>}
      </Modal>
      <Modal open={showLog} onClose={() => setShowLog(false)}>
        <h3 className="font-display text-xl font-bold">Battle log</h3>
        <ol className="mt-3 max-h-[60vh] space-y-1 overflow-auto text-sm text-white/80">{ticker.slice().reverse().map((t, i) => <li key={i}>• {t}</li>)}</ol>
      </Modal>
      <Confirm open={confirmForfeit} title="Forfeit this match?" body={ctl.meta.mode === 'practice' ? 'This counts as a loss.' : 'Forfeiting counts as a loss and earns no rewards.'} confirmLabel="Forfeit" danger onCancel={() => setConfirmForfeit(false)} onConfirm={() => { setConfirmForfeit(false); ctl.forfeit(); }} />
    </div>
  );
}

function hpFor(s: GameState, owner: PlayerIndex, c: InPlayCreature) {
  const ps = s.players[owner];
  const located = ps.active?.uid === c.uid ? ps.active : ps.bench.find((b) => b.uid === c.uid) ?? c;
  return maxHp(s, owner, located); // includes tools, terrain and abilities
}

function reasonText(v: PlayerView, me: PlayerIndex) {
  const won = v.winner === me;
  switch (v.winReason) {
    case 'points': return won ? 'You scored enough points!' : 'Your opponent scored enough points.';
    case 'noCreatures': return won ? 'Your opponent has no creatures left.' : 'You ran out of creatures.';
    case 'concede': return won ? 'Your opponent forfeited.' : 'You forfeited.';
    case 'timeout': return won ? 'Your opponent ran out of time.' : 'You ran out of time.';
    case 'turnLimit': return 'Turn limit reached.';
    default: return '';
  }
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-end justify-center gap-2 sm:gap-3">{children}</div>;
}

function PlayerBar({ name, avatar, subtitle, side, pointsToWin, isTurn, right, essence, top }: { name: string; avatar: string; subtitle: string; side: PlayerView['you']; pointsToWin: number; isTurn: boolean; right?: ReactNode; essence?: ReactNode; top?: boolean }) {
  return (
    <div className={`z-10 flex items-center gap-2 px-3 py-2 ${top ? 'bg-gradient-to-b' : 'bg-gradient-to-t'} from-black/50 to-transparent`}>
      <div className={`rounded-2xl ${isTurn ? 'ring-2 ring-berry-400' : ''}`}><Avatar name={avatar} size={38} /></div>
      <div className="min-w-0">
        <p className="truncate font-display text-base font-extrabold leading-tight">{name}</p>
        <p className="truncate text-[11px] text-white/60">{subtitle}</p>
      </div>
      <div className="ml-1 flex gap-1" title="Points">
        {Array.from({ length: pointsToWin }, (_, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ring-2 ring-white/30 ${i < side.points ? 'bg-[#ffd36f] shadow-[0_0_8px_#ffd36f]' : 'bg-black/30'}`} />)}
      </div>
      <div className="ml-2 hidden gap-2 text-[11px] font-bold text-white/70 sm:flex">
        <span title="Deck">🂠 {side.deckCount}</span><span title="Discard">🗑 {side.discard.length}</span>
      </div>
      {essence && <div className="ml-auto">{essence}</div>}
      <div className={essence ? '' : 'ml-auto'}>{right}</div>
    </div>
  );
}

function EssenceZone({ current, next, attached, active, usable, onClick }: { current: string | null; next: string; attached: boolean; active: boolean; usable: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-black/30 px-2 py-1">
      <button disabled={!usable} onClick={onClick} className={`relative rounded-full ${usable ? 'target-pulse' : 'opacity-50'} ${active ? 'scale-110' : ''}`} title={current ? `${ELEMENT_META[current as keyof typeof ELEMENT_META].label} Essence — tap, then tap a creature` : attached ? 'Already attached this turn' : 'No Essence this turn'}>
        {current ? <ElementIcon el={current as never} size={34} /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-dashed border-white/30 text-[10px] text-white/40">{attached ? '✓' : '—'}</span>}
      </button>
      <div className="flex flex-col items-center text-[9px] font-bold text-white/50">next<ElementIcon el={next as never} size={18} /></div>
    </div>
  );
}

function Hand({ hand, legal, selected, onSelect, cardWidth, viewportWidth }: { hand: { uid: string; cardId: string }[]; legal: Action[]; selected: string | null; onSelect: (uid: string) => void; cardWidth: number; viewportWidth: number }) {
  const playable = new Set(legal.flatMap((a) => ('handUid' in a ? [a.handUid] : [])));
  const cardH = cardWidth * (88 / 63);
  const peek = cardH * 0.52;
  // Overlap cards just enough that the whole hand always fits on screen (no scrolling/clipping).
  const avail = viewportWidth - 24;
  const step = hand.length > 1 ? Math.min(cardWidth * 0.78, (avail - cardWidth) / (hand.length - 1)) : cardWidth;
  return (
    <div className="relative z-20 flex shrink-0 justify-center" style={{ height: peek }}>
      <AnimatePresence initial={false}>
        {hand.map((h, i) => {
          const isSel = selected === h.uid;
          const tilt = (i - (hand.length - 1) / 2) * 2.5;
          return (
            <motion.div
              key={h.uid}
              layout
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: isSel ? -cardH * 0.42 : Math.abs(i - (hand.length - 1) / 2) * 3, opacity: 1, rotate: isSel ? 0 : tilt }}
              exit={{ y: -120, opacity: 0, scale: 0.8 }}
              whileHover={{ y: -cardH * 0.25 }}
              className="shrink-0 cursor-pointer"
              style={{ marginLeft: i === 0 ? 0 : step - cardWidth, zIndex: isSel ? 50 : i, height: cardH }}
              onClick={() => onSelect(h.uid)}
            >
              <CardView card={getCard(h.cardId)} width={cardWidth} className={playable.has(h.uid) ? 'ring-2 ring-mint-400' : 'brightness-75'} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function CreatureSheet({ c, isActive, legal, state, me, onAttack, onAbility, onRetreat, onInspect, onClose }: { c: InPlayCreature; isActive: boolean; legal: Action[]; state: GameState; me: PlayerIndex; onAttack: (i: number) => void; onAbility: () => void; onRetreat: () => void; onInspect: () => void; onClose: () => void }) {
  const def = getCreature(c.cardId);
  const opp = state.players[me === 0 ? 1 : 0].active;
  const canRetreat = isActive && legal.some((a) => a.type === 'retreat');
  const canAbility = legal.some((a) => a.type === 'useAbility' && a.creatureUid === c.uid);
  const rc = retreatCost(state, me, c);
  return (
    <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} className="absolute inset-x-2 bottom-2 z-40 mx-auto max-w-lg rounded-3xl border border-white/10 bg-[#2f1b12]/95 p-3 shadow-card backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <p className="font-display text-lg font-extrabold">{def.name}</p>
        <button className="chip" onClick={onInspect}>ⓘ Card</button>
        <button className="ml-auto btn-ghost !px-3 !py-1" onClick={onClose}>✕</button>
      </div>
      {isActive && (
        <div className="space-y-1.5">
          {def.attacks.map((a, i) => {
            const ok = legal.some((x) => x.type === 'attack' && x.index === i);
            const preview = opp && a.damage > 0 ? finalDamage(state, me, c, opp, a.damage).amount : null;
            return (
              <button key={i} disabled={!ok} onClick={() => onAttack(i)} className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition ${ok ? 'bg-berry-400 text-[#2a1710] hover:bg-berry-300' : 'bg-white/5 text-white/40'}`}>
                <span className="flex gap-0.5">{a.cost.map((e, j) => <ElementIcon key={j} el={e} size={18} />)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-extrabold leading-tight">{a.name}</span>
                  {attackText(a) && <span className="block text-[11px] leading-tight opacity-80">{attackText(a)}</span>}
                </span>
                <span className="text-right font-display text-xl font-extrabold">
                  {a.damage || a.damageSuffix ? `${a.damage}${a.damageSuffix ?? ''}` : ''}
                  {preview !== null && preview !== a.damage && <span className="block text-[10px] font-bold opacity-70">→ {preview}</span>}
                </span>
              </button>
            );
          })}
          {!canPay(c.energy, def.attacks[0]?.cost ?? []) && <p className="px-1 text-[11px] text-white/50">Attach Essence to power up attacks.</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {def.ability?.kind === 'activated' && <button className="btn-mint !py-2 text-sm" disabled={!canAbility} onClick={onAbility}>✦ {def.ability.name}</button>}
        {isActive && <button className="btn-ghost !py-2 text-sm" disabled={!canRetreat} onClick={onRetreat}>Retreat ({rc})</button>}
      </div>
    </motion.div>
  );
}
