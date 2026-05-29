import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  Volume2,
} from 'lucide-react-native';
import InCallManager from 'react-native-incall-manager';
import { io, Socket } from 'socket.io-client';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

import { getApiBaseUrls } from '../config/api';
import { palette } from '../data/mockVibes';
import { resolveProfileImage } from '../services/avatar';
import { ChatUser } from '../services/messageApi';
import { useAuthStore } from '../store/authStore';

type CallType = 'voice' | 'video';
type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'connected' | 'ended';
type CallDirection = 'incoming' | 'outgoing';

type CallUser = {
  id: number;
  username: string;
  profile_image?: string | null;
};

type ActiveCall = {
  callId: string;
  callType: CallType;
  peer: CallUser;
  callerId: number;
  receiverId: number;
  direction: CallDirection;
  phase: CallPhase;
  muted: boolean;
  speakerOn: boolean;
  cameraOff: boolean;
  cameraFacing: 'front' | 'back';
  statusText: string;
  connectedAt?: number;
};

type VoiceCallContextValue = {
  socketReady: boolean;
  startVoiceCall: (user: CallUser | ChatUser) => Promise<void>;
  startVideoCall: (user: CallUser | ChatUser) => Promise<void>;
};

const VoiceCallContext = createContext<VoiceCallContextValue>({
  socketReady: false,
  startVoiceCall: async () => undefined,
  startVideoCall: async () => undefined,
});

const peerConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function normalizeCallType(value?: string): CallType {
  return value === 'video' ? 'video' : 'voice';
}

