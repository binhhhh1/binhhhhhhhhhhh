import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_AI_FOCUS_AREAS,
  normalizeGeneratedDrills,
} from './src/utils/aiDrills.ts';
import { DRILL_CATEGORIES } from './src/types/training.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/generate-daily-drills', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Máy chủ chưa có GEMINI_API_KEY. Hãy cấu hình secret GEMINI_API_KEY trong phần Secrets của AI Studio để tạo bài tập AI.',
      });
      return;
    }

    const body = (req.body || {}) as {
      date?: string;
      playerName?: string;
      gameRole?: string;
      mainAgent?: string;
      focusAreas?: string[];
      durationBudgetMin?: number;
      recentStats?: {
        avgAccuracy?: number;
        lastScore?: number;
        totalSessions?: number;
      };
    };

    const dateKey =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : new Date().toISOString().slice(0, 10);

    const focusAreas =
      Array.isArray(body.focusAreas) && body.focusAreas.length > 0
        ? body.focusAreas.slice(0, 6).map((s) => String(s).trim()).filter(Boolean)
        : [...DEFAULT_AI_FOCUS_AREAS.slice(0, 4)];

    const durationBudgetMin = Math.max(
      30,
      Math.min(240, Number(body.durationBudgetMin) || 90),
    );
    const gameRole = String(body.gameRole || 'Duelist').slice(0, 40);
    const mainAgent = String(body.mainAgent || 'Jett').slice(0, 40);
    const playerName = String(body.playerName || 'Tuyển thủ').slice(0, 60);

    const recentSummary = body.recentStats
      ? `Dữ liệu Aim gần nhất: ${body.recentStats.totalSessions ?? 0} buổi, Accuracy trung bình ${body.recentStats.avgAccuracy ?? 0}%, điểm gần nhất ${body.recentStats.lastScore ?? 0}.`
      : 'Chưa có lịch sử Aim trước đó.';

    const prompt = [
      `Lập giáo án luyện tập Valorant hằng ngày cho ngày ${dateKey}.`,
      `Tuyển thủ: ${playerName} · Vai trò: ${gameRole} · Agent chính: ${mainAgent}.`,
      `Trọng tâm bắt buộc hôm nay: ${focusAreas.join(', ')}.`,
      `Tổng thời lượng mục tiêu khoảng ${durationBudgetMin} phút (chia thành 4 bài tập cụ thể từ Tracking, Flicking, Micro Adjustment, Crosshair Placement, Movement/Spray phù hợp Valorant).`,
      recentSummary,
      `Yêu cầu viết bằng tiếng Việt chuyên môn Esports Valorant, đặt tên bài tập rõ ràng (ví dụ: Aimlabs VT Smoothbot Tracking, Kovaak's Static Flicks, Range Strafe Deadzone, Deathmatch Sheriff Pre-aim), nêu mục tiêu định lượng cụ thể (accuracy %, headshot %, điểm hoặc số bots) và hướng dẫn kỹ thuật ngắn gọn dễ áp dụng ngay.`,
    ].join('\n');

    try {
      const modelsToTry = [MODEL_NAME, 'gemini-3.1-flash-lite'];
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      let lastErr: unknown = null;

      for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        try {
          response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                'Bạn là Huấn luyện viên Hiệu suất & Aim Coach Valorant chuyên nghiệp. Luôn trả về JSON đúng schema, bài tập thực tế cho Aimlabs/Kovaak/Valorant Range/Deathmatch với trọng tâm Tracking, Flicking, Micro Adjustment và Crosshair Placement.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  coachNote: {
                    type: Type.STRING,
                    description: 'Lời khuyên ngắn gọn của Coach cho giáo án ngày hôm nay (tiếng Việt).',
                  },
                  drills: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        category: {
                          type: Type.STRING,
                          enum: [...DRILL_CATEGORIES],
                        },
                        focusTag: {
                          type: Type.STRING,
                          description: 'Kỹ năng chính như Tracking, Flicking, Micro Adjustment, Crosshair Placement, Spray Control, Movement.',
                        },
                        startTime: {
                          type: Type.STRING,
                          description: 'Giờ đề xuất dạng HH:mm, ví dụ 09:00 hoặc 14:30',
                        },
                        durationMin: {
                          type: Type.NUMBER,
                          description: 'Thời lượng phút (10-90)',
                        },
                        goal: {
                          type: Type.STRING,
                          description: 'Mục tiêu định lượng rõ ràng',
                        },
                        description: {
                          type: Type.STRING,
                          description: 'Hướng dẫn thực hiện chi tiết ngắn gọn',
                        },
                      },
                      required: [
                        'title',
                        'category',
                        'focusTag',
                        'startTime',
                        'durationMin',
                        'goal',
                        'description',
                      ],
                    },
                  },
                },
                required: ['coachNote', 'drills'],
              },
            },
          });
          break;
        } catch (modelErr) {
          lastErr = modelErr;
          const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
          const isTransient =
            msg.includes('503') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('429') ||
            msg.includes('high demand');
          if (!isTransient || i === modelsToTry.length - 1) {
            throw modelErr;
          }
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      const rawText = response?.text;
      if (!rawText) {
        if (lastErr) throw lastErr;
        res.status(502).json({
          error: 'Mô hình AI không trả về nội dung giáo án. Vui lòng thử lại.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        coachNote?: unknown;
        drills?: unknown;
      };
      const drills = normalizeGeneratedDrills(parsed.drills, dateKey);

      if (drills.length === 0) {
        res.status(502).json({
          error: 'Dữ liệu bài tập AI trả về không hợp lệ. Vui lòng tạo lại.',
        });
        return;
      }

      res.json({
        date: dateKey,
        focusAreas,
        coachNote:
          typeof parsed.coachNote === 'string'
            ? parsed.coachNote.trim().slice(0, 320)
            : 'Tập trung ổn định nhịp tay Tracking trước khi chuyển sang Flick tốc độ cao.',
        generatedAt: new Date().toISOString(),
        drills,
      });
    } catch (err) {
      const rawMessage =
        err instanceof Error
          ? err.message
          : 'Không thể kết nối Gemini API để tạo bài tập.';
      console.error('AI Daily Drill Error:', err);
      const isUnavailable =
        rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE');
      const friendlyMessage = isUnavailable
        ? 'Máy chủ Gemini AI đang quá tải tạm thời (503). Vui lòng nhấn "Thử lại" sau ít giây.'
        : rawMessage;
      res.status(isUnavailable ? 503 : 500).json({ error: friendlyMessage });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build artifacts not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Valorant Training Hub server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
