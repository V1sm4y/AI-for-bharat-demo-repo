import { supabase } from '../../services/supabase/config';

export interface ReferenceProfile {
  imageDataUrl: string;
  imageHash: string;
  faceHash: string;
  qualityScore: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  faceCount: number;
  faceCoverage: number;
  geometrySignature: number[];
  warnings: string[];
}

export interface AttemptInsights {
  previousAttempts: number;
  sameDayAttempts: number;
  duplicateReferenceUsers: string[];
  warnings: string[];
}

export interface LiveAssessment {
  faceCount: number;
  qualityScore: number;
  visibilityScore: number;
  matchConfidence: number;
  warnings: string[];
}

const MAX_HASH_DISTANCE = 64;
const MODEL_PATH = '/models';
let faceApiPromise: Promise<any> | null = null;
let modelsLoaded = false;

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getFaceApi() {
  if (!isWeb()) return null;
  if (!faceApiPromise) {
    faceApiPromise = import('face-api.js');
  }
  const faceapi = await faceApiPromise;
  if (!modelsLoaded) {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
    ]);
    modelsLoaded = true;
  }
  return faceapi;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function computeHash(data: Uint8ClampedArray) {
  let sum = 0;
  for (let index = 0; index < data.length; index += 4) {
    sum += data[index];
  }

  const mean = sum / (data.length / 4);
  let bits = '';
  for (let index = 0; index < data.length; index += 4) {
    bits += data[index] >= mean ? '1' : '0';
  }
  return bits;
}

function hashDistance(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let score = 0;
  for (let index = 0; index < maxLength; index += 1) {
    if (left[index] !== right[index]) score += 1;
  }
  return score;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = dataUrl;
  });
}

function getImageDataFromFace(source: CanvasImageSource, box: { x: number; y: number; width: number; height: number }) {
  const canvas = createCanvas(64, 64);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create canvas context');

  context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, 64, 64);
  return context.getImageData(0, 0, 64, 64);
}