function normalizeCallUser(user: any): CallUser {
  const userId = Number(user?.id);
  const username = user?.username || 'vibezone';

  return {
    id: userId,
    username,
    profile_image: resolveProfileImage(user?.profile_image, userId, username),
  };
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function targetUserId(call: ActiveCall) {
  return call.direction === 'outgoing' ? call.receiverId : call.callerId;
}

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [socketReady, setSocketReady] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<any[]>([]);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringScale = useRef(new Animated.Value(1)).current;

  const updateCall = useCallback((next: ActiveCall | null | ((call: ActiveCall | null) => ActiveCall | null)) => {
    setActiveCall((current) => {
      const updated = typeof next === 'function' ? next(current) : next;
      callRef.current = updated;
      return updated;
    });
  }, []);

  const emitCallEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!socketRef.current?.connected) {
      return false;
    }

    socketRef.current.emit(event, payload);
    return true;
  }, []);

  const stopMedia = useCallback(() => {
    try {
      InCallManager.stop();
    } catch {
      // Native audio manager can be unavailable in unsupported runtimes.
    }

    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    setLocalStreamUrl(null);
    setRemoteStreamUrl(null);
  }, []);

  const clearCallSoon = useCallback((delay = 700) => {
    stopMedia();

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = setTimeout(() => {
      updateCall(null);
      setElapsed(0);
    }, delay);
  }, [stopMedia, updateCall]);

  const requestMediaPermissions = useCallback(async (callType: CallType) => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

    if (callType === 'video') {
      permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    const result = await PermissionsAndroid.requestMultiple(permissions);

    return permissions.every(
      (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED
    );
  }, []);

  const ensureLocalStream = useCallback(async (callType: CallType) => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const allowed = await requestMediaPermissions(callType);

    if (!allowed) {
      throw new Error(callType === 'video'
        ? 'Camera and microphone permission are required for video calls.'
        : 'Microphone permission is required for voice calls.');
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
        ? {
            facingMode: 'user',
            width: 720,
            height: 1280,
            frameRate: 30,
          } as any
        : false,
    });
    localStreamRef.current = stream as MediaStream;
    setLocalStreamUrl(localStreamRef.current.toURL());

    return localStreamRef.current;
  }, [requestMediaPermissions]);

  const markConnected = useCallback(() => {
    updateCall((call) => {
      if (!call || call.phase === 'connected' || call.phase === 'ended') {
        return call;
      }

      return {
        ...call,
        phase: 'connected',
        connectedAt: Date.now(),
        statusText: call.callType === 'video' ? 'Live video call' : 'Live voice call',
      };
    });
  }, [updateCall]);

  const flushPendingIce = useCallback(async () => {
    const peer = peerRef.current;

    if (!peer || !peer.remoteDescription) {
      return;
    }

    const candidates = [...pendingIceRef.current];
    pendingIceRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidates from interrupted calls.
      }
    }
  }, []);

  const ensurePeerConnection = useCallback(async (call: ActiveCall) => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const stream = await ensureLocalStream(call.callType);
    const peer = new RTCPeerConnection(peerConfig);
    const receiverId = targetUserId(call);
    peerRef.current = peer;

    try {
      InCallManager.start({ media: call.callType === 'video' ? 'video' : 'audio', auto: true });
      InCallManager.setSpeakerphoneOn(call.callType === 'video' || call.speakerOn);
    } catch {
      // Speaker routing is available only in the development build native runtime.
    }

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    (peer as any).addEventListener('icecandidate', (event: any) => {
      if (!event.candidate) {
        return;
      }

      emitCallEvent('ice_candidate', {
        receiver_id: receiverId,
        call_id: call.callId,
        call_type: call.callType,
        candidate: event.candidate,
      });
    });

    (peer as any).addEventListener('track', (event: any) => {
      const streamFromEvent = event.streams?.[0];

      if (streamFromEvent) {
        remoteStreamRef.current = streamFromEvent;
        setRemoteStreamUrl(streamFromEvent.toURL());
      }

      markConnected();
    });

    (peer as any).addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') {
        markConnected();
      }

      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        updateCall((current) =>
          current ? { ...current, phase: 'ended', statusText: 'Call ended' } : current
        );
        clearCallSoon();
      }
    });

    return peer;
  }, [clearCallSoon, emitCallEvent, ensureLocalStream, markConnected, updateCall]);

  const createAndSendOffer = useCallback(async (call: ActiveCall) => {
    const peer = await ensurePeerConnection(call);
    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: call.callType === 'video',
    } as any);
    await peer.setLocalDescription(offer);
    emitCallEvent('offer', {
      receiver_id: targetUserId(call),
      call_id: call.callId,
      call_type: call.callType,
      offer,
    });
  }, [emitCallEvent, ensurePeerConnection]);

  const beginOutgoingCall = useCallback(async (peerUser: CallUser | ChatUser, callType: CallType) => {
    if (!currentUser?.id) {
      Alert.alert('Call', 'Please log in again before calling.');
      return;
    }

    if (!socketRef.current?.connected) {
      Alert.alert('Call', 'Call socket is still connecting. Try again in a moment.');
      return;
    }

    if (callRef.current && callRef.current.phase !== 'ended') {
      Alert.alert('Call', 'You are already in a call.');
      return;
    }

    const peer = normalizeCallUser(peerUser);
    const callId = `${currentUser.id}-${peer.id}-${Date.now()}`;
    const nextCall: ActiveCall = {
      callId,
      callType,
      peer,
      callerId: currentUser.id,
      receiverId: peer.id,
      direction: 'outgoing',
      phase: 'outgoing',
      muted: false,
      speakerOn: callType === 'video',
      cameraOff: false,
      cameraFacing: 'front',
      statusText: callType === 'video' ? 'Ringing video...' : 'Ringing...',
    };

    updateCall(nextCall);
    emitCallEvent(callType === 'video' ? 'video_call' : 'voice_call', {
      receiver_id: peer.id,
      call_id: callId,
      call_type: callType,
    });
  }, [currentUser?.id, emitCallEvent, updateCall]);

  const handleIncomingCall = useCallback((payload: any, eventCallType: CallType) => {
    const caller = normalizeCallUser(payload?.caller);
    const receiverId = Number(payload?.receiver_id || currentUser?.id);
    const callType = normalizeCallType(payload?.call_type || eventCallType);

    if (!caller.id || !receiverId) {
      return;
    }

    const current = callRef.current;

    if (current && current.phase !== 'ended') {
      emitCallEvent('call_rejected', {
        caller_id: caller.id,
        call_id: payload?.call_id,
        call_type: callType,
        reason: 'busy',
      });
      return;
    }

    updateCall({
      callId: String(payload?.call_id || `${caller.id}-${receiverId}-${Date.now()}`),
      callType,
      peer: caller,
      callerId: caller.id,
      receiverId,
      direction: 'incoming',
      phase: 'incoming',
      muted: false,
      speakerOn: callType === 'video',
      cameraOff: false,
      cameraFacing: 'front',
      statusText: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
    });
  }, [currentUser?.id, emitCallEvent, updateCall]);

  const handleCallAccepted = useCallback((payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId) {
      return;
    }

    const nextCall = {
      ...call,
      callType: normalizeCallType(payload?.call_type || call.callType),
      phase: 'connecting' as CallPhase,
      statusText: call.callType === 'video' ? 'Opening camera...' : 'Connecting microphone...',
    };
    updateCall(nextCall);
    createAndSendOffer(nextCall).catch((error) => {
      Alert.alert('Call', error.message || 'Could not start the call.');
      clearCallSoon();
    });
  }, [clearCallSoon, createAndSendOffer, updateCall]);

  const handleCallRejected = useCallback((payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId) {
      return;
    }

    updateCall({
      ...call,
      phase: 'ended',
      statusText: payload?.reason === 'busy' ? 'User is busy' : 'Call declined',
    });
    clearCallSoon(900);
  }, [clearCallSoon, updateCall]);

  const handleOffer = useCallback(async (payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId || !payload?.offer) {
      return;
    }

    const nextCall = {
      ...call,
      callType: normalizeCallType(payload?.call_type || call.callType),
      phase: 'connecting' as CallPhase,
      statusText: call.callType === 'video' ? 'Connecting video...' : 'Connecting voice...',
    };
    updateCall(nextCall);

    try {
      const peer = await ensurePeerConnection(nextCall);
      await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await flushPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      emitCallEvent('answer', {
        receiver_id: Number(payload.sender_id),
        call_id: nextCall.callId,
        call_type: nextCall.callType,
        answer,
      });
    } catch (error: any) {
      Alert.alert('Call', error.message || 'Could not accept the call.');
      clearCallSoon();
    }
  }, [clearCallSoon, emitCallEvent, ensurePeerConnection, flushPendingIce, updateCall]);

  const handleAnswer = useCallback(async (payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId || !payload?.answer) {
      return;
    }

    try {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
      await flushPendingIce();
      markConnected();
    } catch {
      updateCall({ ...call, phase: 'ended', statusText: 'Call failed' });
      clearCallSoon();
    }
  }, [clearCallSoon, flushPendingIce, markConnected, updateCall]);

  const handleIceCandidate = useCallback(async (payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId || !payload?.candidate) {
      return;
    }

    const peer = peerRef.current;

    if (!peer || !peer.remoteDescription) {
      pendingIceRef.current.push(payload.candidate);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch {
      // Ignore stale ICE candidates from failed or ended calls.
    }
  }, []);

  const handleRemoteEnd = useCallback((payload: any) => {
    const call = callRef.current;

    if (!call || payload?.call_id !== call.callId) {
      return;
    }

    updateCall({
      ...call,
      phase: 'ended',
      statusText: 'Call ended',
    });
    clearCallSoon();
  }, [clearCallSoon, updateCall]);

  useEffect(() => {
    if (!token || !currentUser?.id) {
      setSocketReady(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    let active = true;
    const urls = getApiBaseUrls();

    const connectToUrl = (index: number) => {
      if (!active || index >= urls.length) {
        return;
      }

      const socket = io(urls[index], {
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        timeout: 4500,
      });
      let triedFallback = false;
      socketRef.current = socket;

      socket.on('connect', () => setSocketReady(true));
      socket.on('disconnect', () => setSocketReady(false));
      socket.on('connect_error', () => {
        setSocketReady(false);

        if (!triedFallback && index < urls.length - 1) {
          triedFallback = true;
          socket.disconnect();
          connectToUrl(index + 1);
        }
      });
      socket.on('voice_call', (payload) => handleIncomingCall(payload, 'voice'));
      socket.on('video_call', (payload) => handleIncomingCall(payload, 'video'));
      socket.on('call_accepted', handleCallAccepted);
      socket.on('call_rejected', handleCallRejected);
      socket.on('offer', handleOffer);
      socket.on('answer', handleAnswer);
      socket.on('ice_candidate', handleIceCandidate);
      socket.on('end_call', handleRemoteEnd);
    };

    connectToUrl(0);

    return () => {
      active = false;
      setSocketReady(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
      stopMedia();
    };
  }, [
    currentUser?.id,
    handleAnswer,
    handleCallAccepted,
    handleCallRejected,
    handleIceCandidate,
    handleIncomingCall,
    handleOffer,
    handleRemoteEnd,
    stopMedia,
    token,
  ]);

  useEffect(() => {
    callRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall || (activeCall.phase !== 'incoming' && activeCall.phase !== 'outgoing')) {
      ringScale.stopAnimation();
      ringScale.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.08,
          duration: 720,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 720,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [activeCall?.phase, ringScale]);

  useEffect(() => {
    if (!activeCall?.connectedAt || activeCall.phase !== 'connected') {
      setElapsed(0);
      return undefined;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - activeCall.connectedAt!) / 1000));
    };
    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [activeCall?.connectedAt, activeCall?.phase]);

  const acceptCall = useCallback(async () => {
    const call = callRef.current;

    if (!call || call.direction !== 'incoming') {
      return;
    }

    try {
      await ensureLocalStream(call.callType);
      updateCall({
        ...call,
        phase: 'connecting',
        statusText: call.callType === 'video' ? 'Opening camera...' : 'Connecting microphone...',
      });
      emitCallEvent('call_accepted', {
        caller_id: call.callerId,
        call_id: call.callId,
        call_type: call.callType,
      });
    } catch (error: any) {
      Alert.alert('Call', error.message || 'Permission failed.');
      clearCallSoon();
    }
  }, [clearCallSoon, emitCallEvent, ensureLocalStream, updateCall]);

  const rejectCall = useCallback(() => {
    const call = callRef.current;

    if (!call) {
      return;
    }

    if (call.direction === 'incoming') {
      emitCallEvent('call_rejected', {
        caller_id: call.callerId,
        call_id: call.callId,
        call_type: call.callType,
      });
    }

    updateCall({
      ...call,
      phase: 'ended',
      statusText: 'Call declined',
    });
    clearCallSoon(500);
  }, [clearCallSoon, emitCallEvent, updateCall]);

  const endCall = useCallback(() => {
    const call = callRef.current;

    if (!call) {
      return;
    }

    const duration = call.connectedAt ? Math.floor((Date.now() - call.connectedAt) / 1000) : 0;
    emitCallEvent('end_call', {
      receiver_id: targetUserId(call),
      call_id: call.callId,
      caller_id: call.callerId,
      call_receiver_id: call.receiverId,
      call_type: call.callType,
      duration,
    });
    updateCall({
      ...call,
      phase: 'ended',
      statusText: 'Call ended',
    });
    clearCallSoon(650);
  }, [clearCallSoon, emitCallEvent, updateCall]);

  const toggleMute = useCallback(() => {
    updateCall((call) => {
      if (!call) {
        return call;
      }

      const muted = !call.muted;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });

      return {
        ...call,
        muted,
        statusText: muted ? 'Microphone muted' : call.callType === 'video' ? 'Live video call' : 'Live voice call',
      };
    });
  }, [updateCall]);

  const toggleSpeaker = useCallback(() => {
    updateCall((call) => {
      if (!call) {
        return call;
      }

      const speakerOn = !call.speakerOn;

      try {
        InCallManager.setSpeakerphoneOn(speakerOn);
      } catch {
        // Ignore when native audio routing is unavailable.
      }

      return {
        ...call,
        speakerOn,
      };
    });
  }, [updateCall]);

  const toggleCamera = useCallback(() => {
    updateCall((call) => {
      if (!call || call.callType !== 'video') {
        return call;
      }

      const cameraOff = !call.cameraOff;
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });

      return {
        ...call,
        cameraOff,
      };
    });
  }, [updateCall]);

  const switchCamera = useCallback(() => {
    updateCall((call) => {
      if (!call || call.callType !== 'video' || call.cameraOff) {
        return call;
      }

      const videoTrack = localStreamRef.current?.getVideoTracks()[0] as any;

      if (videoTrack?._switchCamera) {
        videoTrack._switchCamera();
      }

      return {
        ...call,
        cameraFacing: call.cameraFacing === 'front' ? 'back' : 'front',
      };
    });
  }, [updateCall]);

  const contextValue = useMemo(
    () => ({
      socketReady,
      startVoiceCall: (user: CallUser | ChatUser) => beginOutgoingCall(user, 'voice'),
      startVideoCall: (user: CallUser | ChatUser) => beginOutgoingCall(user, 'video'),
    }),
    [beginOutgoingCall, socketReady]
  );

  return (
    <VoiceCallContext.Provider value={contextValue}>
      {children}
      <CallOverlay
        call={activeCall}
        elapsed={elapsed}
        localStreamUrl={localStreamUrl}
        remoteStreamUrl={remoteStreamUrl}
        ringScale={ringScale}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
      />
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall() {
  return useContext(VoiceCallContext);
}

function CallOverlay({
  call,
  elapsed,
  localStreamUrl,
  remoteStreamUrl,
  ringScale,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
  onSwitchCamera,
}: {
  call: ActiveCall | null;
  elapsed: number;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  ringScale: Animated.Value;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
}) {
  if (!call) {
    return null;
  }

  const isIncoming = call.phase === 'incoming';
  const isVideo = call.callType === 'video';
  const avatar = resolveProfileImage(call.peer.profile_image, call.peer.id, call.peer.username);
  const title = isIncoming
    ? isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'
    : call.phase === 'connected'
      ? formatDuration(elapsed)
      : call.statusText;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      {isVideo && !isIncoming ? (
        <View style={styles.videoScreen}>
          {remoteStreamUrl ? (
            <RTCView
              streamURL={remoteStreamUrl}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={false}
            />
          ) : (
            <LinearGradient colors={['#120A2A', '#4C1D95', '#111827']} style={styles.remoteFallback}>
              <Animated.View style={[styles.avatarHalo, { transform: [{ scale: ringScale }] }]}>
                <Image source={{ uri: avatar }} style={styles.videoWaitingAvatar} />
              </Animated.View>
              <Text style={styles.videoWaitingText}>{call.statusText}</Text>
            </LinearGradient>
          )}

          {localStreamUrl && !call.cameraOff ? (
            <View style={styles.localPreview}>
              <RTCView
                streamURL={localStreamUrl}
                style={styles.localVideo}
                objectFit="cover"
                mirror={call.cameraFacing === 'front'}
              />
            </View>
          ) : (
            <View style={[styles.localPreview, styles.localPreviewOff]}>
              <CameraOff color="#FFFFFF" size={24} />
            </View>
          )}

          <View style={styles.videoTopBar}>
            <Text style={styles.videoName} numberOfLines={1}>@{call.peer.username.replace(/^@/, '')}</Text>
            <Text style={styles.videoStatus}>{title}</Text>
          </View>

          <View style={styles.videoControls}>
            <ControlButton active={call.muted} onPress={onToggleMute}>
              {call.muted ? <MicOff color="#FFFFFF" size={22} /> : <Mic color="#FFFFFF" size={22} />}
            </ControlButton>
            <ControlButton active={call.cameraOff} onPress={onToggleCamera}>
              {call.cameraOff ? <CameraOff color="#FFFFFF" size={22} /> : <Camera color="#FFFFFF" size={22} />}
            </ControlButton>
            <ControlButton onPress={onSwitchCamera}>
              <SwitchCamera color="#FFFFFF" size={22} />
            </ControlButton>
            <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={onEnd}>
              <PhoneOff color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <LinearGradient colors={['#120A2A', '#4C1D95', '#8B5CF6']} style={styles.callScreen}>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
          <Text style={styles.callEyebrow}>VibeZone {isVideo ? 'Video' : 'Voice'}</Text>
          <Text style={styles.callStatus}>{title}</Text>
          <Animated.View style={[styles.avatarHalo, { transform: [{ scale: ringScale }] }]}>
            <LinearGradient colors={['#F0ABFC', '#8B5CF6', '#38BDF8']} style={styles.avatarRing}>
              <Image source={{ uri: avatar }} style={styles.callAvatar} />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.callName} numberOfLines={1}>@{call.peer.username.replace(/^@/, '')}</Text>
          <Text style={styles.callSubtext}>
            {call.phase === 'connected' ? formatDuration(elapsed) : call.statusText}
          </Text>

          <View style={styles.controls}>
            {isIncoming ? (
              <>
                <TouchableOpacity style={[styles.roundControl, styles.reject]} onPress={onReject}>
                  <PhoneOff color="#FFFFFF" size={28} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roundControl, styles.accept]} onPress={onAccept}>
                  <Phone color="#FFFFFF" size={28} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ControlButton active={call.muted} onPress={onToggleMute}>
                  {call.muted ? <MicOff color="#FFFFFF" size={24} /> : <Mic color="#FFFFFF" size={24} />}
                </ControlButton>
                <ControlButton active={call.speakerOn} onPress={onToggleSpeaker}>
                  <Volume2 color="#FFFFFF" size={24} />
                </ControlButton>
                <TouchableOpacity style={[styles.roundControl, styles.reject]} onPress={onEnd}>
                  <PhoneOff color="#FFFFFF" size={28} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </LinearGradient>
      )}
    </Modal>
  );
}

