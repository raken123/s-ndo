/**
 * Learning: the wudu walkthrough and a knowledge quiz.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { WUDU_STEPS, MADHHAB_NOTE, PRAYER_UNITS } from '../data/salah.js';
import { drawQuestions } from '../data/quiz.js';
import { PRAYER_LABELS } from '../core/prayer-times.js';

export class LearnPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.0, height: 0.76, name: 'learn', distance: 1.15 });
    this.mode = 'wudu';     // wudu | prayers | quiz
    this.wuduStep = 0;
    this.quiz = null;
  }

  render(p) {
    let y = p.title('Learn', 'Wudu, the prayers, and a quiz');

    const tabs = [['wudu', 'Wudu'], ['prayers', 'The prayers'], ['quiz', 'Quiz']];
    const tabW = (p.W - 92) / tabs.length;
    tabs.forEach(([key, label], i) => {
      p.button(`tab-${key}`, label, 46 + i * tabW, y, tabW - 8, 54, {
        active: this.mode === key, font: '600 22px Inter, sans-serif',
        onSelect: () => { this.mode = key; if (key === 'quiz' && !this.quiz) this.startQuiz(); },
      });
    });
    y += 74;

    if (this.mode === 'wudu') this._renderWudu(p, y);
    else if (this.mode === 'prayers') this._renderPrayers(p, y);
    else this._renderQuiz(p, y);
  }

  _renderWudu(p, y) {
    const step = WUDU_STEPS[this.wuduStep];

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 34px Inter, sans-serif';
    p.ctx.fillText(`${this.wuduStep + 1}. ${step.title}`, 50, y);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.textAlign = 'right';
    p.ctx.fillText(step.repeat > 1 ? `${step.repeat} times` : 'once', p.W - 50, y + 8);
    p.ctx.textAlign = 'left';
    y += 52;

    y = p.text(step.detail, 50, y, { color: THEME.ink, font: '400 25px Inter, sans-serif', lineHeight: 34 }) + 16;
    if (step.arabic) y = p.arabic(step.arabic, 50, y, { size: 40, maxWidth: p.W - 100 }) + 12;
    if (step.translit) {
      y = p.text(step.translit, 50, y, {
        color: THEME.goldDim, font: 'italic 400 22px Inter, sans-serif', lineHeight: 30,
      }) + 12;
    }

    // Step dots.
    const dotY = p.H - 150;
    WUDU_STEPS.forEach((_, i) => {
      p.ctx.beginPath();
      p.ctx.arc(56 + i * 34, dotY, i === this.wuduStep ? 11 : 7, 0, Math.PI * 2);
      p.ctx.fillStyle = i < this.wuduStep ? THEME.green
        : i === this.wuduStep ? THEME.gold : 'rgba(255,255,255,0.14)';
      p.ctx.fill();
    });

    const bw = (p.W - 110) / 2;
    p.button('prev', '‹ Back', 50, p.H - 116, bw, 60, {
      onSelect: () => { this.wuduStep = Math.max(0, this.wuduStep - 1); this.app.audio.click(); },
    });
    p.button('next', this.wuduStep === WUDU_STEPS.length - 1 ? 'Start again' : 'Next ›',
      50 + bw + 10, p.H - 116, bw, 60, {
        onSelect: () => {
          this.wuduStep = (this.wuduStep + 1) % WUDU_STEPS.length;
          this.app.audio.click();
          this.app.audio.say(WUDU_STEPS[this.wuduStep].title);
        },
      });

    p.ctx.fillStyle = THEME.goldDim;
    p.ctx.font = '400 18px Inter, sans-serif';
    p.ctx.fillText('Water use differs by school; this is the commonly taught order.', 50, p.H - 40);
  }

  _renderPrayers(p, y) {
    const keys = Object.keys(PRAYER_UNITS);
    const rowH = 64;

    p.ctx.font = '600 20px Inter, sans-serif';
    p.ctx.fillStyle = THEME.muted;
    p.ctx.fillText('Prayer', 60, y);
    p.ctx.fillText('Sunnah before', 320, y);
    p.ctx.fillText('Obligatory', 560, y);
    p.ctx.fillText('Sunnah after', 760, y);
    y += 34;

    for (const key of keys) {
      const units = PRAYER_UNITS[key];
      p.ctx.fillStyle = THEME.ink;
      p.ctx.font = '600 26px Inter, sans-serif';
      p.ctx.fillText(PRAYER_LABELS[key] || 'Jumu\'ah', 60, y + 8);

      p.ctx.font = '500 25px Inter, sans-serif';
      p.ctx.fillStyle = THEME.muted;
      p.ctx.fillText(String(units.sunnahBefore || '—'), 340, y + 8);
      p.ctx.fillStyle = THEME.gold;
      p.ctx.fillText(`${units.fard} rak'ah`, 560, y + 8);
      p.ctx.fillStyle = THEME.muted;
      p.ctx.fillText(String(units.sunnahAfter || '—'), 780, y + 8);

      p.button(`guide-${key}`, 'Guide me', p.W - 220, y - 4, 170, 46, {
        font: '600 20px Inter, sans-serif',
        onSelect: () => this.app.startGuidedPrayer(key),
      });
      y += rowH;
    }

    y = p.divider(y) + 14;
    p.text(MADHHAB_NOTE, 50, y, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 28 });
  }

  _renderQuiz(p, y) {
    if (!this.quiz) this.startQuiz();
    const { questions, index, score, answered } = this.quiz;

    if (index >= questions.length) {
      p.ctx.fillStyle = THEME.gold;
      p.ctx.font = '700 56px Inter, sans-serif';
      p.ctx.fillText(`${score} / ${questions.length}`, 50, y + 10);
      y += 96;
      const best = this.store.get('progress.quizBest', 0);
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '500 24px Inter, sans-serif';
      p.ctx.fillText(`Personal best: ${Math.max(best, score)} of ${questions.length}`, 50, y);
      y += 60;
      p.button('again', 'Play again', 50, y, p.W - 100, 66, { onSelect: () => this.startQuiz() });
      return;
    }

    const question = questions[index];
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.fillText(`Question ${index + 1} of ${questions.length} · score ${score}`, 50, y);
    y += 40;

    y = p.text(question.q, 50, y, { color: THEME.ink, font: '600 29px Inter, sans-serif', lineHeight: 38 }) + 22;

    question.o.forEach((option, i) => {
      const correct = i === question.a;
      const chosen = answered === i;
      p.button(`opt-${i}`, option, 50, y, p.W - 100, 62, {
        active: answered != null && correct,
        danger: chosen && !correct,
        font: '500 24px Inter, sans-serif',
        onSelect: () => this.answer(i),
      });
      y += 70;
    });

    if (answered != null) {
      p.button('next-q', 'Next question ›', 50, p.H - 92, p.W - 100, 62, {
        onSelect: () => {
          this.quiz.index += 1;
          this.quiz.answered = null;
          if (this.quiz.index >= questions.length) {
            this.store.set('progress.quizBest', Math.max(this.store.get('progress.quizBest', 0), this.quiz.score));
          }
        },
      });
    }
  }

  startQuiz() {
    this.quiz = { questions: drawQuestions(10), index: 0, score: 0, answered: null };
    this.refresh();
  }

  answer(i) {
    if (this.quiz.answered != null) return;
    this.quiz.answered = i;
    const correct = i === this.quiz.questions[this.quiz.index].a;
    if (correct) { this.quiz.score += 1; this.app.audio.success(); }
    else this.app.audio.error();
  }
}