function computeBrightness(imageData: ImageData) {
  const values: number[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    values.push((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
  }
  return average(values);
}

function computeContrast(imageData: ImageData) {
  const values: number[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    values.push((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function computeSharpness(imageData: ImageData) {
  const gray: number[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    gray.push((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
  }

  let total = 0;
  for (let y = 1; y < 63; y += 1) {
    for (let x = 1; x < 63; x += 1) {
      const center = gray[y * 64 + x];
      const laplacian =
        Math.abs(4 * center - gray[y * 64 + x - 1] - gray[y * 64 + x + 1] - gray[(y - 1) * 64 + x] - gray[(y + 1) * 64 + x]);
      total += laplacian;
    }
  }
  return total / (62 * 62);
}

function computeGeometrySignature(face: { detection: { box: { width: number; height: number } }; landmarks?: { positions: Array<{ x: number; y: number }> } }) {
  const positions = face.landmarks?.positions || [];
  const leftEye = positions[36];
  const rightEye = positions[45];
  const nose = positions[30];
  const mouth = positions[62] || positions[66];
  const width = face.detection.box.width || 1;
  const height = face.detection.box.height || 1;

  return [
    leftEye && rightEye ? distance(leftEye, rightEye) / width : 0,
    leftEye && nose ? distance(leftEye, nose) / height : 0,
    rightEye && nose ? distance(rightEye, nose) / height : 0,
    nose && mouth ? distance(nose, mouth) / height : 0,
  ];
}

function compareGeometry(reference: number[], sample: number[]) {
  if (!reference.length || !sample.length) return 0;
  const diffs = reference.map((value, index) => Math.abs(value - (sample[index] || 0)));
  const meanDiff = average(diffs);
  return clamp(100 - meanDiff * 500, 0, 100);
}

function computeQuality(brightness: number, contrast: number, sharpness: number, faceCoverage: number) {
  const brightnessScore = brightness >= 70 && brightness <= 190 ? 100 : brightness < 70 ? brightness : 255 - brightness;
  const contrastScore = clamp(contrast * 2.3);
  const sharpnessScore = clamp(sharpness / 2.2);
  const coverageScore = clamp(faceCoverage * 180);
  return Math.round((brightnessScore * 0.2) + (contrastScore * 0.25) + (sharpnessScore * 0.35) + (coverageScore * 0.2));
}

function createWarnings(brightness: number, contrast: number, sharpness: number, faceCoverage: number) {
  const warnings: string[] = [];
  if (brightness < 60) warnings.push('Reference image is too dark');
  if (contrast < 35) warnings.push('Reference image has low contrast');
  if (sharpness < 85) warnings.push('Reference image may be blurry or manipulated');
  if (faceCoverage < 0.18) warnings.push('Face in reference image is too small');
  return warnings;
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function pickImageFile() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export function supportsAdvancedWebProctoring() {
  return isWeb();
}

export function supportsReferenceUpload() {
  return isWeb();
}

export function canRunLiveFaceDetection() {
  return isWeb();
}

export async function pickAndAnalyzeReferencePhoto() {
  if (!isWeb()) {
    throw new Error('Reference photo upload is only available on web right now');
  }

  const faceapi = await getFaceApi();
  if (!faceapi) {
    throw new Error('Face analysis is not available in this environment');
  }
  const file = await pickImageFile();
  if (!file) return null;

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const fullImageData = getImageDataFromFace(image, { x: 0, y: 0, width: image.width, height: image.height });
  const imageHash = computeHash(fullImageData.data);
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });
  const detections = await faceapi.detectAllFaces(image, options).withFaceLandmarks().withFaceDescriptors();
  if (detections.length !== 1) {
    throw new Error(detections.length === 0 ? 'No face found in the reference photo' : 'Use a reference photo with only one face');
  }

  const face = detections[0];
  const box = face.detection.box;
  const faceImageData = getImageDataFromFace(image, { x: box.x, y: box.y, width: box.width, height: box.height });
  const brightness = computeBrightness(faceImageData);
  const contrast = computeContrast(faceImageData);
  const sharpness = computeSharpness(faceImageData);
  const faceCoverage = (box.width * box.height) / Math.max(image.width * image.height, 1);
  const qualityScore = computeQuality(brightness, contrast, sharpness, faceCoverage);
  const faceHash = Array.from(face.descriptor as ArrayLike<number>).map((value) => Number(value).toFixed(4)).join('|');
  const geometrySignature = computeGeometrySignature(face);
  const warnings = createWarnings(brightness, contrast, sharpness, faceCoverage);

  return {
    fileName: file.name,
    profile: {
      imageDataUrl: dataUrl,
      imageHash,
      faceHash,
      qualityScore,
      brightness,
      contrast,
      sharpness,
      faceCount: detections.length,
      faceCoverage,
      geometrySignature,
      warnings,
    } satisfies ReferenceProfile,
  };
}

export async function loadAttemptInsights(userId: string, jobId?: string, referenceHash?: string): Promise<AttemptInsights> {
  const { data: interviews } = await supabase
    .from('interviews')
    .select('user_id, job_id, created_at, transcript, feedback')
    .order('created_at', { ascending: false })
    .limit(100);

  const relevant = (interviews || []).filter((item) => !jobId || item.job_id === jobId);
  const previousAttempts = relevant.filter((item) => item.user_id === userId).length;
  const today = new Date().toISOString().slice(0, 10);
  const sameDayAttempts = relevant.filter((item) => item.user_id === userId && String(item.created_at || '').slice(0, 10) === today).length;
  const duplicateReferenceUsers = referenceHash
    ? relevant
        .filter((item) => item.user_id !== userId)
        .filter((item: any) => item?.transcript?.proctoring_reference_hash === referenceHash || item?.feedback?.proctoring?.referenceHash === referenceHash)
        .map((item) => item.user_id)
    : [];

  const warnings: string[] = [];
  if (previousAttempts > 0) warnings.push(`Candidate has ${previousAttempts} prior interview attempt${previousAttempts > 1 ? 's' : ''} for this role`);
  if (sameDayAttempts > 0) warnings.push(`Candidate already attempted this interview ${sameDayAttempts} time${sameDayAttempts > 1 ? 's' : ''} today`);
  if (duplicateReferenceUsers.length > 0) warnings.push('Reference photo appears in other candidate submissions');

  return {
    previousAttempts,
    sameDayAttempts,
    duplicateReferenceUsers,
    warnings,
  };
}

export async function assessLiveVideo(reference: ReferenceProfile): Promise<LiveAssessment | null> {
  if (!isWeb()) return null;

  const faceapi = await getFaceApi();
  if (!faceapi) return null;

  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });
  const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
  if (!detections.length) {
    return {
      faceCount: 0,
      qualityScore: 0,
      visibilityScore: 0,
      matchConfidence: 0,
      warnings: ['No face detected in live camera'],
    };
  }

  if (detections.length > 1) {
    return {
      faceCount: detections.length,
      qualityScore: 0,
      visibilityScore: 0,
      matchConfidence: 0,
      warnings: ['Multiple faces detected in live camera'],
    };
  }

  const face = detections[0];
  const box = face.detection.box;
  const faceImageData = getImageDataFromFace(video, { x: box.x, y: box.y, width: box.width, height: box.height });
  const brightness = computeBrightness(faceImageData);
  const contrast = computeContrast(faceImageData);
  const sharpness = computeSharpness(faceImageData);
  const faceCoverage = (box.width * box.height) / Math.max(video.videoWidth * video.videoHeight, 1);
  const qualityScore = computeQuality(brightness, contrast, sharpness, faceCoverage);
  const liveHash = Array.from(face.descriptor as ArrayLike<number>).map((value) => Number(value).toFixed(4)).join('|');
  const liveGeometry = computeGeometrySignature(face);
  const hashScore = clamp(100 - (hashDistance(reference.faceHash, liveHash) / (MAX_HASH_DISTANCE * 3)) * 100);
  const geometryScore = compareGeometry(reference.geometrySignature, liveGeometry);
  const matchConfidence = Math.round((hashScore * 0.55) + (geometryScore * 0.25) + (qualityScore * 0.2));
  const visibilityScore = clamp(((faceCoverage * 220) + (qualityScore * 0.6)) / 1.6);
  const warnings = createWarnings(brightness, contrast, sharpness, faceCoverage);

  if (matchConfidence < 55) warnings.push('Live face does not confidently match the uploaded reference');
  if (qualityScore < 55) warnings.push('Live camera feed quality is low');

  return {
    faceCount: 1,
    qualityScore,
    visibilityScore,
    matchConfidence,
    warnings,
  };
}
