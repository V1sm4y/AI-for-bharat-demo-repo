import { Platform } from 'react-native';

/**
 * Video AI Module
 * 
 * This module handles interview video proctoring signals.
 */

export type ProctoringEventSeverity = 'info' | 'warning' | 'critical';

export type ProctoringEventType =
  | 'session_started'
  | 'camera_permission_granted'
  | 'camera_permission_denied'
  | 'camera_ready'
  | 'camera_interrupted'
  | 'app_backgrounded'
  | 'app_resumed'
  | 'visibility_concern'
  | 'session_ended';

export interface ProctoringEvent {
  id: string;
  type: ProctoringEventType;
  severity: ProctoringEventSeverity;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ProctoringSummary {
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  totalEvents: number;
  warningEvents: number;
  criticalEvents: number;
  integrityScore: number;
  status: 'clear' | 'review' | 'blocked';
  flags: ProctoringFlag[];
  cancelled: boolean;
  cancelReason: string | null;
  faceMatchConfidence: number;
  liveQualityScore: number;
  duplicateAttempts: number;
  duplicateReferenceUsers: string[];
  referenceHash: string | null;
}

export interface ProctoringFlag {
  code: string;
  severity: ProctoringEventSeverity;
  message: string;
  timestamp: string;
}

export class VideoTracker {
  private isTracking: boolean = false;
  private startedAt: Date | null = null;
  private endedAt: Date | null = null;
  private events: ProctoringEvent[] = [];
  private flags: ProctoringFlag[] = [];
  private cancelled = false;
  private cancelReason: string | null = null;
  private faceMatchConfidence = 100;
  private liveQualityScore = 100;
  private duplicateAttempts = 0;
  private duplicateReferenceUsers: string[] = [];
  private referenceHash: string | null = null;
  private lastVisibilityFlagTime = 0;
  private static readonly VISIBILITY_COOLDOWN_MS = 10_000; // 10 seconds between visibility flags

  async requestPermissions(): Promise<boolean> {
    // Dynamically import expo-camera only on native platforms
    let status = 'denied';
    try {
      if (Platform.OS !== 'web') {
        const { Camera } = await import('expo-camera');
        const result = await Camera.requestCameraPermissionsAsync();
        status = result.status;
      } else {
        // On web, camera permissions are handled by the browser at getUserMedia time
        status = 'granted';
      }
    } catch (err) {
      console.warn('Failed to request camera permissions:', err);
    }
    console.log('Camera permission status:', status);
    const granted = status === 'granted';

    this.recordEvent({
      type: granted ? 'camera_permission_granted' : 'camera_permission_denied',
      severity: granted ? 'info' : 'critical',
      message: granted ? 'Camera permission granted' : 'Camera permission denied',
      metadata: { status },
    });

    return granted;
  }

  async startTracking(): Promise<boolean> {
    if (this.isTracking) return true;
    
    try {
      const permission = await this.requestPermissions();
      if (!permission) {
        throw new Error('Camera permission not granted');
      }

      this.isTracking = true;
      this.startedAt = new Date();
      this.endedAt = null;
      this.recordEvent({
        type: 'session_started',
        severity: 'info',
        message: 'Video proctoring session started',
      });
      console.log('Started video proctoring');
      return true;
    } catch (err) {
      console.error('Failed to start video tracking', err);
      return false;
    }
  }

  stopTracking(): ProctoringSummary {
    if (!this.isTracking) return this.getSummary();
    
    try {
      this.isTracking = false;
      this.endedAt = new Date();
      this.recordEvent({
        type: 'session_ended',
        severity: 'info',
        message: 'Video proctoring session ended',
      });
      console.log('Stopped video proctoring');
    } catch (err) {
      console.error('Failed to stop video tracking', err);
    }

    return this.getSummary();
  }

  markCameraReady(): void {
    if (!this.isTracking) return;

    this.recordEvent({
      type: 'camera_ready',
      severity: 'info',
      message: 'Live camera preview became active',
    });
  }

  recordCameraInterruption(message = 'Camera preview was interrupted'): void {
    if (!this.isTracking) return;

    this.recordEvent({
      type: 'camera_interrupted',
      severity: 'critical',
      message,
    });
    this.addFlag('camera_interrupted', message, 'critical');
  }