function ControlButton({
  active,
  children,
  onPress,
}: {
  active?: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.controlButton, active && styles.controlButtonActive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  callScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  glowTop: {
    position: 'absolute',
    top: 82,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(56,130,246,0.18)',
  },
  callEyebrow: {
    position: 'absolute',
    top: 72,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  callStatus: {
    position: 'absolute',
    top: 104,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  avatarHalo: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  avatarRing: {
    width: 158,
    height: 158,
    borderRadius: 79,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  callAvatar: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#EDE9FE',
  },
  callName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 34,
    maxWidth: '100%',
  },
  callSubtext: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
  },
  controls: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  roundControl: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  reject: {
    backgroundColor: '#EF4444',
  },
  accept: {
    backgroundColor: '#22C55E',
  },
  videoScreen: {
    flex: 1,
    backgroundColor: '#05020A',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWaitingAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  videoWaitingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 24,
  },
  localPreview: {
    position: 'absolute',
    top: 82,
    right: 18,
    width: 112,
    height: 158,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  localPreviewOff: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoTopBar: {
    position: 'absolute',
    left: 18,
    right: 148,
    top: 86,
  },
  videoName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  videoStatus: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  videoControls: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 42,
    minHeight: 78,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 10, 43, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  controlButtonActive: {
    backgroundColor: palette.violet,
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
});
