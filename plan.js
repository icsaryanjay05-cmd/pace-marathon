/* Starter schedule transcribed from the user's updated Oct 12–Nov 28, 2026 plan.
   All sessions can be changed in the Training Plan screen. */
const TRAINING_WEEKS = [
  {name:'Recovery & re-entry',dates:'Oct 12–18',focus:'Prioritize recovery after the Oct 9 long run. Monday quality is optional.'},
  {name:'Controlled specificity',dates:'Oct 19–25',focus:'Build controlled threshold volume and return to a longer endurance run.'},
  {name:'Key endurance',dates:'Oct 26–Nov 1',focus:'Key 28–30 km endurance run with controlled marathon-specific work.'},
  {name:'Last major long run',dates:'Nov 2–8',focus:'Last big marathon preparation long run. Protect sleep and recovery.'},
  {name:'10K race week',dates:'Nov 9–15',focus:'Reduce load and sharpen for the November 14 tune-up race.'},
  {name:'Marathon taper',dates:'Nov 16–22',focus:'Freshen up; do not chase missed training volume.'},
  {name:'Race week',dates:'Nov 23–28',focus:'Rest, gentle activation and familiar fueling. Marathon on November 28.'}
];
const TRAINING_ROWS = `
2026-10-12|Optional light threshold|Threshold|10|4:22–4:25/km|2–3 km warm-up, 2 × 2 km threshold (2-min jog), 2 km cool-down. If not fully recovered: 6–8 km easy or rest.
2026-10-13|Strength + optional recovery|Strength|0||20–30 min light maintenance; optional 4–6 km recovery. No heavy squats or failure sets.
2026-10-14|Easy run|Easy|9|5:50–6:30/km|8–10 km conversational, no fast finish.
2026-10-15|Rest / optional easy|Recovery|0||Rest preferred, optional 5–6 km easy only if fresh.
2026-10-16|Reduced long run|Long run|17|Easy effort|16–18 km easy; no marathon-pace work.
2026-10-17|Strength: mobility focus|Strength|0||20–25 min light core, hips, calves; avoid soreness.
2026-10-18|Easy + optional strides|Easy|9|5:50–6:30/km|8–10 km easy; 4 × 15-sec relaxed strides only if fully recovered.
2026-10-19|Threshold: 3 × 2 km|Threshold|12|4:20–4:25/km|3 × 2 km with 2-min jog recoveries. 11–13 km total.
2026-10-20|Strength + recovery|Strength|0||20–30 min moderate-light strength; optional 5–6 km easy.
2026-10-21|Easy run|Easy|11|5:50–6:30/km|10–12 km conversational.
2026-10-22|Rest / optional easy|Recovery|0||Rest or 5–6 km easy.
2026-10-23|Long run: marathon segments|Long run|27|4:40–4:50/km segments|26–28 km, mostly easy. If recovered: 2 × 4 km at controlled marathon-specific effort with 1 km easy between.
2026-10-24|Strength: reduced|Strength|0||15–20 min core and mobility only; no heavy legs after Friday.
2026-10-25|Easy run|Easy|9|5:50–6:30/km|8–10 km easy.
2026-10-26|Threshold: 2 × 4 km|Threshold|14|4:20–4:25/km|2 × 4 km with 3-min jog. 13–15 km total; shorten if tired.
2026-10-27|Strength + easy option|Strength|0||20–30 min strength maintenance; optional 5 km easy.
2026-10-28|Easy run|Easy|11|5:50–6:30/km|10–12 km easy.
2026-10-29|Rest / optional easy|Recovery|0||Rest or 5–6 km easy.
2026-10-30|Key endurance long run|Long run|29|4:40–4:50/km segments|28–30 km: 12–14 km easy, then 8–10 km controlled marathon-specific work, easy finish. Do not force 4:16/km.
2026-10-31|Strength: gentle only|Strength|0||15–20 min gentle stability and mobility.
2026-11-01|Easy run|Easy|9|5:50–6:30/km|8–10 km; shorten if sore.
2026-11-02|Threshold: 3 × 2 km|Threshold|12|4:18–4:23/km|3 × 2 km with 2-min jog, 11–13 km total.
2026-11-03|Strength + easy option|Strength|0||20–25 min light strength; optional 5 km recovery.
2026-11-04|Easy run|Easy|11|5:50–6:30/km|10–12 km easy.
2026-11-05|Rest / optional easy|Recovery|0||Rest or 5 km easy.
2026-11-06|Last big long run|Long run|27|4:35–4:45/km segments|26–28 km with 2 × 5 km controlled if comfortable; otherwise entirely easy.
2026-11-07|Strength: reduced|Strength|0||15–20 min mobility and core only.
2026-11-08|Easy run|Easy|9|5:50–6:30/km|8–10 km easy.
2026-11-09|Easy + light strides|Easy|8|5:50–6:30/km|8 km easy with 4 × 15-sec relaxed strides.
2026-11-10|Strength: very light|Strength|0||15–20 min mobility and core. Avoid soreness.
2026-11-11|Sharpen: 3 × 1 km|Interval|8|Controlled 10K effort|7–9 km including 3 × 1 km at controlled 10K effort and generous recovery.
2026-11-12|Easy / rest|Recovery|0||5–6 km easy or rest.
2026-11-13|Shakeout / rest|Recovery|4|Relaxed|3–4 km easy + 3 relaxed strides, or rest.
2026-11-14|10K TUNE-UP RACE|Race|10|Race effort|Race replaces strength. Warm up 10–15 min, drills, relaxed strides and cool down if comfortable.
2026-11-15|Recovery / rest|Recovery|0||Rest or 4–6 km very easy.
2026-11-16|Recovery after 10K|Recovery|0||Rest or 6–8 km easy based on recovery.
2026-11-17|Strength: light|Strength|0||15–20 min core and hips; optional 5 km easy; avoid fatigue.
2026-11-18|Controlled workout|Threshold|9|4:22–4:27/km segments|8–10 km including 2 × 2 km controlled only if recovered from 10K.
2026-11-19|Rest / optional easy|Recovery|0||Rest or 5 km easy.
2026-11-20|Short long run|Long run|17|Easy; optional MP|16–18 km easy; optional 4–5 km at confirmed sustainable marathon effort.
2026-11-21|Strength: minimal|Strength|0||10–15 min mobility and core; no heavy legs.
2026-11-22|Easy + optional strides|Easy|7|5:50–6:30/km|6–8 km easy with 3 relaxed strides only if comfortable.
2026-11-23|Easy / rest|Recovery|0||5–6 km easy or rest.
2026-11-24|Gentle activation|Strength|0||10–15 min mobility and activation only, optional 4–5 km easy. No loaded strength.
2026-11-25|Easy + relaxed strides|Easy|6|Easy effort|5–6 km easy including 3 × 15-sec relaxed strides.
2026-11-26|Shakeout / rest|Recovery|0||3–4 km easy or rest.
2026-11-27|REST + race preparation|Recovery|0||Prepare race kit, familiar fuel and hydration plan. Prioritize sleep.
2026-11-28|MARATHON RACE DAY|Race|42.2|Validated race pace|Start conservatively, follow practiced fueling and hydration. Race replaces strength.
`;
const DEFAULT_PLAN = TRAINING_ROWS.trim().split('\n').map((line,i)=>{const [date,title,type,km,pace,notes]=line.split('|');return {id:'plan-'+i,date,title,type,km:Number(km),pace,notes,complete:false};});
