import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Mic, MicOff, PhoneOff, Plus, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from 'livekit-client';
import { createVoiceToken, getStoredAccessToken, type AuthUser } from './api/auth';
import type { Book } from './types';

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface VoiceParticipant {
  id: string;
  name: string;
  initials: string;
  isLocal: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
}

const MAX_VISIBLE_PARTICIPANTS = 3;

const statusMeta: Record<VoiceStatus, { label: string; dotClass: string }> = {
  idle: { label: 'Offline', dotClass: 'bg-outline-variant' },
  connecting: { label: 'Joining', dotClass: 'bg-amber-500 animate-pulse' },
  connected: { label: 'Live', dotClass: 'bg-secondary animate-pulse' },
  reconnecting: { label: 'Reconnecting', dotClass: 'bg-amber-500 animate-pulse' },
  error: { label: 'Error', dotClass: 'bg-red-500' },
};

export function DraggableVoicePanel({
  dragConstraintsRef,
  book,
  currentUser,
}: {
  dragConstraintsRef: RefObject<HTMLDivElement | null>;
  book: Book;
  currentUser: AuthUser | null;
}) {
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const isLeavingRef = useRef(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isMicUpdating, setIsMicUpdating] = useState(false);
  const [roomName, setRoomName] = useState('');

  const statusInfo = statusMeta[status];
  const connected = status === 'connected' || status === 'reconnecting';
  const hasOverflow = participants.length > MAX_VISIBLE_PARTICIPANTS;
  const visibleParticipants = participants.slice(0, hasOverflow ? MAX_VISIBLE_PARTICIPANTS - 1 : MAX_VISIBLE_PARTICIPANTS);
  const hiddenParticipantCount = Math.max(0, participants.length - visibleParticipants.length);

  const cleanupAudioTracks = useCallback(() => {
    const container = audioContainerRef.current;
    if (container) {
      container.replaceChildren();
    }
  }, []);

  const updateParticipants = useCallback((targetRoom = roomRef.current) => {
    if (!targetRoom || targetRoom.state === ConnectionState.Disconnected) {
      setParticipants([]);
      return;
    }

    const roomParticipants: Participant[] = [
      targetRoom.localParticipant,
      ...Array.from(targetRoom.remoteParticipants.values()),
    ].filter((participant) => Boolean(participant.identity));

    setParticipants(roomParticipants.map((participant) => {
      const name = participant.name || (participant.isLocal ? currentUser?.displayName : '') || participant.identity;
      return {
        id: participant.identity,
        name,
        initials: getInitials(name),
        isLocal: participant.isLocal,
        isMuted: !participant.isMicrophoneEnabled,
        isSpeaking: participant.isSpeaking,
      };
    }));
    setIsMicEnabled(targetRoom.localParticipant.isMicrophoneEnabled);
  }, [currentUser]);

  const attachAudioTrack = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio || !audioContainerRef.current) {
      return;
    }
    const element = track.attach();
    element.autoplay = true;
    element.controls = false;
    element.dataset.voiceTrackId = track.sid;
    element.className = 'hidden';
    audioContainerRef.current.appendChild(element);
    void element.play().catch(() => {
      setErrorMessage('Click the voice panel once to allow audio playback.');
    });
  }, []);

  const detachAudioTrack = useCallback((track: RemoteTrack) => {
    track.detach().forEach((element) => element.remove());
  }, []);

  const leaveVoiceRoom = useCallback(async () => {
    const activeRoom = roomRef.current;
    isLeavingRef.current = true;
    roomRef.current = null;
    if (activeRoom) {
      await activeRoom.disconnect();
    }
    cleanupAudioTracks();
    setStatus('idle');
    setParticipants([]);
    setRoomName('');
    setErrorMessage('');
    setIsMicEnabled(true);
    isLeavingRef.current = false;
  }, [cleanupAudioTracks]);

  const wireRoomEvents = useCallback((nextRoom: Room) => {
    const syncParticipants = () => updateParticipants(nextRoom);
    const setRecoverableError = (error: Error) => {
      setErrorMessage(formatVoiceError(error));
      updateParticipants(nextRoom);
    };

    nextRoom
      .on(RoomEvent.ConnectionStateChanged, (nextState) => {
        if (nextState === ConnectionState.Connected) {
          setStatus('connected');
        } else if (nextState === ConnectionState.Connecting) {
          setStatus('connecting');
        } else if (
          nextState === ConnectionState.Reconnecting ||
          nextState === ConnectionState.SignalReconnecting
        ) {
          setStatus('reconnecting');
        }
        syncParticipants();
      })
      .on(RoomEvent.ParticipantConnected, syncParticipants)
      .on(RoomEvent.ParticipantDisconnected, syncParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, syncParticipants)
      .on(RoomEvent.TrackMuted, syncParticipants)
      .on(RoomEvent.TrackUnmuted, syncParticipants)
      .on(RoomEvent.LocalTrackPublished, syncParticipants)
      .on(RoomEvent.LocalTrackUnpublished, syncParticipants)
      .on(RoomEvent.ParticipantNameChanged, syncParticipants)
      .on(RoomEvent.TrackSubscribed, (track) => {
        attachAudioTrack(track);
        syncParticipants();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        detachAudioTrack(track);
        syncParticipants();
      })
      .on(RoomEvent.MediaDevicesError, setRecoverableError)
      .on(RoomEvent.Reconnecting, () => {
        setStatus('reconnecting');
        setErrorMessage('');
      })
      .on(RoomEvent.SignalReconnecting, () => {
        setStatus('reconnecting');
        setErrorMessage('');
      })
      .on(RoomEvent.Reconnected, () => {
        setStatus('connected');
        setErrorMessage('');
        syncParticipants();
      })
      .on(RoomEvent.Disconnected, () => {
        cleanupAudioTracks();
        if (isLeavingRef.current) {
          return;
        }
        roomRef.current = null;
        setStatus('error');
        setParticipants([]);
        setErrorMessage('Voice connection ended. Retry when the network is stable.');
      });
  }, [attachAudioTrack, cleanupAudioTracks, detachAudioTrack, updateParticipants]);

  const joinVoiceRoom = useCallback(async () => {
    if (!currentUser) {
      setStatus('error');
      setErrorMessage('Please sign in before joining voice.');
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setStatus('error');
      setErrorMessage('Please sign in before joining voice.');
      return;
    }

    await leaveVoiceRoom();
    setStatus('connecting');
    setErrorMessage('');

    const nextRoom = new Room();
    wireRoomEvents(nextRoom);
    roomRef.current = nextRoom;

    try {
      const voiceToken = await createVoiceToken(book.id, token);
      setRoomName(voiceToken.roomName);
      await nextRoom.connect(voiceToken.serverUrl, voiceToken.token, { autoSubscribe: true });
      await nextRoom.startAudio();
      await requestMicrophoneAccess();
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      setStatus('connected');
      setErrorMessage('');
      updateParticipants(nextRoom);
    } catch (error) {
      roomRef.current = null;
      await nextRoom.disconnect();
      cleanupAudioTracks();
      setStatus('error');
      setParticipants([]);
      setErrorMessage(formatVoiceError(error));
    }
  }, [book.id, cleanupAudioTracks, currentUser, leaveVoiceRoom, updateParticipants, wireRoomEvents]);

  const reconnectVoiceRoom = useCallback(async () => {
    await joinVoiceRoom();
  }, [joinVoiceRoom]);

  const toggleMicrophone = useCallback(async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom || isMicUpdating) {
      return;
    }
    setIsMicUpdating(true);
    setErrorMessage('');
    try {
      const nextMicState = !activeRoom.localParticipant.isMicrophoneEnabled;
      if (nextMicState) {
        await requestMicrophoneAccess();
      }
      await activeRoom.localParticipant.setMicrophoneEnabled(nextMicState);
      updateParticipants(activeRoom);
    } catch (error) {
      setErrorMessage(formatVoiceError(error));
    } finally {
      setIsMicUpdating(false);
    }
  }, [isMicUpdating, updateParticipants]);

  useEffect(() => {
    return () => {
      const activeRoom = roomRef.current;
      roomRef.current = null;
      cleanupAudioTracks();
      void activeRoom?.disconnect();
    };
  }, [cleanupAudioTracks]);

  useEffect(() => {
    if (roomRef.current) {
      void leaveVoiceRoom();
    }
  }, [book.id, leaveVoiceRoom]);

  const actionButton = useMemo(() => {
    if (status === 'connecting') {
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-outline-variant/30 text-on-surface-variant">
          <RefreshCw size={16} className="animate-spin" />
        </div>
      );
    }
    if (connected) {
      return (
        <button
          type="button"
          onClick={() => void leaveVoiceRoom()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-tertiary-fixed-dim/60 bg-tertiary-fixed-dim/20 text-tertiary-container transition-colors hover:bg-tertiary-fixed-dim/35"
          aria-label="Leave voice room"
          title="Leave voice room"
        >
          <PhoneOff size={16} />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => void (status === 'error' ? reconnectVoiceRoom() : joinVoiceRoom())}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-outline-variant/30 text-on-surface-variant transition-all hover:border-secondary hover:text-secondary"
        aria-label={status === 'error' ? 'Reconnect voice room' : 'Join voice room'}
        title={status === 'error' ? 'Reconnect voice room' : 'Join voice room'}
      >
        {status === 'error' ? <RefreshCw size={16} /> : <Plus size={16} />}
      </button>
    );
  }, [connected, joinVoiceRoom, leaveVoiceRoom, reconnectVoiceRoom, status]);

  return (
    <motion.div
      drag
      dragConstraints={dragConstraintsRef}
      dragElastic={0}
      dragMomentum={false}
      className="absolute bottom-24 left-6 z-30 hidden w-56 cursor-grab touch-none active:cursor-grabbing xl:block"
    >
      <div className="space-y-3 rounded-xl border border-surface-container bg-white/85 p-4 shadow-xl backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-3 text-left" aria-label="Drag voice panel">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Mic size={14} className="text-secondary" />
              <span className="text-xs uppercase tracking-widest">Voice</span>
            </div>
            <p className="mt-1 truncate text-[10px] font-medium text-on-surface-variant">
              {roomName || `book-${book.id}`}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {visibleParticipants.map((participant) => (
            <div key={participant.id}>
              <VoiceAvatar participant={participant} />
            </div>
          ))}
          {hiddenParticipantCount > 0 && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-primary">
              +{hiddenParticipantCount}
            </div>
          )}
          {Array.from({ length: Math.max(0, MAX_VISIBLE_PARTICIPANTS - visibleParticipants.length - (hiddenParticipantCount > 0 ? 1 : 0)) }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="h-10 w-10 rounded-full border border-dashed border-outline-variant/20"
              aria-hidden="true"
            />
          ))}
          {actionButton}
        </div>

        {connected && (
          <div className="flex items-center justify-between gap-2 border-t border-surface-container pt-3">
            <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              {participants.length} member{participants.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => void toggleMicrophone()}
              disabled={isMicUpdating}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isMicEnabled
                  ? 'border-secondary-container bg-secondary-container/40 text-secondary'
                  : 'border-tertiary-fixed-dim/60 bg-tertiary-fixed-dim/25 text-tertiary-container'
              }`}
              aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isMicEnabled ? <Mic size={15} /> : <MicOff size={15} />}
            </button>
          </div>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/20 px-3 py-2 text-[11px] leading-5 text-tertiary-container">
            {errorMessage}
          </p>
        )}

        <div ref={audioContainerRef} aria-hidden="true" />
      </div>
    </motion.div>
  );
}

function VoiceAvatar({ participant }: { participant: VoiceParticipant }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border bg-surface-container-low text-xs font-bold text-primary ${
          participant.isSpeaking
            ? 'border-secondary ring-2 ring-secondary ring-offset-2'
            : participant.isLocal
              ? 'border-secondary-container ring-2 ring-secondary-container ring-offset-2'
              : 'border-surface-container-highest'
        }`}
        title={`${participant.isLocal ? 'You' : participant.name}${participant.isMuted ? ' - muted' : ''}`}
      >
        {participant.initials}
        {participant.isSpeaking && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-secondary shadow-sm">
            <span className="absolute inset-0 rounded-full bg-secondary animate-ping" />
          </span>
        )}
        {participant.isMuted && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-tertiary-fixed-dim text-tertiary-container">
            <MicOff size={9} />
          </span>
        )}
      </div>
      <span className="max-w-20 truncate text-[10px] font-semibold text-on-surface-variant">
        {participant.isLocal ? 'You' : participant.name}
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  const tokens = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return '?';
  }
  return tokens
    .slice(0, 2)
    .map((token) => token[0])
    .join('')
    .toUpperCase();
}

async function requestMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not supported by this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function formatVoiceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const name = error instanceof DOMException ? error.name : '';

  if (
    name === 'NotAllowedError' ||
    normalized.includes('permission denied') ||
    normalized.includes('notallowederror') ||
    normalized.includes('permission dismissed')
  ) {
    return 'Microphone permission was denied. Allow microphone access in the browser and retry.';
  }
  if (name === 'NotFoundError' || normalized.includes('requested device not found')) {
    return 'No microphone was found. Connect a microphone and retry.';
  }
  if (normalized.includes('voice rooms are not enabled') || normalized.includes('livekit voice configuration')) {
    return message;
  }
  if (normalized.includes('401') || normalized.includes('403') || normalized.includes('unauthorized')) {
    return 'Please sign in before joining voice.';
  }
  return message || 'Failed to join voice room.';
}
