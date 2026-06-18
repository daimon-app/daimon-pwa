// api/coach.js — DAIMON Coach API Route
// Vercel Serverless Function
// APIキーはVercel環境変数にのみ存在する。クライアントには渡さない。

import Anthropic from '@anthropic-ai/sdk';

// モデルは環境変数で切り替え可能。未設定時はデフォルトを使う
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// ── プロンプト組み立て ─────────────────────────────────────

function buildSystemPrompt(coachTone) {
  const toneGuide = {
    calm:   '静かで確信のある語り口。断定を使う。「〜だ」「〜がある」「〜がある。」',
    strict: '簡潔・直接的。余計な言葉を省く。短文で切る。',
    warm:   '寄り添いながらも事実ベース。「〜できた」「〜があった」',
  };

  return `あなたはDAIMONコーチです。
ユーザーが自分の人生の主導権を自分に戻すための補助役です。

絶対に守るルール：
- AIに依存させない。次の一手はユーザーが決める
- 説教しない
- 根拠のない称賛をしない（「すごい」「素晴らしい」は使わない）
- 過剰に煽らない
- 上から目線にしない
- 不安を煽らない
- 前置き・挨拶・「はい」などの冒頭語は不要。本文だけ返す
- 結びの言葉（「頑張ってください」など）は不要

あなたの役割：
- 事実を拾う（できた証拠・一手を具体的に言及する）
- 次の一手に繋ぐ（ユーザーが決めた一手を支持する）
- 戻れたことを事実として認める

口調：${toneGuide[coachTone] || toneGuide.calm}`;
}

function buildMorningPrompt(ctx) {
  const { user, core, support, meta, outputConstraints } = ctx;
  const nick = user.nickname || 'あなた';

  const lines = [];

  // ★核：昨日の一手
  if (core.yesterdayTomorrowAction) {
    lines.push(`昨日決めた一手：「${core.yesterdayTomorrowAction}」`);
    if (support.yesterdayCompletedTomorrowAction === true) {
      lines.push('→ 今日、実行した');
    } else if (support.yesterdayCompletedTomorrowAction === false) {
      lines.push('→ 今日、実行できなかった');
    }
  }

  // ★核：今日の最小行動
  if (core.todayMinimumAction) {
    lines.push(`今日の最小行動：「${core.todayMinimumAction}」`);
  }

  // 補助：昨日の状況
  if (support.yesterdayHabitDone?.length > 0) {
    lines.push(`昨日の達成習慣：${support.yesterdayHabitDone.join('、')}`);
  }
  if (support.yesterdayRecovered) {
    lines.push('昨日、崩れても戻れた');
  }
  if (support.yesterdayEvidence?.length > 0) {
    lines.push(`昨日の証拠：${support.yesterdayEvidence.join(' / ')}`);
  }

  // 補助：背景
  if (meta.streakCount > 0) {
    lines.push(`連続${meta.streakCount}日目`);
  }
  if (user.idealSelf) {
    lines.push(`理想：${user.idealSelf}`);
  }
  if (user.goals?.weekly) {
    lines.push(`今週の目標：${user.goals.weekly}`);
  }

  const context = lines.length > 0 ? lines.join('\n') : '（初日または情報なし）';

  return `${nick}への朝のコーチングをお願いします。

【文脈】
${context}

${outputConstraints.maxSentences}文以内で返してください。
${core.yesterdayTomorrowAction ? `昨日の一手「${core.yesterdayTomorrowAction}」に必ず言及してください。` : ''}
今日の行動に繋がる言葉で締めてください。
本文だけ返してください。前置きや挨拶は不要です。`;
}

function buildNightPrompt(ctx) {
  const { user, core, support, meta, outputConstraints } = ctx;
  const nick = user.nickname || 'あなた';

  const lines = [];

  // ★核：今日できた証拠
  if (core.evidence?.length > 0) {
    lines.push(`今日の証拠：\n${core.evidence.map(e => `  ・${e}`).join('\n')}`);
  } else {
    lines.push('今日の証拠：（未記入）');
  }

  // ★核：昨日の一手の実行確認
  if (core.completedTomorrowAction === true) {
    lines.push('昨日決めた一手：実行した');
  } else if (core.completedTomorrowAction === false) {
    lines.push('昨日決めた一手：実行できなかった');
  }

  // ★核：最小行動
  if (core.minimumAction) {
    lines.push(`最小行動：「${core.minimumAction}」`);
  }

  // ★核：明日の一手
  if (core.tomorrowAction) {
    lines.push(`明日の一手：「${core.tomorrowAction}」`);
  }

  // 補助：習慣
  if (support.habitDone?.length > 0) {
    lines.push(`達成した習慣：${support.habitDone.join('、')}（${support.achieveRate}%）`);
  }

  // 補助：復帰
  if (support.recovered) {
    const withMove = support.recoveredWith ? `（「${support.recoveredWith}」を使った）` : '';
    lines.push(`崩れても戻れた${withMove}`);
  }

  // 補助：背景
  if (meta.recentRecoveryCount > 0) {
    lines.push(`直近30日の復帰回数：${meta.recentRecoveryCount}回`);
  }
  if (user.idealSelf) {
    lines.push(`理想：${user.idealSelf}`);
  }

  const context = lines.join('\n');

  return `${nick}への夜の振り返りコーチングをお願いします。

【今日の記録】
${context}

${outputConstraints.maxSentences}文以内で返してください。
証拠があれば具体的に言及してください。
できなかったことは責めないでください。
${core.tomorrowAction ? `最後は明日の一手「${core.tomorrowAction}」に繋げてください。` : '明日に向けて締めてください。'}
本文だけ返してください。前置きや挨拶は不要です。`;
}

// ── メインハンドラ ──────────────────────────────────────────

export default async function handler(req, res) {
  // POST以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // APIキー確認
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // リクエストボディのバリデーション
  const ctx = req.body;
  if (!ctx || !ctx.type || !['morning', 'night'].includes(ctx.type)) {
    return res.status(400).json({ error: 'Invalid request: type must be morning or night' });
  }

  // プロンプト組み立て
  const coachTone    = ctx.user?.coachTone || 'calm';
  const systemPrompt = buildSystemPrompt(coachTone);
  const userPrompt   = ctx.type === 'morning'
    ? buildMorningPrompt(ctx)
    : buildNightPrompt(ctx);

  // Anthropic API呼び出し
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model      : MODEL,
      max_tokens : 300,   // 朝2文・夜4文なので300で十分。超過防止
      system     : systemPrompt,
      messages   : [{ role: 'user', content: userPrompt }],
    });

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ text, type: ctx.type });

  } catch (err) {
    console.error('Anthropic API error:', err?.status, err?.message);

    // エラー種別に応じたステータスコード
    if (err?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    if (err?.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    return res.status(502).json({ error: 'AI service error' });
  }
}
