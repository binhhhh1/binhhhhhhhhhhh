import type { AimLog, AimProofType } from '../types/training';

const LOCAL_PROOF_IMAGE_PREFIX = 'vth_aim_proof_img_v1_';

export interface ProofUrlValidation {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function validateProofUrl(raw: string): ProofUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, normalized: '' };
  }
  if (trimmed.length > 500) {
    return {
      valid: false,
      normalized: '',
      error: 'Link bằng chứng tối đa 500 ký tự.',
    };
  }
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalized: '',
        error: 'Chỉ hỗ trợ liên kết HTTP/HTTPS hợp lệ.',
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        valid: false,
        normalized: '',
        error: 'Link bằng chứng chưa đúng định dạng tên miền (VD: https://medal.tv/...).',
      };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return {
      valid: false,
      normalized: '',
      error: 'Link bằng chứng không hợp lệ.',
    };
  }
}

export function inferProofType(
  proofUrl: string,
  hasImage: boolean,
  explicit?: AimProofType,
): AimProofType | undefined {
  if (hasImage) return 'screenshot';
  const url = proofUrl.trim().toLowerCase();
  if (!url) return undefined;
  if (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('medal.tv') ||
    url.includes('twitch.tv') ||
    url.includes('streamable.com') ||
    url.includes('outplayed') ||
    /\.(mp4|webm|mov)(\?|$)/.test(url)
  ) {
    return 'video';
  }
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(url)) {
    return 'screenshot';
  }
  return explicit || 'link';
}

export function hasAimProof(
  log: Pick<AimLog, 'proofUrl' | 'proofImageDataUrl'>,
): boolean {
  return Boolean(
    (log.proofUrl && log.proofUrl.trim().length > 0) ||
      (log.proofImageDataUrl && log.proofImageDataUrl.trim().length > 0),
  );
}

export interface AimProofSummary {
  totalSessions: number;
  withProofCount: number;
  missingProofCount: number;
  verifiedCount: number;
  proofCoveragePct: number;
}

export function computeAimProofSummary(logs: AimLog[]): AimProofSummary {
  const totalSessions = logs.length;
  let withProofCount = 0;
  let verifiedCount = 0;
  for (const log of logs) {
    const hasProof = hasAimProof(log);
    if (hasProof) {
      withProofCount += 1;
      if (log.proofVerified) {
        verifiedCount += 1;
      }
    }
  }
  const missingProofCount = Math.max(0, totalSessions - withProofCount);
  const proofCoveragePct =
    totalSessions > 0 ? Math.round((withProofCount / totalSessions) * 100) : 0;

  return {
    totalSessions,
    withProofCount,
    missingProofCount,
    verifiedCount,
    proofCoveragePct,
  };
}

export function getProofImageCacheKey(logId: string): string {
  return `${LOCAL_PROOF_IMAGE_PREFIX}${logId}`;
}

export function saveLocalProofImage(
  logId: string,
  dataUrl: string,
  storage: Storage | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): void {
  if (!storage || !logId) return;
  try {
    if (!dataUrl.trim()) {
      storage.removeItem(getProofImageCacheKey(logId));
      return;
    }
    storage.setItem(getProofImageCacheKey(logId), dataUrl);
  } catch {
    // ignore storage quota errors
  }
}

export function getLocalProofImage(
  logId: string,
  storage: Storage | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): string {
  if (!storage || !logId) return '';
  try {
    return storage.getItem(getProofImageCacheKey(logId)) || '';
  } catch {
    return '';
  }
}

export function removeLocalProofImage(
  logId: string,
  storage: Storage | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): void {
  if (!storage || !logId) return;
  try {
    storage.removeItem(getProofImageCacheKey(logId));
  } catch {
    // ignore
  }
}

export async function compressImageFileToDataUrl(
  file: File,
  options?: { maxDimension?: number; maxBytes?: number },
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP...).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Ảnh quá lớn (tối đa 15MB trước khi nén).');
  }

  const maxDimension = options?.maxDimension ?? 960;
  const maxBytes = options?.maxBytes ?? 140_000;

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể đọc dữ liệu ảnh.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Tệp ảnh không hợp lệ hoặc bị hỏng.'));
    el.src = rawDataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return rawDataUrl;
  }
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.78;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > maxBytes && quality > 0.4) {
    quality -= 0.12;
    result = canvas.toDataURL('image/jpeg', quality);
  }
  return result;
}

export async function captureScreenToDataUrl(options?: {
  maxDimension?: number;
  maxBytes?: number;
}): Promise<string> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    throw new Error(
      'Trình duyệt hoặc khung preview không hỗ trợ chụp màn hình trực tiếp. Hãy nhấn Win+Shift+S (hoặc Cmd+Shift+4) rồi Ctrl+V dán ảnh vào đây hoặc chọn file ảnh.',
    );
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 1, max: 5 } },
      audio: false,
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        void video.play().then(() => resolve()).catch(reject);
      };
      video.onerror = () => reject(new Error('Không thể đọc khung hình từ màn hình.'));
    });

    // Wait a tick for the first rendered frame
    await new Promise((r) => setTimeout(r, 120));

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const maxDimension = options?.maxDimension ?? 960;
    const maxBytes = options?.maxBytes ?? 140_000;
    const scale = Math.min(1, maxDimension / Math.max(vw, vh));
    const width = Math.max(1, Math.round(vw * scale));
    const height = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể tạo ảnh từ khung hình màn hình.');
    }
    ctx.drawImage(video, 0, 0, width, height);

    let quality = 0.78;
    let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > maxBytes && quality > 0.4) {
      quality -= 0.12;
      result = canvas.toDataURL('image/jpeg', quality);
    }
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new Error(
        'Đã hủy hoặc trình duyệt chặn chụp màn hình. Bạn có thể dán ảnh (Ctrl+V) hoặc chọn ảnh từ máy.',
      );
    }
    throw err instanceof Error
      ? err
      : new Error('Không thể chụp màn hình. Hãy thử chọn ảnh hoặc dán Ctrl+V.');
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}