  recordAppStateChange(state: string): void {
    if (!this.isTracking) return;

    const isBackground = state === 'background' || state === 'inactive';
    this.recordEvent({
      type: isBackground ? 'app_backgrounded' : 'app_resumed',
      severity: isBackground ? 'critical' : 'info',
      message: isBackground
        ? 'Candidate left the interview screen or app became inactive'
        : 'Candidate returned to the interview screen',
      metadata: { state },
    });

    if (isBackground) {
      this.addFlag('app_backgrounded', 'Candidate left the interview window during proctoring', 'critical');
    }
  }

  recordVisibilityConcern(message: string, metadata?: Record<string, unknown>): void {
    if (!this.isTracking) return;

    this.recordEvent({
      type: 'visibility_concern',
      severity: 'warning',
      message,
      metadata,
    });

    // Cooldown: don't add a new flag if the last one was added less than 10 seconds ago
    const now = Date.now();
    if (now - this.lastVisibilityFlagTime < VideoTracker.VISIBILITY_COOLDOWN_MS) {
      return;
    }
    this.lastVisibilityFlagTime = now;
    this.addFlag(`visibility_flag_${this.flags.filter(f => f.code.startsWith('visibility_flag_')).length + 1}`, message, 'warning');
  }

  addFlag(code: string, message: string, severity: ProctoringEventSeverity): void {
    // Prevent duplicate flags with the same code
    if (this.flags.some((flag) => flag.code === code)) return;
    if (this.cancelled) return;

    this.flags.push({
      code,
      severity,
      message,
      timestamp: new Date().toISOString(),
    });

    if (!this.cancelled) {
      if (severity === 'critical') {
        this.cancelled = true;
        this.cancelReason = `Interview cancelled: ${message}`;
      } else if (this.flags.length >= 3) {
        this.cancelled = true;
        this.cancelReason = 'Interview cancelled after reaching the maximum number of proctoring flags';
      }
    }
  }

  setLiveSignals(signals: { faceMatchConfidence?: number; liveQualityScore?: number }) {
    if (typeof signals.faceMatchConfidence === 'number') {
      this.faceMatchConfidence = signals.faceMatchConfidence;
    }
    if (typeof signals.liveQualityScore === 'number') {
      this.liveQualityScore = signals.liveQualityScore;
    }
  }

  setAttemptInsights(insights: { duplicateAttempts?: number; duplicateReferenceUsers?: string[] }) {
    this.duplicateAttempts = insights.duplicateAttempts || 0;
    this.duplicateReferenceUsers = insights.duplicateReferenceUsers || [];
  }

  setReferenceHash(referenceHash: string | null) {
    this.referenceHash = referenceHash;
  }

  cancelInterview(reason: string) {
    this.cancelled = true;
    this.cancelReason = reason;
  }

  getEvents(): ProctoringEvent[] {
    return [...this.events];
  }

  getFlags(): ProctoringFlag[] {
    return [...this.flags];
  }

  getSummary(): ProctoringSummary {
    const warningEvents = this.events.filter((event) => event.severity === 'warning').length;
    const criticalEvents = this.events.filter((event) => event.severity === 'critical').length;
    const started = this.startedAt?.getTime() || Date.now();
    const ended = this.endedAt?.getTime() || Date.now();
    const integrityScore = Math.max(0, 100 - warningEvents * 8 - criticalEvents * 20);

    return {
      startedAt: this.startedAt?.toISOString() || null,
      endedAt: this.endedAt?.toISOString() || null,
      durationSeconds: Math.max(0, Math.round((ended - started) / 1000)),
      totalEvents: this.events.length,
      warningEvents,
      criticalEvents,
      integrityScore,
      status: this.cancelled || criticalEvents > 0 ? 'blocked' : warningEvents > 1 ? 'review' : 'clear',
      flags: [...this.flags],
      cancelled: this.cancelled,
      cancelReason: this.cancelReason,
      faceMatchConfidence: this.faceMatchConfidence,
      liveQualityScore: this.liveQualityScore,
      duplicateAttempts: this.duplicateAttempts,
      duplicateReferenceUsers: [...this.duplicateReferenceUsers],
      referenceHash: this.referenceHash,
    };
  }

  private recordEvent(event: Omit<ProctoringEvent, 'id' | 'timestamp'>): void {
    this.events.push({
      ...event,
      id: `${Date.now()}-${this.events.length + 1}`,
      timestamp: new Date().toISOString(),
    });
  }
}
